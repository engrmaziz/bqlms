"use client";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileUp,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { compressImage } from "@/lib/images/compress";
import {
  completeUploadAction,
  requestUploadAction,
} from "@/modules/files/actions";
import {
  type FilePurpose,
  type FileRecord,
  PURPOSE_CONFIGS,
} from "@/modules/files/schema";

export interface FileUploaderProps {
  purpose: FilePurpose;
  onSuccess?: (file: FileRecord) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function FileUploader({
  purpose,
  onSuccess,
  onError,
  className = "",
}: FileUploaderProps) {
  const config = PURPOSE_CONFIGS[purpose];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<FileRecord | null>(null);

  const isImagePurpose = purpose === "lesson_image" || purpose === "avatar";

  const startUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setProgress(0);
      setErrorMessage(null);

      try {
        // 1. Request presigned upload URL from server action
        const reqRes = await requestUploadAction({
          purpose,
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
        });

        if (!reqRes.ok) {
          throw new Error(reqRes.error.message);
        }

        const { file: pendingFile, uploadUrl } = reqRes.value;

        // 2. Upload file via XMLHttpRequest for progress monitoring and abortability
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(
                new Error(
                  `Upload to storage failed with status ${xhr.status}: ${xhr.statusText}`,
                ),
              );
            }
          };

          xhr.onerror = () =>
            reject(new Error("Network error during storage upload."));
          xhr.onabort = () => reject(new Error("Upload aborted by user."));

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );
          xhr.send(file);
        });

        // 3. Complete upload to trigger verification job
        const compRes = await completeUploadAction({ fileId: pendingFile.id });
        if (!compRes.ok) {
          throw new Error(compRes.error.message);
        }

        setUploadedFile(compRes.value);
        setProgress(100);
        onSuccess?.(compRes.value);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to upload file.";
        setErrorMessage(msg);
        onError?.(msg);
      } finally {
        setIsUploading(false);
        xhrRef.current = null;
      }
    },
    [purpose, onError, onSuccess],
  );

  const handleProcessFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      setUploadedFile(null);

      // Client-side size check against config cap
      if (file.size > config.maxSizeBytes) {
        const msg = `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed ${(config.maxSizeBytes / 1024 / 1024).toFixed(2)} MB.`;
        setErrorMessage(msg);
        onError?.(msg);
        return;
      }

      // Automatically compress images if purpose is image
      let fileToUpload = file;
      if (isImagePurpose) {
        fileToUpload = await compressImage(file, {
          maxDimension: purpose === "avatar" ? 512 : 1600,
        });
      }

      setSelectedFile(fileToUpload);
      await startUpload(fileToUpload);
    },
    [config.maxSizeBytes, isImagePurpose, purpose, onError, startUpload],
  );

  const handleAbort = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setIsUploading(false);
    setProgress(null);
  };

  const handleRetry = () => {
    if (selectedFile) {
      startUpload(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          handleProcessFile(file);
          break;
        }
      }
    }
  };

  return (
    <div onPaste={handlePaste} className={`space-y-3 ${className}`}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: HTML5 file drag-and-drop dropzone */}
      <div
        data-testid="file-uploader-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          isDragging
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
        }`}
      >
        <input
          ref={fileInputRef}
          data-testid="file-input"
          type="file"
          accept={config.allowedExtensions.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleProcessFile(file);
          }}
          className="hidden"
        />

        {/* Mobile Camera Input */}
        {isImagePurpose && (
          <input
            ref={cameraInputRef}
            data-testid="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProcessFile(file);
            }}
            className="hidden"
          />
        )}

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400">
            <Upload className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-200">
              Drag & drop, paste, or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-zinc-500">
              Max size: {(config.maxSizeBytes / 1024 / 1024).toFixed(0)} MB •
              Formats: {config.allowedExtensions.join(", ")}
            </p>
          </div>

          {/* Quick Camera Capture Button on mobile/images */}
          {isImagePurpose && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-lg border border-zinc-800 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              Capture Photo
            </button>
          )}
        </div>
      </div>

      {/* Progress & Status */}
      {isUploading && progress !== null && (
        <div
          data-testid="upload-progress"
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <FileUp className="w-4 h-4 animate-bounce text-indigo-400" />
              <span className="truncate max-w-[200px]">
                {selectedFile?.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">{progress}%</span>
              <button
                type="button"
                data-testid="upload-abort-button"
                onClick={handleAbort}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
                title="Cancel upload"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success State */}
      {uploadedFile && (
        <div
          data-testid="upload-success"
          className="flex items-center justify-between p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Upload complete. Verifying content...</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadedFile(null)}
            className="text-emerald-400 hover:text-emerald-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error & Retry State */}
      {errorMessage && (
        <div
          data-testid="upload-error"
          className="flex items-center justify-between p-3 bg-red-950/40 border border-red-800/80 rounded-lg text-red-300 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedFile && (
              <button
                type="button"
                data-testid="upload-retry-button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
