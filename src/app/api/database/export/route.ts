import { NextRequest } from "next/server";
import { assertAuthorized } from "@/lib/auth";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await assertAuthorized(req);
  if (denied) return denied;

  const db = getDb();

  const [
    folders,
    transcripts,
    documents,
    documentFolders,
    ingestJobs,
    folderProposals,
    pendingDocumentPlacements,
  ] = await Promise.all([
    db.select().from(schema.folders),
    db.select().from(schema.transcripts),
    db.select().from(schema.documents),
    db.select().from(schema.documentFolders),
    db.select().from(schema.ingestJobs),
    db.select().from(schema.folderProposals),
    db.select().from(schema.pendingDocumentPlacements),
  ]);

  const exportedAt = new Date().toISOString();
  const payload = {
    meta: {
      formatVersion: 1 as const,
      exportedAt,
      app: "yap-to-context",
    },
    folders,
    transcripts,
    documents,
    documentFolders,
    ingestJobs,
    folderProposals,
    pendingDocumentPlacements,
  };

  const filename = `yap-database-export-${exportedAt.slice(0, 19).replace(/:/g, "-")}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
