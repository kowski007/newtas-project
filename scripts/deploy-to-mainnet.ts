import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

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

  // Read the compiled contract
  const contractPath = path.join(process.cwd(), "artifacts/contracts/CoinRegistry.sol/CoinRegistry.json");
  
  if (!fs.existsSync(contractPath)) {
    console.log("❌ Contract not compiled. Compiling now...");
    const solcPath = path.join(process.cwd(), "node_modules/solc");
    if (!fs.existsSync(solcPath)) {
      throw new Error("solc not installed. Run: npm install solc");
    }
    
    // Read source file
    const sourcePath = path.join(process.cwd(), "contracts/CoinRegistry.sol");
    const source = fs.readFileSync(sourcePath, 'utf8');
    
    // Compile with solc
    const solc = require('solc');
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

    console.log("⚙️  Compiling contract...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
      const errors = output.errors.filter((e: any) => e.severity === 'error');
      if (errors.length > 0) {
        console.error("Compilation errors:", errors);
        throw new Error("Contract compilation failed");
      }
    }

    const contract = output.contracts['CoinRegistry.sol']['CoinRegistry'];
    
    // Create artifacts directory
    const artifactsDir = path.join(process.cwd(), "artifacts/contracts/CoinRegistry.sol");
    fs.mkdirSync(artifactsDir, { recursive: true });
    
    // Save compiled contract
    fs.writeFileSync(
      contractPath,
      JSON.stringify({
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object
      }, null, 2)
    );
    
    console.log("✅ Contract compiled successfully\n");
  }

  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const { abi, bytecode } = contractJson;

  // Deploy the contract
  console.log("⏳ Deploying contract to Base mainnet...");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(platformWallet);

  console.log("⏳ Waiting for deployment transaction to be mined...");
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log("\n🎉 SUCCESS! Contract deployed to Base Mainnet!");
  console.log("═".repeat(60));
  console.log("📍 Contract Address:", address);
  console.log("🔑 Platform Wallet:", platformWallet);
  console.log("📝 Transaction Hash:", deployTx?.hash);
  console.log("⛓️  Network: Base Mainnet (Chain ID: 8453)");
  console.log("═".repeat(60));

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
  };

  const deploymentPath = path.join(process.cwd(), "deployment-mainnet.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment info saved to deployment-mainnet.json");

  console.log("\n📋 Next Steps:");
  console.log("1. Update REGISTRY_CONTRACT_ADDRESS in Replit Secrets:");
  console.log(`   ${address}`);
  console.log("\n2. Verify the contract on BaseScan:");
  console.log(`   npx hardhat verify --network base ${address} ${platformWallet}`);
  console.log(`   Or visit: https://basescan.org/address/${address}#code`);
  console.log("\n3. Update your registry service to use mainnet");
  console.log("4. Restart your application\n");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
