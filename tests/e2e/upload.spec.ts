import { expect, test } from "@playwright/test";
import { createTestUser, signIn } from "./test-helpers";

test.describe("File Upload & Video Player E2E", () => {
  test("loads video player with privacy domain and displays unlisted disclaimer", async ({
    page,
  }) => {
    const user = await createTestUser({
      roles: ["faculty"],
      name: "Video Faculty",
      emailPrefix: "e2e_video",
    });

    await signIn(page, user.email, user.password);
    await page.waitForLoadState("domcontentloaded");
    await page.goto("/settings/upload");

    // 1. Verify YouTube iframe is rendered with privacy-enhanced embed domain
    const iframe = page.locator('[data-testid="youtube-iframe"]');
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute("src");
    expect(src).toContain("https://www.youtube-nocookie.com/embed/");

    // 2. Verify unlisted video disclaimer is present
    const disclaimer = page.locator('[data-testid="video-disclaimer"]');
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText(/unlisted YouTube video/i);

    // 3. Enter invalid video URL and verify error message is shown
    await page
      .locator('[data-testid="video-url-input"]')
      .fill("https://vimeo.com/12345678");
    await page.locator('[data-testid="load-video-button"]').click();

    const errorAlert = page.locator('[data-testid="video-error"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(
      /Invalid or unsupported YouTube video URL/i,
    );
  });

  test("file uploader client refuses oversize file before server transmission", async ({
    page,
  }) => {
    const user = await createTestUser({
      roles: ["student"],
      name: "Uploader Student",
      emailPrefix: "e2e_upload",
    });

    await signIn(page, user.email, user.password);
    await page.waitForLoadState("domcontentloaded");
    await page.goto("/settings/upload");

    // 1. Verify dropzone is rendered
    const dropzone = page.locator('[data-testid="file-uploader-dropzone"]');
    await expect(dropzone).toBeVisible();

    // 2. Simulate selecting an oversize file (> 20 MB limit for lesson_document)
    // Create a 25 MB dummy buffer
    const largeBuffer = Buffer.alloc(25 * 1024 * 1024);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: "huge_document.pdf",
      mimeType: "application/pdf",
      buffer: largeBuffer,
    });

    // 3. Client error should be immediately displayed without sending upload to storage
    const uploadError = page.locator('[data-testid="upload-error"]');
    await expect(uploadError).toBeVisible({ timeout: 5000 });
    await expect(uploadError).toContainText(/exceeds maximum allowed/i);
  });

  test("media CDN capability endpoint rejects invalid keys with 404", async ({
    request,
  }) => {
    // Calling the public media endpoint with a bogus key
    const bogusFileId = "00000000-0000-0000-0000-000000000000";
    const bogusKey = "invalid-capability-key-123456";

    const response = await request.get(
      `/api/v1/media/${bogusFileId}/${bogusKey}`,
    );
    expect(response.status()).toBe(404);
  });
});
