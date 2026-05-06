import { v4 as uuidv4 } from "uuid";
import { getDb, requireInboxFolderId } from "@/db/client";
import * as schema from "@/db/schema";
import { loadAllFolders, resolveFolderPath } from "@/lib/folder-paths";
import type { ExtractionPayload } from "@/lib/openai-extract";

export async function processExtractions(input: {
  transcriptId: string;
  payload: ExtractionPayload;
}) {
  const db = getDb();
  const inboxId = await requireInboxFolderId();
  const snapshot = await loadAllFolders();

  await db.transaction(async (tx) => {
    for (const ext of input.payload.extractions) {
      const docId = uuidv4();
      await tx.insert(schema.documents).values({
        id: docId,
        title: ext.title,
        body: ext.body,
        sourceTranscriptId: input.transcriptId,
        createdAt: new Date(),
      });

      const resolved = new Set<string>();

      const normalizedPaths =
        ext.folder_paths.length > 0 ? ext.folder_paths : [["Inbox"]];

      for (const path of normalizedPaths) {
        const res = resolveFolderPath(snapshot, path);
        if (res.kind === "resolved") {
          resolved.add(res.leafFolderId);
        } else if (res.segmentsToCreate.length > 0 && res.parentFolderId !== null) {
          resolved.add(res.parentFolderId);
        }
      }

      if (resolved.size > 0) {
        for (const fid of resolved) {
          await tx
            .insert(schema.documentFolders)
            .values({ documentId: docId, folderId: fid })
            .onConflictDoNothing();
        }
      } else {
        await tx
          .insert(schema.documentFolders)
          .values({ documentId: docId, folderId: inboxId })
          .onConflictDoNothing();
      }
    }
  });
}
