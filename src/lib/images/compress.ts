export interface ImageCompressionOptions {
  maxDimension?: number;
  quality?: number;
  targetMime?: "image/webp" | "image/jpeg";
}

/**
 * Resizes and re-encodes images in the browser before upload (max 1600px, WebP or JPEG)
 * to minimize cloud storage consumption and network bandwidth.
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {},
): Promise<File> {
  // If running in SSR or non-browser environment, return original file
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !file.type.startsWith("image/")
  ) {
    return file;
  }

  // Do not compress SVG or GIF (animations)
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  const maxDim = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.82;
  const targetMime = options.targetMime ?? "image/webp";

  return new Promise<File>((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Check if resizing is needed
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compression did not reduce size or failed, keep original
              resolve(file);
              return;
            }

            const ext = targetMime === "image/webp" ? ".webp" : ".jpg";
            const newName = file.name.replace(/\.[^/.]+$/, "") + ext;
            const compressedFile = new File([blob], newName, {
              type: targetMime,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          targetMime,
          quality,
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
