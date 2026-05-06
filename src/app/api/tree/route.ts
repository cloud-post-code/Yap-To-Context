import { buildFolderTree } from "@/lib/tree-build";

export const runtime = "nodejs";

export async function GET() {
  const tree = buildFolderTree();
  return Response.json({ tree });
}
