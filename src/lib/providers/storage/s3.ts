import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  HeadObjectResult,
  PresignedDownloadOptions,
  PresignedUploadOptions,
  StorageObjectResult,
  StorageProvider,
} from "./types";

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  isAvailable(): boolean {
    return Boolean(
      env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
    );
  }

  async getPresignedUploadUrl(
    options: PresignedUploadOptions,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      ContentType: options.mime,
      ContentLength: options.sizeBytes,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresInSeconds ?? 300,
    });
  }

  async getPresignedDownloadUrl(
    options: PresignedDownloadOptions,
  ): Promise<string> {
    const disposition = options.disposition ?? "attachment";
    const filenamePart = options.filename
      ? `; filename="${encodeURIComponent(options.filename)}"`
      : "";

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      ResponseContentDisposition: `${disposition}${filenamePart}`,
      ResponseContentType: options.mime,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresInSeconds ?? 60,
    });
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return {
        sizeBytes: res.ContentLength ?? 0,
        mime: res.ContentType,
        etag: res.ETag,
      };
    } catch (err: unknown) {
      const errorName = (err as { name?: string }).name;
      if (errorName === "NotFound" || errorName === "NoSuchKey") {
        return null;
      }
      logger.warn({ err, key }, "S3 headObject error");
      return null;
    }
  }

  async getObjectRange(
    key: string,
    startByte: number,
    endByte: number,
  ): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=${startByte}-${endByte}`,
        }),
      );

      if (!res.Body) return null;
      const byteArray = await res.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err: unknown) {
      logger.warn({ err, key }, "S3 getObjectRange error");
      return null;
    }
  }

  async getObject(key: string): Promise<StorageObjectResult | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      if (!res.Body) return null;
      const byteArray = await res.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);

      return {
        data: buffer,
        sizeBytes: res.ContentLength ?? buffer.byteLength,
        mime: res.ContentType ?? "application/octet-stream",
      };
    } catch (err: unknown) {
      logger.warn({ err, key }, "S3 getObject error");
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err: unknown) {
      logger.warn({ err, key }, "S3 deleteObject error");
    }
  }
}

export const s3StorageProvider = new S3StorageProvider();
