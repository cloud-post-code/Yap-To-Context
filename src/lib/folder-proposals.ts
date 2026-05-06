import { and, eq, inArray, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb, requireInboxFolderId } from "@/db/client";
import * as schema from "@/db/schema";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function findChildFolder(
  tx: Tx,
  parentId: string | null,
  name: string,
) {
  const trimmed = name.trim();
  const candidates = tx
    .select()
    .from(schema.folders)
    .where(
      parentId === null
        ? isNull(schema.folders.parentId)
        : eq(schema.folders.parentId, parentId),
    )
    .all();
  const lower = trimmed.toLowerCase();
  return candidates.find((f) => f.name.trim().toLowerCase() === lower);
}

function detachFromInbox(tx: Tx, documentId: string, inboxId: string) {
  const rows = tx
    .select()
    .from(schema.documentFolders)
    .where(eq(schema.documentFolders.documentId, documentId))
    .all();
  const hasNonInbox = rows.some((r) => r.folderId !== inboxId);
  if (!hasNonInbox) return;

  tx.delete(schema.documentFolders)
    .where(
      and(
        eq(schema.documentFolders.documentId, documentId),
        eq(schema.documentFolders.folderId, inboxId),
      ),
    )
    .run();
}

export function approveFolderProposals(proposalIds: string[]) {
  if (proposalIds.length === 0) return { approved: 0 };
  const db = getDb();
  const inboxId = requireInboxFolderId();

  db.transaction((tx) => {
    for (const proposalId of proposalIds) {
      const p = tx
        .select()
        .from(schema.folderProposals)
        .where(eq(schema.folderProposals.id, proposalId))
        .get();
      if (!p || p.status !== "pending") continue;

      let segments: string[];
      try {
        segments = JSON.parse(p.segmentsJson) as string[];
      } catch {
        continue;
      }
      if (!Array.isArray(segments) || segments.length === 0) continue;

      let parentId: string | null = p.parentFolderId;

      for (const seg of segments) {
        const trimmed = String(seg).trim();
        if (!trimmed) continue;

        const found = findChildFolder(tx, parentId, trimmed);
        if (found) {
          parentId = found.id;
          continue;
        }

        const nid = uuidv4();
        tx.insert(schema.folders)
          .values({
            id: nid,
            parentId,
            name: trimmed,
            createdAt: new Date(),
          })
          .run();
        parentId = nid;
      }

      const leafId = parentId;
      if (!leafId) continue;

      const pendings = tx
        .select()
        .from(schema.pendingDocumentPlacements)
        .where(eq(schema.pendingDocumentPlacements.proposalId, proposalId))
        .all();

      for (const row of pendings) {
        tx.insert(schema.documentFolders)
          .values({ documentId: row.documentId, folderId: leafId })
          .onConflictDoNothing()
          .run();
        detachFromInbox(tx, row.documentId, inboxId);
        tx.delete(schema.pendingDocumentPlacements)
          .where(eq(schema.pendingDocumentPlacements.id, row.id))
          .run();
      }

      tx.update(schema.folderProposals)
        .set({ status: "approved" })
        .where(eq(schema.folderProposals.id, proposalId))
        .run();
    }
  });

  return { approved: proposalIds.length };
}

export function rejectFolderProposals(proposalIds: string[]) {
  if (proposalIds.length === 0) return { rejected: 0 };
  const db = getDb();

  db.transaction((tx) => {
    tx.delete(schema.pendingDocumentPlacements)
      .where(inArray(schema.pendingDocumentPlacements.proposalId, proposalIds))
      .run();

    tx.update(schema.folderProposals)
      .set({ status: "rejected" })
      .where(inArray(schema.folderProposals.id, proposalIds))
      .run();
  });

  return { rejected: proposalIds.length };
}
