import OpenAI from "openai";
import { z } from "zod";
import { extractionJsonSchema } from "@/lib/extraction-json-schema";
import { getOpenAiApiKey } from "@/lib/env";

const extractionSchema = z.object({
  extractions: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
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
  const openai = new OpenAI({ apiKey: getOpenAiApiKey() });
  const file = await OpenAI.toFile(input.buffer, input.filename);
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return result.text?.trim() ?? "";
}

export async function extractStructuredNotes(input: {
  transcript: string;
}): Promise<ExtractionPayload> {
  const openai = new OpenAI({ apiKey: getOpenAiApiKey() });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You turn the transcript into one or more notes: titles, bodies, and brief rationales for how you split them. The user chooses library folders elsewhere — do not assign folders or paths.

Fidelity (non-negotiable): The transcript is the only source of substantive content in title and body. Do not invent or add information the speaker did not say (or type): no new facts, names, numbers, dates, commitments, causes, or details. Do not "helpfully" fill gaps, extrapolate unstated specifics, or treat guesses as facts. Allowed: summarize, split across notes, reorder for clarity, rephrase in your own words, and use markdown (headings, bullets) — still strictly grounded in what appears in the transcript. If the transcript is vague or incomplete, the notes must stay vague or incomplete on that point rather than fabricating precision.

Splitting: Use multiple extractions when the transcript clearly covers separate topics, tasks, or decisions; use a single extraction for one coherent note.

Rules:
- Each extraction is one document (title + body). Body: short, readable markdown; bullets when helpful.
- reasoning_brief: required; one short line (≤120 chars) on split/summary choices only, or "" if obvious. It must not introduce factual claims absent from the transcript.`,
      },
      {
        role: "user",
        content: input.transcript,
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
