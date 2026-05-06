export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runMigrations, seedRootFolders } = await import("@/db/bootstrap");
  await runMigrations();
  await seedRootFolders();
}
