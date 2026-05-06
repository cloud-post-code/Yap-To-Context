export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  /* Avoid static analysis pulling Node-only db code into Edge/middleware bundles. */
  const { runMigrations, seedRootFolders } = await import(
    /* webpackIgnore: true */
    "./db/bootstrap"
  );
  await runMigrations();
  await seedRootFolders();
}
