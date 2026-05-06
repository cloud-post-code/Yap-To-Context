import OpenAI from "openai";
import { z } from "zod";
import { getEffectiveOpenAiKey } from "@/lib/settings";

const extractionSchema = z.object({
  extractions: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      folder_paths: z.array(z.array(z.string())),
      reasoning_brief: z.string().optional(),
    }),
  ),
});

export type ExtractionPayload = z.infer<typeof extractionSchema>;

const jsonSchema = {
  name: "transcript_extractions",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      extractions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            folder_paths: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
            reasoning_brief: { type: "string" },
          },
          required: ["title", "body", "folder_paths"],
        },
      },
    },
    required: ["extractions"],
  },
  strict: true,
} as const;

export async function transcribeAudioFile(input: {
  buffer: Buffer;
  filename: string;
}): Promise<string> {
  const openai = new OpenAI({ apiKey: getEffectiveOpenAiKey() });
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
  const openai = new OpenAI({ apiKey: getEffectiveOpenAiKey() });
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
        content: `You organize voice notes into concise markdown documents and choose folder paths.

Rules:
- Prefer EXISTING paths from the manifest when they fit. Match names case-insensitively when choosing.
- Each extraction becomes ONE document (title + body). Body should be short, readable markdown with bullets where helpful.
- folder_paths is an array of paths; each path is an array of segment names from root to leaf. Use multiple paths ONLY when the same note truly belongs in multiple sections.
- If nothing fits existing folders, propose sensible NEW folders using minimal depth (e.g. ["Ideas","Widgets"]) rather than inventing many branches.
- Do NOT include chain-of-thought; keep reasoning_brief under 120 characters when present.`,
      },
      {
        role: "user",
        content: `Existing folder paths (one per line):\n${manifest}\n\nTranscript:\n${input.transcript}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: jsonSchema },
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
