import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();

  const proposals = db
    .select()
    .from(schema.folderProposals)
    .where(eq(schema.folderProposals.status, "pending"))
    .all();

  proposals.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const enriched = proposals.map((p) => {
    let segments: string[] = [];
    try {
      segments = JSON.parse(p.segmentsJson) as string[];
    } catch {
      segments = [];
    }

    const parent = p.parentFolderId
      ? db
          .select({ name: schema.folders.name })
          .from(schema.folders)
          .where(eq(schema.folders.id, p.parentFolderId))
          .get()
      : null;

    const pendingDocs = db
      .select({ documentId: schema.pendingDocumentPlacements.documentId })
      .from(schema.pendingDocumentPlacements)
      .where(eq(schema.pendingDocumentPlacements.proposalId, p.id))
      .all();

    return {
      ...p,
      segments,
      parentName: parent?.name ?? null,
      pendingDocumentCount: pendingDocs.length,
    };
  });

  return Response.json({ proposals: enriched });
}
