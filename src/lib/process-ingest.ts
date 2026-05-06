import { and, eq, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb, requireInboxFolderId } from "@/db/client";
import * as schema from "@/db/schema";
import { loadAllFolders, resolveFolderPath } from "@/lib/folder-paths";
import type { ExtractionPayload } from "@/lib/openai-extract";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function proposalLookupKey(
  parentFolderId: string | null,
  segments: string[],
) {
  return `${parentFolderId ?? "__root__"}|${segments.join("/")}`;
}

function findPendingProposal(
  tx: Tx,
  transcriptId: string,
  parentFolderId: string | null,
  segmentsJson: string,
) {
  const conditions =
    parentFolderId === null
      ? and(
          eq(schema.folderProposals.transcriptId, transcriptId),
          eq(schema.folderProposals.status, "pending"),
          eq(schema.folderProposals.segmentsJson, segmentsJson),
          isNull(schema.folderProposals.parentFolderId),
        )
      : and(
          eq(schema.folderProposals.transcriptId, transcriptId),
          eq(schema.folderProposals.status, "pending"),
          eq(schema.folderProposals.segmentsJson, segmentsJson),
          eq(schema.folderProposals.parentFolderId, parentFolderId),
        );

  return tx.select().from(schema.folderProposals).where(conditions).get();
}

export function processExtractions(input: {
  transcriptId: string;
  payload: ExtractionPayload;
}) {
  const db = getDb();
  const inboxId = requireInboxFolderId();
  const snapshot = loadAllFolders();

  db.transaction((tx) => {
    const proposalCache = new Map<string, string>();

    for (const ext of input.payload.extractions) {
      const docId = uuidv4();
      tx.insert(schema.documents)
        .values({
          id: docId,
          title: ext.title,
          body: ext.body,
          sourceTranscriptId: input.transcriptId,
          createdAt: new Date(),
        })
        .run();

      const resolved = new Set<string>();
      const proposalsForDoc = new Set<string>();

      const normalizedPaths =
        ext.folder_paths.length > 0 ? ext.folder_paths : [["Inbox"]];

      for (const path of normalizedPaths) {
        const res = resolveFolderPath(snapshot, path);
        if (res.kind === "resolved") {
          resolved.add(res.leafFolderId);
        } else {
          if (res.segmentsToCreate.length === 0) continue;
          const sjson = JSON.stringify(res.segmentsToCreate);
          const pkey = proposalLookupKey(res.parentFolderId, res.segmentsToCreate);
          let proposalId = proposalCache.get(pkey);
          if (!proposalId) {
            const existing = findPendingProposal(
              tx,
              input.transcriptId,
              res.parentFolderId,
              sjson,
            );
            if (existing) {
              proposalId = existing.id;
            } else {
              proposalId = uuidv4();
              tx.insert(schema.folderProposals)
                .values({
                  id: proposalId,
                  transcriptId: input.transcriptId,
                  parentFolderId: res.parentFolderId,
                  segmentsJson: sjson,
                  status: "pending",
                  createdAt: new Date(),
                })
                .run();
            }
            proposalCache.set(pkey, proposalId);
          }
          proposalsForDoc.add(proposalId);
        }
      }

      if (resolved.size > 0) {
        for (const fid of resolved) {
          tx.insert(schema.documentFolders)
            .values({ documentId: docId, folderId: fid })
            .onConflictDoNothing()
            .run();
        }
      }

      if (resolved.size === 0) {
        tx.insert(schema.documentFolders)
          .values({ documentId: docId, folderId: inboxId })
          .onConflictDoNothing()
          .run();
      }

      for (const proposalId of proposalsForDoc) {
        tx.insert(schema.pendingDocumentPlacements)
          .values({
            id: uuidv4(),
            documentId: docId,
            proposalId,
            createdAt: new Date(),
          })
          .run();
      }
    }
  });
}
