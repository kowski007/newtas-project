# Smart Contracts

## CoinRegistry.sol

On-chain registry contract for tracking coins created via the platform.

### Purpose

Provides verifiable, immutable proof of platform activity for:
- Grant applications (Optimism RetroPGF, etc.)
- Public analytics and transparency
- User reputation and achievements
- Cross-platform interoperability

### Features

- **Gas Optimized**: Batch registration for up to 50 coins per transaction
- **Pausable**: Emergency pause functionality
- **Secure**: Only platform wallet can register
- **Queryable**: Public read functions for verification
- **Event-driven**: Emits events for indexing

### Contract Address

- **Base Mainnet**: (deploy and add here)
- **Base Sepolia**: (testnet address)

### Deployment

See [REGISTRY_SETUP.md](../REGISTRY_SETUP.md) for full deployment guide.

Quick deploy:

```bash
npx hardhat compile
npx hardhat run scripts/deploy-registry.ts --network base
```

### Verification

```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> <PLATFORM_WALLET_ADDRESS>
```

### Usage

The contract is automatically used by the backend cron job. Manual usage:

```javascript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const registry = new ethers.Contract(
  "0xRegistryAddress",
  CoinRegistryABI,
  provider
);

// Check total registrations
const total = await registry.totalCoins();

// Check if specific coin is registered
const isRegistered = await registry.isRegistered("0xZoraContract");

// Get registration details
const details = await registry.getRegistration("0xZoraContract");
```

### Testing

```bash
npx hardhat test
```

(Tests to be added)

### Gas Estimates

- Single registration: ~50,000 gas (~$0.02 on Base)
- Batch registration (50 coins): ~250,000 gas (~$0.10 on Base)
- Contract deployment: ~1,000,000 gas (~$15-20 on Base)

### Events

```solidity
event CoinRegistered(
    address indexed creator,
    address indexed zoraContract,
    uint256 timestamp,
    bytes32 txHash
);

event BatchRegistered(
    uint256 count,
    uint256 timestamp
);
```

### Security

- **Access Control**: Only `platformWallet` can register
- **Duplicate Prevention**: Each contract can only be registered once
- **Pausable**: Admin can pause in emergency
- **Validation**: Checks for valid addresses and contract existence

### Upgradeability

This contract is **immutable** by design for trust and simplicity. If upgrades are needed:
1. Deploy new version
2. Migrate data via events/indexing
3. Update backend to use new contract

### License

MIT
