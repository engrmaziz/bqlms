import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "@/db/client";
import type * as schema from "@/db/schema";

export type Schema = typeof schema;

export type BaseTx = PgTransaction<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

declare const TxBrand: unique symbol;
export type Tx = BaseTx & { readonly [TxBrand]: true };

export async function withTx<T>(
  fn: (tx: Tx) => Promise<T>,
  existingTx?: Tx,
): Promise<T> {
  if (existingTx) {
    return fn(existingTx);
  }
  return db.transaction(async (rawTx) => {
    return fn(rawTx as unknown as Tx);
  });
}
