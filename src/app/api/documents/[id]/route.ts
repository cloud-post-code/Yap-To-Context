import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = getDb();

  const doc = db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, id))
    .get();

  if (!doc) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const folders = db
    .select({
      id: schema.folders.id,
      name: schema.folders.name,
    })
    .from(schema.folders)
    .innerJoin(
      schema.documentFolders,
      eq(schema.documentFolders.folderId, schema.folders.id),
    )
    .where(eq(schema.documentFolders.documentId, id))
    .all();

  return Response.json({ document: doc, folders });
}
