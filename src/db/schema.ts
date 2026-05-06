import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sourceTranscriptId: text("source_transcript_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const documentFolders = sqliteTable(
  "document_folders",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.documentId, t.folderId] }),
  }),
);

export const transcripts = sqliteTable("transcripts", {
  id: text("id").primaryKey(),
  audioRelpath: text("audio_relpath").notNull(),
  text: text("text"),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const ingestJobs = sqliteTable("ingest_jobs", {
  id: text("id").primaryKey(),
  transcriptId: text("transcript_id")
    .notNull()
    .references(() => transcripts.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  rawLlmJson: text("raw_llm_json"),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const folderProposals = sqliteTable("folder_proposals", {
  id: text("id").primaryKey(),
  transcriptId: text("transcript_id")
    .notNull()
    .references(() => transcripts.id, { onDelete: "cascade" }),
  /** Null means create new top-level folder segments under the library root (parent_id NULL). */
  parentFolderId: text("parent_folder_id").references(() => folders.id),
  segmentsJson: text("segments_json").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const pendingDocumentPlacements = sqliteTable(
  "pending_document_placements",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => folderProposals.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
