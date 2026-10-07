import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as mediaRouteGet } from "@/app/api/v1/media/[fileId]/[key]/route";
import { db } from "@/db/client";
import { withTx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { fakeStorageProvider } from "@/lib/providers/storage/fake";
import { extractYouTubeVideoId, isValidYouTubeUrl } from "@/lib/video/youtube";
import { createUserWithProfile } from "@/modules/identity";
import {
  canDownloadFile,
  filesTable,
  getFileById,
  getStorageUsage,
  incrementStorageReads,
  requestUpload,
  runFileGcJob,
  runFileVerificationJob,
  setStorageBudgetOverride,
  setStorageReadCapOverride,
  storageReadsTable,
} from "..";

describe("Files & Storage Integration Tests", () => {
  let facultyActor: Actor;
  let studentActor1: Actor;
  let studentActor2: Actor;

  beforeEach(async () => {
    // Reset test overrides and fake storage
    setStorageBudgetOverride(null);
    setStorageReadCapOverride(null);
    fakeStorageProvider.clear();

    // Create test actors
    const { user: facultyUser, profile: facultyProfile } =
      await createUserWithProfile({
        name: "Dr. Files Faculty",
        email: `faculty_files_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@college.edu`,
        password: "TestPassword123!",
        roles: ["faculty"],
        status: "active",
      });
    facultyActor = {
      userId: facultyUser.id,
      email: facultyUser.email,
      name: facultyUser.name,
      roles: ["faculty"],
      status: "active",
      twoFactorEnabled: false,
      profile: facultyProfile,
    };

    const { user: studentUser1, profile: studentProfile1 } =
      await createUserWithProfile({
        name: "Alice Student",
        email: `student1_files_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@college.edu`,
        password: "TestPassword123!",
        roles: ["student"],
        status: "active",
      });
    studentActor1 = {
      userId: studentUser1.id,
      email: studentUser1.email,
      name: studentUser1.name,
      roles: ["student"],
      status: "active",
      twoFactorEnabled: false,
      profile: studentProfile1,
    };

    const { user: studentUser2, profile: studentProfile2 } =
      await createUserWithProfile({
        name: "Bob Student",
        email: `student2_files_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@college.edu`,
        password: "TestPassword123!",
        roles: ["student"],
        status: "active",
      });
    studentActor2 = {
      userId: studentUser2.id,
      email: studentUser2.email,
      name: studentUser2.name,
      roles: ["student"],
      status: "active",
      twoFactorEnabled: false,
      profile: studentProfile2,
    };
  });

  afterEach(() => {
    setStorageBudgetOverride(null);
    setStorageReadCapOverride(null);
    fakeStorageProvider.clear();
  });

  // 1. An executable renamed .pdf is rejected and its object deleted
  it("proves an executable renamed .pdf is rejected and its object deleted", async () => {
    // Request upload for a document declared as application/pdf
    const { file } = await withTx(async (tx) => {
      return requestUpload(tx, facultyActor, {
        purpose: "lesson_document",
        name: "syllabus.pdf",
        size: 1024,
        mime: "application/pdf",
      });
    });

    expect(file.status).toBe("pending");

    // Put malicious Windows PE executable bytes into storage (starts with 'MZ' magic bytes)
    const maliciousExeBuffer = Buffer.alloc(1024);
    maliciousExeBuffer[0] = 0x4d; // 'M'
    maliciousExeBuffer[1] = 0x5a; // 'Z'
    fakeStorageProvider.putObject(
      file.storageKey,
      maliciousExeBuffer,
      "application/pdf",
    );

    // File object exists in storage prior to verification
    expect(fakeStorageProvider.hasObject(file.storageKey)).toBe(true);

    // Transition file to 'uploaded' to simulate client upload finish
    await db
      .update(filesTable)
      .set({ status: "uploaded" })
      .where(eq(filesTable.id, file.id));

    // Run the verification background job
    await runFileVerificationJob(file.id);

    // Verify file record is marked as rejected
    const refreshed = await getFileById(file.id);
    expect(refreshed?.status).toBe("rejected");
    expect(refreshed?.rejectionReason).toMatch(/disallowed|executable|PDF/i);

    // Verify the object has been completely deleted from storage
    expect(fakeStorageProvider.hasObject(file.storageKey)).toBe(false);
  });

  // 2. An oversize request is refused before upload
  it("proves an oversize request is refused before upload", async () => {
    // avatar max cap is 512 KB (524,288 bytes)
    const oversizeBytes = 600 * 1024; // 600 KB

    await expect(
      withTx(async (tx) => {
        return requestUpload(tx, studentActor1, {
          purpose: "avatar",
          name: "photo.jpg",
          size: oversizeBytes,
          mime: "image/jpeg",
        });
      }),
    ).rejects.toThrowError(AppError);
  });

  // 3. With the byte budget at 1 MB a 2 MB upload returns QUOTA_EXCEEDED
  it("proves with the byte budget at 1 MB a 2 MB upload returns QUOTA_EXCEEDED", async () => {
    setStorageBudgetOverride(1 * 1024 * 1024); // 1 MB budget

    const twoMb = 2 * 1024 * 1024; // 2 MB

    await expect(
      withTx(async (tx) => {
        return requestUpload(tx, facultyActor, {
          purpose: "lesson_document",
          name: "large_lecture.pdf",
          size: twoMb,
          mime: "application/pdf",
        });
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "QUOTA_EXCEEDED",
      }),
    );
  });

  // 4. With the read cap at 3 the 4th download of the day returns QUOTA_EXCEEDED
  it("proves with the read cap at 3 the 4th download of the day returns QUOTA_EXCEEDED", async () => {
    setStorageReadCapOverride(3);

    // Clear reads recorded for today to start from 0
    const today = new Date().toISOString().slice(0, 10);
    await db.delete(storageReadsTable).where(eq(storageReadsTable.day, today));

    // 1st read
    const count1 = await incrementStorageReads();
    expect(count1).toBe(1);

    // 2nd read
    const count2 = await incrementStorageReads();
    expect(count2).toBe(2);

    // 3rd read
    const count3 = await incrementStorageReads();
    expect(count3).toBe(3);

    // 4th read exceeds cap of 3
    await expect(incrementStorageReads()).rejects.toThrowError(
      expect.objectContaining({
        code: "QUOTA_EXCEEDED",
        message: expect.stringContaining("try again tomorrow"),
      }),
    );
  });

  // 5. The media route sets immutable cache headers and rejects a wrong key
  it("proves the media route sets immutable cache headers and rejects a wrong key", async () => {
    // Create and verify a public CDN file
    const { file } = await withTx(async (tx) => {
      return requestUpload(tx, facultyActor, {
        purpose: "lesson_image",
        name: "diagram.png",
        size: 500,
        mime: "image/png",
        delivery: "cdn",
      });
    });

    const imageBytes = Buffer.from("fake-png-image-content");
    fakeStorageProvider.putObject(file.storageKey, imageBytes, "image/png");

    await db
      .update(filesTable)
      .set({
        status: "verified",
        detectedMime: "image/png",
      })
      .where(eq(filesTable.id, file.id));

    const verifiedFile = await getFileById(file.id);
    expect(verifiedFile).not.toBeNull();
    if (!verifiedFile?.publicKey) {
      throw new Error("Missing verified file public key");
    }
    const correctKey = verifiedFile.publicKey;
    const wrongKey = "wrong-key-00000000000000";

    // 1. Success case: correct key
    const successReq = new NextRequest(
      `http://localhost:3000/api/v1/media/${file.id}/${correctKey}`,
    );
    const successRes = await mediaRouteGet(successReq, {
      params: Promise.resolve({ fileId: file.id, key: correctKey }),
    });

    expect(successRes.status).toBe(200);
    expect(successRes.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, s-maxage=31536000, immutable",
    );
    expect(successRes.headers.get("Content-Type")).toBe("image/png");

    // 2. Failure case: wrong key
    const failReq = new NextRequest(
      `http://localhost:3000/api/v1/media/${file.id}/${wrongKey}`,
    );
    const failRes = await mediaRouteGet(failReq, {
      params: Promise.resolve({ fileId: file.id, key: wrongKey }),
    });

    expect(failRes.status).toBe(404);
  });

  // 6. A submission can never be created with cdn delivery
  it("proves a submission can never be created with cdn delivery", async () => {
    await expect(
      withTx(async (tx) => {
        return requestUpload(tx, studentActor1, {
          purpose: "submission",
          name: "lab1.pdf",
          size: 1000,
          mime: "application/pdf",
          delivery: "cdn",
        });
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "VALIDATION",
      }),
    );
  });

  // 7. A student cannot download another student's submission
  it("proves a student cannot download another student's submission", async () => {
    // Student 1 uploads a submission
    const { file: submissionFile } = await withTx(async (tx) => {
      return requestUpload(tx, studentActor1, {
        purpose: "submission",
        name: "assignment1.pdf",
        size: 2048,
        mime: "application/pdf",
      });
    });

    await db
      .update(filesTable)
      .set({ status: "verified" })
      .where(eq(filesTable.id, submissionFile.id));

    const refreshed = await getFileById(submissionFile.id);
    expect(refreshed).not.toBeNull();
    if (!refreshed) {
      throw new Error("Missing refreshed submission file");
    }

    // Student 1 (owner) can download
    expect(canDownloadFile(studentActor1, refreshed)).toBe(true);

    // Student 2 cannot download Student 1's submission
    expect(canDownloadFile(studentActor2, refreshed)).toBe(false);

    // Faculty instructor can download
    expect(
      canDownloadFile(facultyActor, refreshed, { isInstructor: true }),
    ).toBe(true);
  });

  // 8. GC frees budget
  it("proves GC frees budget by purging stale pending and deleted files", async () => {
    // Create a pending upload
    const fileSize = 10 * 1024 * 1024; // 10 MB
    const { file } = await withTx(async (tx) => {
      return requestUpload(tx, facultyActor, {
        purpose: "lesson_document",
        name: "abandoned_upload.pdf",
        size: fileSize,
        mime: "application/pdf",
      });
    });

    fakeStorageProvider.putObject(
      file.storageKey,
      Buffer.alloc(100),
      "application/pdf",
    );

    // Check usage before GC includes the pending file
    const usageBefore = await withTx(async (tx) => getStorageUsage(tx));
    expect(usageBefore.liveBytes).toBeGreaterThanOrEqual(fileSize);

    // Age the pending file past 24 hours (e.g. 25 hours ago)
    await db
      .update(filesTable)
      .set({
        createdAt: sql`now() - interval '25 hours'`,
      })
      .where(eq(filesTable.id, file.id));

    // Run GC job
    await runFileGcJob();

    // Usage after GC should have decreased by the file's size
    const usageAfter = await withTx(async (tx) => getStorageUsage(tx));
    expect(usageAfter.liveBytes).toBe(usageBefore.liveBytes - fileSize);

    // The stale pending file is marked deleted and removed from storage
    const staleFile = await getFileById(file.id, undefined, {
      includeDeleted: true,
    });
    expect(staleFile?.status).toBe("deleted");
    expect(fakeStorageProvider.hasObject(file.storageKey)).toBe(false);
  });

  // 9. Invalid YouTube URLs are refused
  it("proves invalid YouTube URLs are refused and valid ones accepted", () => {
    // Valid YouTube URLs
    expect(
      isValidYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe(true);
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(isValidYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      isValidYouTubeUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    ).toBe(true);

    // Invalid URLs must be refused
    expect(isValidYouTubeUrl("https://vimeo.com/76979871")).toBe(false);
    expect(extractYouTubeVideoId("https://vimeo.com/76979871")).toBeNull();

    expect(isValidYouTubeUrl("https://evil-site.com/watch?v=dQw4w9WgXcQ")).toBe(
      false,
    );
    expect(isValidYouTubeUrl("https://youtube.com/not-a-video-path")).toBe(
      false,
    );
    expect(isValidYouTubeUrl("https://youtube.com/watch?v=tooShort")).toBe(
      false,
    ); // not 11 chars
    expect(isValidYouTubeUrl("javascript:alert(1)")).toBe(false);
    expect(isValidYouTubeUrl("not-a-url")).toBe(false);
    expect(isValidYouTubeUrl("")).toBe(false);
  });
});
