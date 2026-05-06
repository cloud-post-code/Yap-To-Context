import { defineConfig } from "drizzle-kit";
import path from "path";

const sqlitePath =
  process.env.SQLITE_PATH?.trim() || path.join(process.cwd(), "data", "app.db");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: sqlitePath },
});
