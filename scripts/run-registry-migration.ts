import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  const databaseUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not found");
    process.exit(1);
  }

  console.log("🔄 Running registry schema migration...\n");

  const sql = postgres(databaseUrl);

  try {
    // Add registry_status column if it doesn't exist
    await sql`
      ALTER TABLE coins 
      ADD COLUMN IF NOT EXISTS registry_status TEXT DEFAULT 'pending'
    `;

    console.log("✅ Added 'registry_status' column");

    // Update existing coins to pending status
    const result = await sql`
      UPDATE coins 
      SET registry_status = 'pending' 
      WHERE registry_status IS NULL
    `;

    console.log(`✅ Updated ${result.count} existing coins to 'pending' status`);
    console.log("\n🎉 Migration completed successfully!\n");

    await sql.end();
    process.exit(0);

  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
