import { Client } from "pg";
import { describe, expect, it } from "vitest";

describe("postgres integration", () => {
  it("should connect to real postgres and execute a query", async () => {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/lms";

    const client = new Client({ connectionString });
    await client.connect();

    try {
      const result = await client.query(
        "SELECT 1 as num, 'connected' as status",
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.num).toBe(1);
      expect(result.rows[0]?.status).toBe("connected");
    } finally {
      await client.end();
    }
  });
});
