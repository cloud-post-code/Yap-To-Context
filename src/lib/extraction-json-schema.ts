/** OpenAI `response_format.json_schema` for transcript extractions (shared by API + UI). */
export const extractionJsonSchema = {
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
            reasoning_brief: { type: "string" },
          },
          required: ["title", "body", "reasoning_brief"],
        },
      },
    },
    required: ["extractions"],
  },
  strict: true,
} as const;
