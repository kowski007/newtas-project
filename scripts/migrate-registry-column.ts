import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

async function addRegistryStatusColumn() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase credentials not found");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔄 Adding registry_status column to coins table...\n");

  try {
    // First check if column exists
    const { data: columns } = await supabase
      .from("coins")
      .select("*")
      .limit(1);

    if (columns && columns[0] && 'registry_status' in columns[0]) {
      console.log("✅ Column 'registry_status' already exists!");
      process.exit(0);
    }

    // Column doesn't exist, we need to add it via SQL
    // Since Supabase doesn't allow direct ALTER TABLE via client,
    // we'll use a workaround by inserting into a test record
    console.log("📝 Please add the 'registry_status' column manually:");
    console.log("\n1. Go to your Supabase dashboard:");
    console.log(`   https://supabase.com/dashboard/project/${supabaseUrl.match(/https:\/\/([^.]+)/)?.[1]}/editor`);
    console.log("\n2. Run this SQL query:");
    console.log(`
ALTER TABLE coins 
ADD COLUMN IF NOT EXISTS registry_status TEXT DEFAULT 'pending';

UPDATE coins 
SET registry_status = 'pending' 
WHERE registry_status IS NULL;
    `);
    console.log("\n3. Then restart your application\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addRegistryStatusColumn();
