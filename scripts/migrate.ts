import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

/** Applies db/schema.sql statement by statement. Safe to run more than once. */
async function migrate(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  const statements = schema
    .split(";")
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter((statement) => statement.length > 0);
  for (const statement of statements) await sql.query(statement);
  process.stdout.write(`Applied ${statements.length} statements\n`);
}

migrate().catch((error: unknown) => {
  process.stderr.write(`Migration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
