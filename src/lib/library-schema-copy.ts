import { extractionJsonSchema } from "@/lib/extraction-json-schema";

export type LibraryGuide = {
  /** Folder name as stored (matches manifest paths). */
  folderName: string;
  /** Friendly label in UI. */
  label: string;
  purpose: string;
  examplePathsMarkdown: string;
};

/** Default seeded roots plus how ingest mapping works. */
export const ROOT_LIBRARY_GUIDES: LibraryGuide[] = [
  {
    folderName: "Blog",
    label: "Blog",
    purpose:
      "Posts, drafts, and research for publishing. Create subgroups with + under Blog so the model can target full paths like Blog/YourSubgroup.",
    examplePathsMarkdown:
      "`[[\"Blog\"]]` or `[[\"Blog\",\"Drafts\"]]` after you add a **Drafts** subgroup.",
  },
  {
    folderName: "Company",
    label: "Company",
    purpose:
      "Strategy, ops, team notes, and internal context. Subgroups (e.g. Company/Hiring) must exist before ingest can place notes there.",
    examplePathsMarkdown:
      "`[[\"Company\"]]` or `[[\"Company\",\"Roadmap\"]]` once **Roadmap** exists.",
  },
  {
    folderName: "Ideas",
    label: "Ideas",
    purpose:
      "Raw sparks and product thoughts. Add subfolders for themes so paths stay stable.",
    examplePathsMarkdown:
      "`[[\"Ideas\"]]` or `[[\"Ideas\",\"Side projects\"]]`.",
  },
  {
    folderName: "Inbox",
    label: "Inbox",
    purpose:
      "Catch-all when nothing else fits. Ingest uses Inbox when paths do not match or the model cannot pick a manifest path.",
    examplePathsMarkdown: "`[[\"Inbox\"]]`",
  },
];

/** Short summary of the parsed extraction payload (matches Zod schema in openai-extract). */
export const EXTRACTION_PAYLOAD_OVERVIEW = `Each ingest produces JSON with key "extractions": an array of objects:
• title — string, document title
• body — string, short markdown body
• folder_paths — array of paths; each path is string[] from library root to leaf (must match existing folders only)
• reasoning_brief — string (short rationale or empty "")`;

export function extractionJsonSchemaFormatted(): string {
  return JSON.stringify(extractionJsonSchema, null, 2);
}
