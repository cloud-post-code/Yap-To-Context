import OpenAI from "openai";
import { z } from "zod";
import { extractionJsonSchema } from "@/lib/extraction-json-schema";
import { getEffectiveOpenAiKey } from "@/lib/settings";

const extractionSchema = z.object({
  extractions: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      folder_paths: z.array(z.array(z.string())),
      reasoning_brief: z.string(),
    }),
  ),
});

export type ExtractionPayload = z.infer<typeof extractionSchema>;

export { extractionJsonSchema } from "@/lib/extraction-json-schema";

export async function transcribeAudioFile(input: {
  buffer: Buffer;
  filename: string;
}): Promise<string> {
  const openai = new OpenAI({ apiKey: await getEffectiveOpenAiKey() });
  const file = await OpenAI.toFile(input.buffer, input.filename);
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return result.text?.trim() ?? "";
}

export async function extractStructuredNotes(input: {
  transcript: string;
  folderManifest: string;
}): Promise<ExtractionPayload> {
  const openai = new OpenAI({ apiKey: await getEffectiveOpenAiKey() });
  const manifest =
    input.folderManifest.trim().length > 0
      ? input.folderManifest
      : "(no folders yet)";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You fully automate organizing the transcript: decide how many notes to create, write each note, and choose library folders — no questions to the user.

Splitting: Use multiple extractions when the transcript clearly covers separate topics, tasks, or decisions; use a single extraction for one coherent note.
Placement: For each extraction, pick the best matching path(s) from the manifest using meaning (not keywords only). You choose — the user does not.

Rules:
- You MUST NOT invent folders. Every segment in every folder_paths entry must exist in the manifest (match case-insensitively, trim whitespace). Paths are root-to-leaf exactly as listed.
- Each extraction is one document (title + body). Body: short, readable markdown; bullets when helpful.
- folder_paths: array of paths; each path is segment names from root to leaf. Multiple paths only when the same note truly belongs in more than one place.
- If nothing fits, use folder_paths [["Inbox"]] only.
- reasoning_brief: required; one short line (≤120 chars) on split/placement choices, or "" if obvious.`,
      },
      {
        role: "user",
        content: `Existing folder paths (one per line):\n${manifest}\n\nTranscript:\n${input.transcript}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: extractionJsonSchema },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty model response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Model returned invalid JSON");
  }

  return extractionSchema.parse(parsed);
}
