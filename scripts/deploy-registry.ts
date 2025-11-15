import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying CoinRegistry contract...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get platform wallet from environment or use deployer
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS || deployer.address;
  console.log("🔑 Platform wallet:", platformWallet);

  if (platformWallet === deployer.address) {
    console.log("⚠️  Warning: Using deployer address as platform wallet");
    console.log("   Consider setting PLATFORM_WALLET_ADDRESS in .env\n");
  }

  // Deploy the contract
  console.log("⏳ Deploying contract...");
  const CoinRegistry = await ethers.getContractFactory("CoinRegistry");
  const registry = await CoinRegistry.deploy(platformWallet);

  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log("✅ CoinRegistry deployed to:", address);
  console.log("   Platform wallet:", platformWallet);
  console.log("   Transaction hash:", registry.deploymentTransaction()?.hash);

  // Wait for a few confirmations
  console.log("\n⏳ Waiting for confirmations...");
  await registry.deploymentTransaction()?.wait(5);
  console.log("✅ Confirmed!\n");

  // Display verification command
  console.log("📋 To verify on BaseScan, run:");
  console.log(`   npx hardhat verify --network base ${address} ${platformWallet}\n`);

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    contract: "CoinRegistry",
    address: address,
    platformWallet: platformWallet,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    txHash: registry.deploymentTransaction()?.hash,
  };

  console.log("📄 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✨ Deployment complete!");
  console.log("\n💡 Next steps:");
  console.log("   1. Add REGISTRY_CONTRACT_ADDRESS to your .env file");
  console.log("   2. Verify the contract on BaseScan");
  console.log("   3. Update your backend to use this registry address");
  console.log("   4. Register your OP Atlas profile with this contract address\n");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
