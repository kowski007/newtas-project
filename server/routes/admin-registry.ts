import { Router } from "express";
import { registryService } from "../lib/registryService";
import { createClient } from "@supabase/supabase-js";

export function registerAdminRegistryRoutes(app: Router) {
  // Get registry statistics
  app.get("/api/admin/registry-stats", async (req, res) => {
    try {
      const contractAddress = process.env.REGISTRY_CONTRACT_ADDRESS;
      const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;

      if (!contractAddress) {
        return res.json({
          contractAddress: null,
          platformWallet: null,
          totalOnChain: 0,
          pending: 0,
          registering: 0,
          failed: 0,
          recentRegistrations: []
        });
      }

      // Get on-chain total
      const totalOnChain = await registryService.getTotalRegistrations();

      // Get database stats
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase not configured");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Count by status
      const { data: statusCounts } = await supabase
        .from("coins")
        .select("registry_status")
        .not("registry_status", "is", null);

      const pending = statusCounts?.filter(c => c.registry_status === 'pending').length || 0;
      const registering = statusCounts?.filter(c => c.registry_status === 'registering').length || 0;
      const failed = statusCounts?.filter(c => 
        c.registry_status === 'failed' || c.registry_status === 'failed_permanent'
      ).length || 0;

      // Get recent successful registrations
      const { data: recentRegistrations } = await supabase
        .from("coins")
        .select("id, name, symbol, address, registry_status, registry_tx_hash, registered_at")
        .eq("registry_status", "registered")
        .not("registry_tx_hash", "is", null)
        .order("registered_at", { ascending: false })
        .limit(20);

      res.json({
        contractAddress,
        platformWallet,
        totalOnChain,
        pending,
        registering,
        failed,
        recentRegistrations: recentRegistrations || []
      });
    } catch (error: any) {
      console.error("Error fetching registry stats:", error);
      res.status(500).json({ 
        error: "Failed to fetch registry stats",
        message: error.message 
      });
    }
  });
}
