import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import { and, eq, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import * as schema from "./schema";
import { getSqlitePath } from "@/lib/env";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __yap_sqlite: Database.Database | undefined;
  var __yap_db: DbClient | undefined;
}

function connect(): DbClient {
  const sqlitePath = getSqlitePath();
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  if (!globalThis.__yap_sqlite) {
    const raw = new Database(sqlitePath);
    raw.pragma("journal_mode = WAL");
    raw.pragma("foreign_keys = ON");
    globalThis.__yap_sqlite = raw;
  }

  if (!globalThis.__yap_db) {
    globalThis.__yap_db = drizzle(globalThis.__yap_sqlite, { schema });
  }

  return globalThis.__yap_db;
}

/** Applies DDL once (MVP migration without drizzle migrate runner). */
function migrateSqlite(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY NOT NULL,
      parent_id TEXT REFERENCES folders(id),
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY NOT NULL,
      audio_relpath TEXT NOT NULL,
      text TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      source_transcript_id TEXT REFERENCES transcripts(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS document_folders (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, folder_id)
    );
    CREATE TABLE IF NOT EXISTS ingest_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      raw_llm_json TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS folder_proposals (
      id TEXT PRIMARY KEY NOT NULL,
      transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
      parent_folder_id TEXT REFERENCES folders(id),
      segments_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_document_placements (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      proposal_id TEXT NOT NULL REFERENCES folder_proposals(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_transcript_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON folder_proposals(status);
  `);
}

function seedIfEmpty(db: DbClient) {
  const raw = globalThis.__yap_sqlite!;
  const cnt = raw.prepare("SELECT COUNT(*) AS c FROM folders").get() as {
    c: number;
  };
  if (cnt.c > 0) return;

  const now = new Date();
  const roots = ["Company", "Blog", "Ideas", "Inbox"] as const;
  for (const name of roots) {
    db.insert(schema.folders)
      .values({
        id: uuidv4(),
        parentId: null,
        name,
        createdAt: now,
      })
      .run();
  }
}

export function getDb(): DbClient {
  const db = connect();
  const raw = globalThis.__yap_sqlite!;
  migrateSqlite(raw);
  seedIfEmpty(db);
  return db;
}

export function getRootFolderIdByName(name: string): string | undefined {
  const db = getDb();
  const row = db
    .select()
    .from(schema.folders)
    .where(and(isNull(schema.folders.parentId), eq(schema.folders.name, name)))
    .get();
  return row?.id;
}

export function requireInboxFolderId(): string {
  const id = getRootFolderIdByName("Inbox");
  if (!id) throw new Error("Inbox folder missing");
  return id;
}
