import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔧 Compiling CoinRegistry contract...\n");

  // Read the contract source
  const contractPath = path.join(process.cwd(), "contracts", "CoinRegistry.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  // Compile the contract
  const input = {
    language: "Solidity",
    sources: {
      "CoinRegistry.sol": {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    if (errors.length > 0) {
      console.error("❌ Compilation errors:");
      errors.forEach((err: any) => console.error(err.formattedMessage));
      process.exit(1);
    }
  }

  const compiledContract = output.contracts["CoinRegistry.sol"]["CoinRegistry"];
  const abi = compiledContract.abi;
  const bytecode = compiledContract.evm.bytecode.object;

  console.log("✅ Contract compiled successfully\n");

  // Determine network
  const network = process.argv[2] || "baseSepolia";
  const rpcUrl =
    network === "base"
      ? process.env.BASE_RPC_URL || "https://mainnet.base.org"
      : process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

  const chainId = network === "base" ? 8453 : 84532;

  console.log(`📡 Deploying to ${network} (Chain ID: ${chainId})`);
  console.log(`   RPC: ${rpcUrl}\n`);

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || 
                     process.env.PLATFORM_WALLET_PRIVATE_KEY || 
                     process.env.PLATFORM_PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ Error: No private key found. Set one of:");
    console.error("   - DEPLOYER_PRIVATE_KEY");
    console.error("   - PLATFORM_WALLET_PRIVATE_KEY");
    console.error("   - PLATFORM_PRIVATE_KEY");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const platformWalletAddress = process.env.PLATFORM_WALLET_ADDRESS || wallet.address;

  console.log(`👛 Deployer: ${wallet.address}`);
  console.log(`🏢 Platform Wallet: ${platformWalletAddress}\n`);

  // Get balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error("❌ Error: Deployer wallet has no ETH");
    process.exit(1);
  }

  // Deploy contract
  console.log("🚀 Deploying contract...\n");

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(platformWalletAddress);

  console.log(`⏳ Transaction sent: ${contract.deploymentTransaction()?.hash}`);
  console.log("   Waiting for confirmation...\n");

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("✅ Contract deployed successfully!\n");
  console.log("📋 Deployment Details:");
  console.log(`   Contract Address: ${contractAddress}`);
  console.log(`   Network: ${network}`);
  console.log(`   Chain ID: ${chainId}`);
  console.log(`   Platform Wallet: ${platformWalletAddress}\n`);

  console.log("📝 Next Steps:");
  console.log(`   1. Update .env with:`);
  console.log(`      REGISTRY_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`   2. Verify contract on BaseScan (optional):`);
  console.log(`      npx hardhat verify --network ${network} ${contractAddress} ${platformWalletAddress}`);
  console.log(`   3. Restart your application to start using the registry\n`);

  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    network,
    chainId,
    platformWalletAddress,
    deployedAt: new Date().toISOString(),
    deploymentTxHash: contract.deploymentTransaction()?.hash,
  };

  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(deploymentsDir, `${network}-registry.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log(`💾 Deployment info saved to: ${deploymentFile}\n`);

  // Save ABI
  const abiFile = path.join(deploymentsDir, "CoinRegistry-abi.json");
  fs.writeFileSync(abiFile, JSON.stringify(abi, null, 2));
  console.log(`📄 ABI saved to: ${abiFile}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
