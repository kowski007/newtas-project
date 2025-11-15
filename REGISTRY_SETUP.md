# Coin Registry Setup Guide

This guide explains how to deploy and configure the on-chain registry contract for tracking platform activity.

## Purpose

The CoinRegistry contract provides verifiable on-chain proof of coins created via your platform. This is essential for:
- **Grant applications** (Optimism RetroPGF, etc.)
- **Platform analytics** and metrics
- **User reputation** and badges
- **Public transparency**

## Prerequisites

1. Node.js and npm installed
2. A wallet with Base ETH for deployment (~$15-20)
3. BaseScan API key (free from https://basescan.org/apis)

## Setup Steps

### 1. Install Dependencies

Dependencies are already included in `package.json`. If you need to install separately:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify ethers
```

### 2. Configure Environment Variables

Add these to your `.env` file:

```bash
# Registry Contract Configuration
REGISTRY_CONTRACT_ADDRESS=         # Will be set after deployment
PLATFORM_WALLET_PRIVATE_KEY=       # Private key for registering coins (KEEP SECRET!)
PLATFORM_WALLET_ADDRESS=           # Public address of the platform wallet

# Network Configuration
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=                  # Get from https://basescan.org/apis

# Deployment Configuration
DEPLOYER_PRIVATE_KEY=              # Private key for deploying contract (can be same as platform wallet)

# Cron Schedule (optional)
REGISTRY_CRON_SCHEDULE=0 */6 * * * # Every 6 hours (default)
```

### 3. Deploy to Base Testnet (Recommended First)

Test on Sepolia testnet before mainnet:

```bash
# Compile contracts
npx hardhat compile

# Deploy to Base Sepolia testnet
npx hardhat run scripts/deploy-registry.ts --network baseSepolia
```

Save the contract address from the output.

### 4. Verify Contract on BaseScan

```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS> <PLATFORM_WALLET_ADDRESS>
```

### 5. Deploy to Base Mainnet

Once tested, deploy to mainnet:

```bash
npx hardhat run scripts/deploy-registry.ts --network base
```

### 6. Update Environment Variables

Add the deployed contract address to `.env`:

```bash
REGISTRY_CONTRACT_ADDRESS=0x... # From deployment output
```

### 7. Restart Your Application

The registry cron job will start automatically on server restart:

```bash
npm run dev  # Development
# or
npm start    # Production
```

## Database Migration

Apply the registry status column to your database:

```sql
-- Run this in your database
ALTER TABLE coins 
ADD COLUMN IF NOT EXISTS registry_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_coins_registry_status ON coins(registry_status);
CREATE INDEX IF NOT EXISTS idx_coins_registered_at ON coins(registered_at);
```

Or use your preferred migration tool.

## How It Works

### Automatic Registration (Cron Job)

The system automatically registers new coins every 6 hours (configurable):

1. **Cron job runs** - Checks for pending registrations
2. **Batches coins** - Groups up to 50 coins per transaction
3. **Registers on-chain** - Calls `batchRegister()` on the contract
4. **Updates database** - Marks coins as `registered` with transaction hash

### Manual Registration

You can also trigger registration manually via API:

```bash
# Trigger manual sync
curl -X POST http://localhost:5000/api/registry/sync

# Check status
curl http://localhost:5000/api/registry/status

# Get pending registrations
curl http://localhost:5000/api/registry/pending

# Check if a contract is registered
curl http://localhost:5000/api/registry/check/0x...
```

### Registry Status Flow

Coins go through these states:

1. **`pending`** - Created but not yet registered on-chain
2. **`registering`** - Currently being registered (transaction sent)
3. **`registered`** - Successfully registered on-chain
4. **`failed`** - Registration failed (will retry next cron run)

## Gas Costs

Estimated costs on Base mainnet:

- **Contract deployment**: ~$15-20 (one-time)
- **Single registration**: ~$0.02
- **Batch registration** (50 coins): ~$0.10 ($0.002 per coin)

For 1,000 coins/month in batches: ~$2-3/month in gas costs.

## Contract Functions

### Public Functions

```solidity
// Register a single coin
function register(
    address creator,
    address zoraContract,
    bytes32 txHash
) external onlyPlatform

// Register multiple coins (gas efficient)
function batchRegister(
    address[] creators,
    address[] zoraContracts,
    bytes32[] txHashes
) external onlyPlatform

// Check if registered
function isRegistered(address zoraContract) 
    external view returns (bool)

// Get registration details
function getRegistration(address zoraContract) 
    external view returns (CoinRegistration memory)

// Get total registered coins
function totalCoins() external view returns (uint256)
```

### Admin Functions

```solidity
// Update platform wallet
function updatePlatformWallet(address newWallet) 
    external onlyPlatform

// Pause/unpause contract
function pause() external onlyPlatform
function unpause() external onlyPlatform
```

## Verifying On-Chain Data

Anyone can verify your platform's activity:

```javascript
// Using ethers.js
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const registryAddress = "0x..."; // Your registry contract
const abi = [...]; // CoinRegistry ABI

const registry = new ethers.Contract(registryAddress, abi, provider);

// Get total registrations
const total = await registry.totalCoins();
console.log(`Total coins: ${total}`);

// Check specific coin
const isRegistered = await registry.isRegistered("0xZoraContractAddress");
console.log(`Is registered: ${isRegistered}`);
```

## For Grant Applications

### OP Atlas Registration

1. Go to https://atlas.optimism.io
2. Create your project profile
3. Add your registry contract address
4. Describe impact metrics

### Monthly Attestations (via EAS)

Create monthly attestations pointing to your registry:

```
Schema: Platform Impact Metrics
- Registry Contract: 0xYourRegistry
- Period: January 2025
- New Registrations: 150
- Total Coins: 523
- Verifiable: true
```

## Troubleshooting

### Registry Not Starting

If you see "Registry service not configured":
- Check `REGISTRY_CONTRACT_ADDRESS` is set
- Check `PLATFORM_WALLET_PRIVATE_KEY` is set
- Restart the application

### Registration Failing

Common issues:
- **Insufficient gas**: Wallet needs Base ETH
- **Contract paused**: Check contract state
- **Already registered**: Coin was previously registered

### Checking Logs

View registry activity:

```bash
# Check cron job logs
grep "registry" server.log

# Manual sync and watch output
curl -X POST http://localhost:5000/api/registry/sync
```

## Security Notes

⚠️ **IMPORTANT**:
- **Never commit** `PLATFORM_WALLET_PRIVATE_KEY` to git
- **Keep private keys** in environment variables only
- **Use separate wallet** for platform operations
- **Monitor wallet balance** regularly

## Next Steps

After deployment:

1. ✅ Update OP Atlas with contract address
2. ✅ Set up monthly EAS attestations
3. ✅ Monitor gas costs and adjust batch size
4. ✅ Consider backfilling existing coins

## Support

For issues or questions:
- Check contract on BaseScan: https://basescan.org/address/YOUR_CONTRACT
- Review transaction history
- Check application logs

---

**Contract:** CoinRegistry.sol  
**Network:** Base (Chain ID: 8453)  
**Purpose:** Verifiable on-chain proof of platform activity
