export interface KeysetCursor {
  sortValue: string | number;
  id: string;
}

export function encodeCursor(cursor: KeysetCursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(
  cursorString?: string | null,
): KeysetCursor | null {
  if (!cursorString) {
    return null;
  }
  try {
    const json = Buffer.from(cursorString, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      parsed.sortValue !== undefined
    ) {
      return {
        sortValue: parsed.sortValue,
        id: parsed.id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface PaginationParams {
  cursor?: string | null;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
