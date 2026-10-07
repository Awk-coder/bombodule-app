/// <reference types="node" />
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1 } from "./worker";

/** An in-memory SQLite database behind the slice of the D1 API the worker uses. */
export function testDb(): D1 {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      let args: (string | number | null)[] = [];
      const bound = {
        bind(...a: (string | number | null)[]) {
          args = a;
          return bound;
        },
        async first<T>() {
          return (stmt.get(...args) ?? null) as T | null;
        },
        async all<T>() {
          return { results: stmt.all(...args) as T[] };
        },
        async run() {
          stmt.run(...args);
          return {};
        },
      };
      return bound;
    },
  };
}
