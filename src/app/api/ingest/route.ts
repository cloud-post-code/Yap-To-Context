import path from "path";
import fs from "fs";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NextRequest } from "next/server";
import { assertAuthorized } from "@/lib/auth";
import { getAudioStoragePath } from "@/lib/env";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { buildFolderPathManifest, loadAllFolders } from "@/lib/folder-paths";
import { extractStructuredNotes, transcribeAudioFile } from "@/lib/openai-extract";
import { processExtractions } from "@/lib/process-ingest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const denied = await assertAuthorized(req);
  if (denied) return denied;

  const form = await req.formData();
  const audio = form.get("audio");
  const textField = form.get("text");

  const db = getDb();
  const transcriptId = uuidv4();

  try {
    let transcriptText = "";

    if (audio instanceof File && audio.size > 0) {
      const buf = Buffer.from(await audio.arrayBuffer());
      const orig = audio.name || "recording.webm";
      const ext = path.extname(orig) || ".webm";
      const base = `${uuidv4()}${ext}`;
      const dir = getAudioStoragePath();
      fs.mkdirSync(dir, { recursive: true });
      const abs = path.join(dir, base);
      fs.writeFileSync(abs, buf);
      const audioRelpath = path.relative(process.cwd(), abs);

      await db.insert(schema.transcripts).values({
        id: transcriptId,
        audioRelpath,
        text: null,
        status: "pending",
        createdAt: new Date(),
      });

      transcriptText = await transcribeAudioFile({ buffer: buf, filename: orig });

      await db
        .update(schema.transcripts)
        .set({ text: transcriptText, status: "transcribed" })
        .where(eq(schema.transcripts.id, transcriptId));
    } else if (typeof textField === "string" && textField.trim().length > 0) {
      transcriptText = textField.trim();

      await db.insert(schema.transcripts).values({
        id: transcriptId,
        audioRelpath: "",
        text: transcriptText,
        status: "transcribed",
        createdAt: new Date(),
      });
    } else {
      return Response.json(
        { error: "Provide multipart field `audio` (file) or `text` (string)." },
        { status: 400 },
      );
    }

    const jobId = uuidv4();
    await db.insert(schema.ingestJobs).values({
      id: jobId,
      transcriptId,
      model: "gpt-4o-mini",
      rawLlmJson: null,
      status: "processing",
      createdAt: new Date(),
    });

    const manifest = buildFolderPathManifest(await loadAllFolders());
    const payload = await extractStructuredNotes({
      transcript: transcriptText,
      folderManifest: manifest,
    });

    await db
      .update(schema.ingestJobs)
      .set({
        rawLlmJson: JSON.stringify(payload),
        status: "completed",
      })
      .where(eq(schema.ingestJobs.id, jobId));

    await processExtractions({ transcriptId, payload });

    await db
      .update(schema.transcripts)
      .set({ status: "processed" })
      .where(eq(schema.transcripts.id, transcriptId));

    return Response.json({
      transcriptId,
      transcript: transcriptText,
      extractions: payload.extractions.length,
    });
  } catch (e) {
    try {
      await db
        .update(schema.transcripts)
        .set({ status: "error" })
        .where(eq(schema.transcripts.id, transcriptId));
    } catch {
      /* row may not exist */
    }

    const message = e instanceof Error ? e.message : "Ingest failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
