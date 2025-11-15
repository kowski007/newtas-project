
import { run } from "hardhat";

async function main() {
  const CONTRACT_ADDRESS = "0x2ea259ccD2e983f9E635f138b28655d62127F6Bb";
  const PLATFORM_WALLET = "0xd657131ed517c53eabaeb2f0ee66de91c40ed74b";

  console.log("🔍 Verifying CoinRegistry contract on BaseScan...\n");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("Constructor Args:", PLATFORM_WALLET);
  console.log("");

  try {
    await run("verify:verify", {
      address: CONTRACT_ADDRESS,
      constructorArguments: [PLATFORM_WALLET],
      network: "base"
    });

    console.log("\n✅ Contract verified successfully!");
    console.log(`🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("\n✅ Contract is already verified!");
      console.log(`🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
    } else {
      console.error("\n❌ Verification failed:", error.message);
      console.log("\n💡 Try verifying manually at:");
      console.log(`   https://basescan.org/verifyContract?a=${CONTRACT_ADDRESS}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
