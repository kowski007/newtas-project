import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import solc from "solc";

dotenv.config();

async function compileContract() {
  console.log("⚙️  Compiling CoinRegistry contract...");
  
  const sourcePath = path.join(process.cwd(), "contracts/CoinRegistry.sol");
  const source = fs.readFileSync(sourcePath, 'utf8');
  
  const input = {
    language: 'Solidity',
    sources: {
      'CoinRegistry.sol': {
        content: source
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
      console.error("❌ Compilation errors:", errors);
      throw new Error("Contract compilation failed");
    }
  }

  const contract = output.contracts['CoinRegistry.sol']['CoinRegistry'];
  console.log("✅ Contract compiled successfully\n");
  
  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object
  };
}

async function main() {
  console.log("🚀 Deploying CoinRegistry to Base Mainnet...\n");

  // Check for required environment variables
  const rpcUrl = process.env.BASE_RPC_URL;
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;

  if (!rpcUrl) {
    throw new Error("BASE_RPC_URL not found in environment");
  }
  if (!privateKey) {
    throw new Error("PLATFORM_PRIVATE_KEY not found in environment");
  }
  if (!platformWallet) {
    throw new Error("PLATFORM_WALLET_ADDRESS not found in environment");
  }

  // Connect to Base mainnet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("📝 Deploying with account:", wallet.address);

  // Get account balance
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === BigInt(0)) {
    throw new Error("Account has no ETH for gas fees. Please fund the deployer wallet.");
  }

  console.log("🔑 Platform wallet will be:", platformWallet);
  console.log("");

  // Compile the contract
  const { abi, bytecode } = await compileContract();

  // Deploy the contract
  console.log("⏳ Deploying contract to Base mainnet...");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  // Deploy with automatic gas estimation
  const contract = await factory.deploy(platformWallet);

  console.log("⏳ Transaction sent:", contract.deploymentTransaction()?.hash);
  console.log("⏳ Waiting for deployment confirmation (this may take 1-2 minutes)...");
  
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log("\n🎉 SUCCESS! Contract deployed to Base Mainnet!");
  console.log("═".repeat(70));
  console.log("📍 Contract Address:", address);
  console.log("🔑 Platform Wallet:", platformWallet);
  console.log("📝 Transaction Hash:", deployTx?.hash);
  console.log("🔗 View on BaseScan:", `https://basescan.org/tx/${deployTx?.hash}`);
  console.log("⛓️  Network: Base Mainnet (Chain ID: 8453)");
  console.log("═".repeat(70));

  // Verify the deployment by calling a view function
  console.log("\n🔍 Verifying deployment...");
  const platformWalletFromContract = await contract.platformWallet();
  const totalCoins = await contract.totalCoins();
  console.log("✅ Platform wallet configured:", platformWalletFromContract);
  console.log("✅ Total coins registered:", totalCoins.toString());

  // Save deployment info
  const deploymentInfo = {
    network: "base-mainnet",
    chainId: 8453,
    contract: "CoinRegistry",
    address: address,
    platformWallet: platformWallet,
    deployer: wallet.address,
    timestamp: new Date().toISOString(),
    txHash: deployTx?.hash,
    verified: false
  };

  const deploymentPath = path.join(process.cwd(), "deployment-mainnet.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment info saved to deployment-mainnet.json");

  console.log("\n📋 NEXT STEPS:");
  console.log("═".repeat(70));
  console.log("1️⃣  Add to Replit Secrets:");
  console.log("   REGISTRY_CONTRACT_ADDRESS=" + address);
  console.log("");
  console.log("2️⃣  Verify contract on BaseScan:");
  console.log(`   npx hardhat verify --network base ${address} ${platformWallet}`);
  console.log(`   Or manually: https://basescan.org/address/${address}#code`);
  console.log("");
  console.log("3️⃣  Remove testnet config and restart application");
  console.log("═".repeat(70));
  console.log("");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
