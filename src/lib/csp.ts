import crypto from "node:crypto";

export interface CspResult {
  nonce: string;
  cspHeader: string;
}

export function generateCsp(): CspResult {
  const nonce = crypto.randomBytes(16).toString("base64");

  const connectSrcAllowlist = process.env.CSP_CONNECT_SRC
    ? ` ${process.env.CSP_CONNECT_SRC}`
    : "";
  const frameSrcAllowlist = process.env.CSP_FRAME_SRC
    ? ` ${process.env.CSP_FRAME_SRC}`
    : "";

  const isDev = process.env.NODE_ENV !== "production";

  const scriptDirectives = isDev
    ? `'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const cspHeader = [
    "default-src 'self'",
    `script-src ${scriptDirectives} https://www.youtube.com https://s.ytimg.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `connect-src 'self'${connectSrcAllowlist}${isDev ? " ws: http:" : ""}`,
    `frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com${frameSrcAllowlist}`,
    "upgrade-insecure-requests",
  ].join("; ");

  return { nonce, cspHeader };
}
