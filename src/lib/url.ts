export function sanitizeCallbackUrl(rawUrl: string | null): string {
  if (!rawUrl) return "/dashboard";
  if (
    rawUrl.startsWith("/") &&
    !rawUrl.startsWith("//") &&
    !rawUrl.includes("\\")
  ) {
    return rawUrl;
  }
  return "/dashboard";
}
