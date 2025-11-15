import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

router.post("/migrate-registry-schema", async (req, res) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔄 Running registry schema migration...");

    // Add registry_status column
    const { error: error1 } = await supabase.rpc("exec_sql", {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'coins' AND column_name = 'registry_status'
          ) THEN
            ALTER TABLE coins ADD COLUMN registry_status TEXT DEFAULT 'pending';
            UPDATE coins SET registry_status = 'pending' WHERE registry_status IS NULL;
          END IF;
        END $$;
      `
    });

    if (error1) {
      console.error("❌ Migration failed:", error1);
      return res.status(500).json({ 
        error: "Migration failed", 
        details: error1.message 
      });
    }

    console.log("✅ Registry schema migration completed");
    res.json({ 
      success: true, 
      message: "Registry schema updated successfully" 
    });

  } catch (error: any) {
    console.error("❌ Migration error:", error);
    res.status(500).json({ 
      error: "Migration error", 
      message: error.message 
    });
  }
});

export default router;
