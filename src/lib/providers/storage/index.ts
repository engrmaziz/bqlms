import { env } from "@/lib/env";
import { fakeStorageProvider } from "./fake";
import { s3StorageProvider } from "./s3";
import type { StorageProvider } from "./types";

export * from "./fake";
export * from "./s3";
export * from "./types";

let currentStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (currentStorageProvider) {
    return currentStorageProvider;
  }

  if (env.STORAGE_PROVIDER === "fake" || env.NODE_ENV === "test") {
    return fakeStorageProvider;
  }

  if (s3StorageProvider.isAvailable()) {
    return s3StorageProvider;
  }

  return fakeStorageProvider;
}

export function setStorageProvider(provider: StorageProvider | null): void {
  currentStorageProvider = provider;
}
