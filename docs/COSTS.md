# Cost & Free Tier Tracking (docs/COSTS.md)

In accordance with Rule 2 of [AGENTS.md](file:///d:/04_Assessments/badaha/AGENTS.md):
> **Zero-cost, no-card rule**: Never add a service that needs a paid plan or a payment method on file. Every external service sits behind an interface in `src/lib/providers/*`, has a free default, a fake for tests, an on/off flag, and a hard usage cap that returns `QUOTA_EXCEEDED`.

## Provider Quotas & Free Limits

| Service | Free Limit | Our Cap | Behavior at Cap | Where to Check |
| :--- | :--- | :--- | :--- | :--- |
| **Database** (e.g., Neon / Supabase Free) | 500 MB storage / free compute | 450 MB DB storage | Reject large uploads / drop oldest audit records | Provider Dashboard / Health check query |
| **Object Storage** (e.g., Cloudflare R2 / MinIO local) | 10 GB storage, 10M Class B ops/mo | 8 GB storage | Returns `QUOTA_EXCEEDED` on file upload | Storage provider dashboard / Local metrics |
| **Email** (Generic SMTP / Mailpit local / Free tier) | 3,000 emails/mo or vendor free tier | 250 emails/day (30 reserved for security) | Over cap deliveries become deferred and roll over to the next day in priority order (security, deadlines, rest); in-app feed uninterrupted | `notification_deliveries` count / Admin metrics |
| **Compute / Host** (e.g., Vercel / Render Free) | 100k edge invocations / 100 GB-hrs | 80k invocations/mo | Return cached static responses / light SSR | Vercel usage dashboard |
| **LLM Inference** (e.g., Groq / Gemini Free Tier) | Free tier rate limits (e.g. RPM / TPM) | 70% of vendor free TPM | Return `QUOTA_EXCEEDED`; fallback to offline templates | Provider API token usage counter |

*Note: As new providers are introduced in `src/lib/providers/*`, update this table with exact vendor limits and internal application caps.*
