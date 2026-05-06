import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import type { ExtractionPayload } from "@/lib/openai-extract";

export async function processExtractions(input: {
  transcriptId: string;
  payload: ExtractionPayload;
  targetFolderIds: string[];
}) {
  const db = getDb();
  const folderIds = [...new Set(input.targetFolderIds)];

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

      for (const fid of folderIds) {
        await tx
          .insert(schema.documentFolders)
          .values({ documentId: docId, folderId: fid })
          .onConflictDoNothing();
      }
    }
  });
}
