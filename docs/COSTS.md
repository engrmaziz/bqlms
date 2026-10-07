# Cost & Free Tier Tracking (docs/COSTS.md)

In accordance with Rule 2 of [AGENTS.md](file:///d:/04_Assessments/badaha/AGENTS.md):
> **Zero-cost, no-card rule**: Never add a service that needs a paid plan or a payment method on file. Every external service sits behind an interface in `src/lib/providers/*`, has a free default, a fake for tests, an on/off flag, and a hard usage cap that returns `QUOTA_EXCEEDED`.

## Provider Quotas & Free Limits

| Service | Free Limit | Our Cap | Behavior at Cap | Where to Check |
| :--- | :--- | :--- | :--- | :--- |
| **Database** (e.g., Neon / Supabase Free) | 500 MB storage / free compute | 450 MB DB storage | Reject large uploads / drop oldest audit records | Provider Dashboard / Health check query |
| **Object Storage** (Backblaze B2 S3 / MinIO local) | 10 GB storage, 1 GB/day download bandwidth, 2,500 Class B calls/day | 8 GB storage, 2,000 reads/day | Uploads return `QUOTA_EXCEEDED` when total live storage exceeds 8 GB; downloads return `QUOTA_EXCEEDED` ("Storage daily read cap exceeded. Please try again tomorrow.") when daily read ops exceed 2,000 | `storage_reads` table / Admin system metrics |
| **Email** (Generic SMTP / Mailpit local / Free tier) | 3,000 emails/mo or vendor free tier | 250 emails/day (30 reserved for security) | Over cap deliveries become deferred and roll over to the next day in priority order (security, deadlines, rest); in-app feed uninterrupted | `notification_deliveries` count / Admin metrics |
| **Compute / Host** (e.g., Vercel / Render Free) | 100k edge invocations / 100 GB-hrs | 80k invocations/mo | Return cached static responses / light SSR | Vercel usage dashboard |
| **LLM Inference** (e.g., Groq / Gemini Free Tier) | Free tier rate limits (e.g. RPM / TPM) | 70% of vendor free TPM | Return `QUOTA_EXCEEDED`; fallback to offline templates | Provider API token usage counter |

*Note: As new providers are introduced in `src/lib/providers/*`, update this table with exact vendor limits and internal application caps.*
