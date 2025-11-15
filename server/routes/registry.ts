import { Router } from "express";
import { registryService } from "../lib/registryService";
import { manualRegistrySync } from "../cron/registryCron";

const router = Router();

router.get("/registry/status", async (req, res) => {
  try {
    const isConfigured = registryService.isConfigured();
    
    if (!isConfigured) {
      return res.json({
        configured: false,
        message: "Registry contract not configured. Set REGISTRY_CONTRACT_ADDRESS and PLATFORM_WALLET_PRIVATE_KEY in .env"
      });
    }

    const totalOnChain = await registryService.getTotalRegistrations();
    const pending = await registryService.getPendingRegistrations();

    res.json({
      configured: true,
      totalOnChain,
      pendingCount: pending.length,
      contractAddress: process.env.REGISTRY_CONTRACT_ADDRESS
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/registry/sync", async (req, res) => {
  try {
    if (!registryService.isConfigured()) {
      return res.status(400).json({ 
        error: "Registry contract not configured" 
      });
    }

    manualRegistrySync().catch(console.error);

    res.json({ 
      message: "Registry sync started in background" 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/registry/pending", async (req, res) => {
  try {
    const pending = await registryService.getPendingRegistrations();
    res.json({ pending });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/registry/check/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!registryService.isConfigured()) {
      return res.status(400).json({ 
        error: "Registry contract not configured" 
      });
    }

    const isRegistered = await registryService.isRegistered(address);
    const details = isRegistered 
      ? await registryService.getRegistrationDetails(address)
      : null;

    res.json({
      address,
      isRegistered,
      details
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
