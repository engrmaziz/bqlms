import type {
  HeadObjectResult,
  PresignedDownloadOptions,
  PresignedUploadOptions,
  StorageObjectResult,
  StorageProvider,
} from "./types";

export class FakeStorageProvider implements StorageProvider {
  readonly name = "fake";
  private objects = new Map<
    string,
    { data: Buffer; mime: string; sizeBytes: number }
  >();
  public available = true;

  isAvailable(): boolean {
    return this.available;
  }

  putObject(
    key: string,
    data: Buffer | Uint8Array | string,
    mime = "application/octet-stream",
  ): void {
    const buffer = Buffer.isBuffer(data)
      ? data
      : typeof data === "string"
        ? Buffer.from(data, "utf8")
        : Buffer.from(data);
    this.objects.set(key, {
      data: buffer,
      mime,
      sizeBytes: buffer.byteLength,
    });
  }

  async getPresignedUploadUrl(
    options: PresignedUploadOptions,
  ): Promise<string> {
    return `https://fake-storage.local/upload?key=${encodeURIComponent(options.key)}&mime=${encodeURIComponent(options.mime)}&size=${options.sizeBytes}`;
  }

  async getPresignedDownloadUrl(
    options: PresignedDownloadOptions,
  ): Promise<string> {
    const disp = options.disposition ?? "attachment";
    const filename = options.filename
      ? `&filename=${encodeURIComponent(options.filename)}`
      : "";
    return `https://fake-storage.local/download?key=${encodeURIComponent(options.key)}&disposition=${disp}${filename}`;
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      sizeBytes: obj.sizeBytes,
      mime: obj.mime,
      etag: `"fake-etag-${key}"`,
    };
  }

  async getObjectRange(
    key: string,
    startByte: number,
    endByte: number,
  ): Promise<Buffer | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    const end = Math.min(endByte + 1, obj.data.length);
    return obj.data.subarray(startByte, end);
  }

  async getObject(key: string): Promise<StorageObjectResult | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      data: obj.data,
      sizeBytes: obj.sizeBytes,
      mime: obj.mime,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  hasObject(key: string): boolean {
    return this.objects.has(key);
  }

  clear(): void {
    this.objects.clear();
  }
}

export const fakeStorageProvider = new FakeStorageProvider();
