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
| `@t3-oss/env-nextjs` | `0.13.11` | Strict runtime & build-time environment validation |
| `zod` | `4.6.5` | Schema validation for env and data models |
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
| `@types/node` | `24.19.1` | Node.js type definitions matching Node 24 LTS |
| `@types/react` | `19.3.0` | React 19 type definitions |
| `@types/react-dom` | `19.3.0` | React DOM 19 type definitions |
| `@types/pg` | `8.23.1` | Postgres client type definitions |
| `pg` | `8.23.1` | PostgreSQL client for integration testing |
| `vitest` | `5.0.3` | Unit and integration test runner |
| `@playwright/test` | `1.63.0` | End-to-end browser testing |
| `dependency-cruiser` | `18.5.0` | Architectural boundary and module boundary validation |
| `dotenv` | `18.0.5` | Environment variable loader for test suites |

## Local Infrastructure (Docker Compose)
- **Database**: PostgreSQL `17` (`postgres:17`)
- **Blob Storage**: MinIO Object Storage (`bitnamilegacy/minio:latest`) with automated bucket provisioning (`lms`)
- **Email Testing**: Mailpit (`axllent/mailpit:latest`) with SMTP (`1025`) and Web UI (`8025`)

## Architectural Constraints
- **Target Deployment**: Vercel (default serverless) or Standalone Docker (`BUILD_STANDALONE=1`).
- **TypeScript Settings**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Module Boundaries**: All cross-module imports must pass through `src/modules/<domain>/index.ts`.
