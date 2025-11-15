import cron from "node-cron";
import { registryService } from "../lib/registryService";

let registryCronJob: cron.ScheduledTask | null = null;

async function runRegistryBatch() {
  console.log("\n🔄 Starting registry batch job...");
  
  if (!registryService.isConfigured()) {
    console.log("⚠️  Registry service not configured. Skipping batch registration.");
    console.log("   Set REGISTRY_CONTRACT_ADDRESS and PLATFORM_WALLET_PRIVATE_KEY in .env");
    return;
  }

  const isVerified = await registryService.verifyConfiguration();
  if (!isVerified) {
    console.error("❌ Registry configuration verification failed. Skipping batch registration.");
    return;
  }

  try {
    const pending = await registryService.getPendingRegistrations();
    
    if (pending.length === 0) {
      console.log("✅ No pending coins to register");
      return;
    }

    console.log(`📋 Found ${pending.length} pending coins`);

    const BATCH_SIZE = 50;
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} coins)...`);
      
      const result = await registryService.batchRegisterCoins(batch);
      totalSuccess += result.success;
      totalFailed += result.failed;

      if (i + BATCH_SIZE < pending.length) {
        console.log("⏸️  Waiting 10 seconds before next batch...");
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    console.log("\n📊 Registry batch job complete:");
    console.log(`   ✅ Registered: ${totalSuccess}`);
    console.log(`   ❌ Failed: ${totalFailed}`);

    const totalOnChain = await registryService.getTotalRegistrations();
    console.log(`   📈 Total on-chain registrations: ${totalOnChain}\n`);
  } catch (error: any) {
    console.error("❌ Error in registry batch job:", error.message);
  }
}

export async function startRegistryCron() {
  if (registryCronJob) {
    console.log("⚠️  Registry cron job already running");
    return;
  }

  if (!registryService.isConfigured()) {
    console.log("⚠️  Registry service not configured. Cron job will not start.");
    console.log("   Set REGISTRY_CONTRACT_ADDRESS and PLATFORM_WALLET_PRIVATE_KEY to enable on-chain registration.");
    return;
  }

  const isVerified = await registryService.verifyConfiguration();
  if (!isVerified) {
    console.error("❌ Registry configuration verification failed. Cron job will not start.");
    console.error("   Check that REGISTRY_CONTRACT_ADDRESS and PLATFORM_WALLET_PRIVATE_KEY are correct.");
    return;
  }

  const schedule = process.env.REGISTRY_CRON_SCHEDULE || "0 */6 * * *";
  
  registryCronJob = cron.schedule(schedule, async () => {
    await runRegistryBatch();
  });

  console.log(`✅ Registry cron job started with schedule: ${schedule}`);
  console.log(`   (Runs every 6 hours by default, set REGISTRY_CRON_SCHEDULE to change)`);

  runRegistryBatch().catch(console.error);
}

export function stopRegistryCron() {
  if (registryCronJob) {
    registryCronJob.stop();
    registryCronJob = null;
    console.log("🛑 Registry cron job stopped");
  }
}

export async function manualRegistrySync() {
  console.log("🔄 Manual registry sync triggered");
  await runRegistryBatch();
}
