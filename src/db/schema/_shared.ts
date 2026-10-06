import { integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

export const id = (name = "id") =>
  uuid(name)
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const softDelete = () => ({
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const version = (name = "version") => integer(name).default(1).notNull();
