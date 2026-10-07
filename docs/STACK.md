# Technology Stack & Resolved Dependencies

This document records the exact runtime environment and resolved dependency versions pinned at initial scaffolding.

## Runtime & Package Manager
- **Node.js**: `v24.18.0` (Node.js LTS)
- **Package Manager**: `pnpm` `12.9.1`
- **Container Base**: `node:24-alpine`

## Production Dependencies
| Package | Resolved Version | Purpose |
| :--- | :--- | :--- |
| `next` | `16.3.8` | App Router framework with Turbopack |
| `react` | `19.2.8` | UI library |
| `react-dom` | `19.2.8` | React DOM renderer |
| `drizzle-orm` | `0.45.3` | Lightweight, type-safe TypeScript ORM |
| `postgres` | `3.4.9` | High-performance PostgreSQL client (postgres.js) |
| `uuidv7` | `1.2.1` | Time-sortable UUIDv7 generation app-side (Rule 9) |
| `@t3-oss/env-nextjs` | `0.13.11` | Strict runtime & build-time environment validation |
| `zod` | `4.6.5` | Schema validation for env, settings JSONB, and data models |
| `pino` | `10.4.0` | High-performance JSON logging with sensitive field redaction |
| `clsx` | `2.1.1` | Class name constructor utility |
| `tailwind-merge` | `3.7.0` | Conflict-free utility class merging |
| `tailwindcss` | `4.3.3` | Utility-first CSS engine |
| `@tailwindcss/postcss` | `4.3.3` | PostCSS integration for Tailwind v4 |

## Development & Quality Gate Dependencies
| Package | Resolved Version | Purpose |
| :--- | :--- | :--- |
| `@biomejs/biome` | `2.4.2` | Fast formatter and linter |
| `typescript` | `5.9.3` | Typechecker with strict flags enabled |
| `drizzle-kit` | `0.31.11` | Database migration generator and CLI |
| `tsx` | `4.23.15` | Fast TypeScript script executor for migrations & scripts |
| `@types/node` | `24.19.1` | Node.js type definitions matching Node 24 LTS |
| `@types/react` | `19.3.0` | React 19 type definitions |
| `@types/react-dom` | `19.3.0` | React DOM 19 type definitions |
| `@types/pg` | `8.23.1` | Postgres client type definitions |
| `pg` | `8.23.1` | PostgreSQL client for test suites |
| `vitest` | `5.0.3` | Unit and integration test runner |
| `@playwright/test` | `1.63.0` | End-to-end browser testing |
| `dependency-cruiser` | `18.5.0` | Architectural boundary and module boundary validation |
| `dotenv` | `18.0.5` | Environment variable loader for test suites |

## Local Infrastructure (Docker Compose)
- **Database**: PostgreSQL `17` (`postgres:17`)
- **Blob Storage**: MinIO Object Storage (`bitnamilegacy/minio:latest`) with automated bucket provisioning (`lms`)
- **Email Testing**: Mailpit (`axllent/mailpit:latest`) with SMTP (`1025`) and Web UI (`8025`)

## Database Architecture & Supabase Conventions
- **Dedicated Application Schema**: All application tables live strictly in the `lms` Postgres schema via `pgSchema('lms')`.
- **Closed to Supabase Data API**: **Do NOT add `lms` to the exposed schemas of the Supabase Data API** (or PostgREST). Schema `lms` privileges are revoked from `anon` and `authenticated` roles in `scripts/db-bootstrap.sql`, keeping the database isolated and private.
- **Dual Connection Pooler**:
  - `DATABASE_URL`: Transaction-mode pooler (port 6543) used for runtime application queries.
  - `DATABASE_URL_SESSION`: Session-mode pooler (port 5432) used for `drizzle-kit migrate`, `seed`, and schema verification scripts.
- **Client Configuration**: `postgres.js` configured with `prepare: false` (required for transaction poolers), `max: 3` connections per function instance, `connect_timeout: 10s`, and `statement_timeout: 5s`. Reuses a single client instance at module scope.
- **Transactions**: `withTx(fn)` opens transactions and passes a branded `Tx` type to prevent accidental use of raw clients in service layer functions.

## Architectural Constraints
- **Target Deployment**: Vercel (default serverless) or Standalone Docker (`BUILD_STANDALONE=1`).
- **TypeScript Settings**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Module Boundaries**: All cross-module imports must pass through `src/modules/<domain>/index.ts`.

## Storage Architecture & Trade-Offs
- **Primary Storage Provider**: Backblaze B2 via S3-compatible API (MinIO for local development) accessed via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- **Zero Antivirus Residual Risk**: At this zero-cost budget constraint ($0/month, no payment card on file), dedicated real-time cloud antivirus appliances (e.g. ClamAV daemon clusters or commercial scanning APIs) cannot be provisioned. This residual risk is mitigated application-side by:
  1. Strict per-purpose MIME and file-extension allowlists.
  2. Absolute rejection of executables (`.exe`, `.dll`, `.bin`, `.bat`, `.cmd`, `.sh`, `.ps1`), scripts (`.js`, `.ts`, `.php`, `.py`), web markup (`.html`, `.svg`, `.xml`), and macro-enabled Office files (`.docm`, `.xlsm`, `.pptm`).
  3. Asynchronous post-upload magic byte sniffing with `file-type` on initial bytes; mismatched or disallowed types trigger immediate object deletion from storage.
  4. Sandboxed delivery: all private files download with `Content-Disposition: attachment` (except inline PDFs).
- **Public CDN Capability URLs**: Lesson images and avatars utilize 128-bit random `public_key` tokens and are served via `/api/v1/media/[fileId]/[key]` with `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable`. This allows platform CDNs to cache repeat requests to stay within B2 daily read limits. Trade-off: anyone in possession of the 128-bit URL can view the image (identical exposure to an unlisted YouTube video). CDN delivery is strictly forbidden for student submissions, student work, and payment proofs.
- **Video Hosting**: Externalized entirely to unlisted YouTube embeds (`youtube-nocookie.com`) with playback heartbeat reporting. Zero video files are stored in object storage.
