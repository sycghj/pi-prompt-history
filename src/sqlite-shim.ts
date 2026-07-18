// node:sqlite shim matching the subset of bun:sqlite's `Database` API used by db.ts.
// Replaces `import { Database } from "bun:sqlite"` so this extension runs under Node.
//
// bun:sqlite surface used by db.ts:
//   new Database(path, { create: true })
//   db.exec(sql)
//   db.prepare(sql) -> { get(...params), all(...params), run(...params) }
//   db.close()
//   db.transaction(fn) -> wrapped fn running inside BEGIN/COMMIT (ROLLBACK on throw)
//
// node:sqlite (DatabaseSync) provides exec/prepare/get/all/run/close natively,
// but NOT `.transaction()`. We implement it with BEGIN/COMMIT/ROLLBACK.
import { DatabaseSync } from "node:sqlite";

export interface DatabaseOptions {
  create?: boolean;
  readwrite?: boolean;
}

export class Database {
  private readonly sync: DatabaseSync;

  constructor(path: string, _options?: DatabaseOptions) {
    // node:sqlite DatabaseSync opens read/write + create by default, so the
    // bun-style { create: true } option is satisfied implicitly.
    this.sync = new DatabaseSync(path);
  }

  exec(sql: string): void {
    this.sync.exec(sql);
  }

  prepare(sql: string): ReturnType<DatabaseSync["prepare"]> {
    return this.sync.prepare(sql);
  }

  close(): void {
    this.sync.close();
  }

  // Matches bun:sqlite's Database.transaction(fn): returns a function that, when
  // invoked, runs fn inside a transaction. On thrown error -> ROLLBACK + rethrow.
  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      this.sync.exec("BEGIN");
      try {
        const result = fn(...args);
        this.sync.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          this.sync.exec("ROLLBACK");
        } catch {
          // ignore secondary rollback errors
        }
        throw error;
      }
    }) as T;
  }
}
