export interface PresignedUploadOptions {
  key: string;
  mime: string;
  sizeBytes: number;
  expiresInSeconds?: number | undefined;
}

export interface PresignedDownloadOptions {
  key: string;
  expiresInSeconds?: number | undefined;
  filename?: string | undefined;
  mime?: string | undefined;
  disposition?: ("inline" | "attachment") | undefined;
}

export interface HeadObjectResult {
  sizeBytes: number;
  mime?: string | undefined;
  etag?: string | undefined;
}

export interface StorageObjectResult {
  data: Buffer;
  sizeBytes: number;
  mime: string;
}

export interface StorageProvider {
  readonly name: string;
  isAvailable(): boolean;
  getPresignedUploadUrl(options: PresignedUploadOptions): Promise<string>;
  getPresignedDownloadUrl(options: PresignedDownloadOptions): Promise<string>;
  headObject(key: string): Promise<HeadObjectResult | null>;
  getObjectRange(
    key: string,
    startByte: number,
    endByte: number,
  ): Promise<Buffer | null>;
  getObject(key: string): Promise<StorageObjectResult | null>;
  deleteObject(key: string): Promise<void>;
}
