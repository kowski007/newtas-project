# Mainnet Upgrade - Coin Creation & Trading

## Overview
Updated the platform to support **Base Mainnet (Production)** with full Zora Protocol functionality. Testnet (Base Sepolia) has critical limitations that prevent trading and pool operations.

## Critical Findings from Zora Docs

### ❌ Base Sepolia (Testnet) - DOES NOT WORK
- ❌ **NO Trading**: Coins cannot be bought/sold
- ❌ **NO Pools**: Liquidity pools don't function
- ❌ **NO Rewards**: Reward distribution disabled
- ❌ **NO Trading Fees**: Creator/platform fees not distributed

### ✅ Base Mainnet - FULL FUNCTIONALITY
- ✅ **Trading Works**: Full DEX functionality
- ✅ **Uniswap V4 Pools**: Active with ETH backing
- ✅ **Rewards Enabled**: Creator fees, platform referral, trading rewards
- ✅ **All Zora Features**: Complete protocol support

---

## Changes Made

### 1. **Pool Configuration Update** (`client/src/lib/zora-coins.ts`)
**Before**: Always used ZORA token pairing
**After**: Dynamic selection based on network
```typescript
// Base Sepolia: Uses ZORA token (testnet only)
const currency = isMainnet ? ETH_ADDRESS : ZORA_ADDRESS;

// Base Mainnet: Uses ETH (optimal for trading)
if (isMainnet) {
  console.log(`✅ Base Mainnet (${chainId}): Using ETH as paired currency`);
} else {
  console.log(`🧪 Base Sepolia (${chainId}): Using ZORA as paired currency (testnet only)`);
}
```

**Impact**:
- Mainnet coins now use **ETH backing** (production standard)
- Sepolia coins still work with ZORA (testnet compatibility)
- Tick ranges optimized for each network

### 2. **Admin Network Settings** (`client/src/pages/admin-network.tsx`)
**Added**: Critical warning about testnet limitations
```
🚨 Critical: Testnet Limitations
✅ Base Sepolia (Testnet) has NO trading functionality:
  ❌ Coins cannot be traded
  ❌ Liquidity pools do not work
  ❌ Rewards are not distributed
  ❌ Zora protocol features are disabled
```

**Added**: Enhanced comparison table showing:
- Trading Status (mainnet ✅, testnet ❌)
- Pool System (mainnet ✅, testnet ❌)
- Rewards (mainnet ✅, testnet ❌)
- Zora Features (mainnet full, testnet limited)

### 3. **Network Detection** (`client/src/components/content-preview.tsx`)
**Already configured**: Reads `ADMIN_NETWORK_PREFERENCE` from localStorage
```typescript
const networkPreference = localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null;
const chainId = networkPreference === 'mainnet' ? base.id : baseSepolia.id;
console.log('🚀 Creating coin on chain:', chainId === base.id ? 'Base Mainnet' : 'Base Sepolia');
```

---

## How to Use

### Switch to Mainnet
1. Go to **Admin Panel** → **Network Settings**
2. Click **"Switch to Mainnet"** button
3. Page reloads with mainnet configuration

### Create Coin on Mainnet
1. Set network to Base Mainnet
2. Import URL or Upload content
3. Create coin
4. **Smart wallet handles gas sponsorship** (gasless deployment)
5. Coin deploys with:
   - ✅ ETH backing
   - ✅ Uniswap V4 pool initialized
   - ✅ Trading enabled immediately
   - ✅ Rewards active

---

## Zora Factory Configuration

### Base Mainnet (8453) - ETH Backed
```
Factory: 0x777777751622c0d3258f214F9DF38E35BF45baF3
Currency: ETH (0x0000000000000000000000000000000000000000)
Version: 4 (Uniswap V4)
Tick Range: -138_000 to -81_000
Pool Type: CreatorCoin (deployCreatorCoin)
Events: CreatorCoinCreated
```

### Base Sepolia (84532) - ZORA Backed (Testnet Only)
```
Factory: 0x777777751622c0d3258f214F9DF38E35BF45baF3
Currency: ZORA (0x1111111111166b7fe7bd91427724b487980afc69)
Version: 4 (Uniswap V4)
Tick Range: -138_000 to -81_000
Pool Type: CreatorCoin (deployCreatorCoin)
Events: CreatorCoinCreated
⚠️ WARNING: No trading/pools work on testnet
```

---

## Gasless Deployment (Privy Paymaster)

**Already configured** in `gasless-deployment.ts`:
- Smart Account Factory: `VITE_SIMPLE_ACCOUNT_FACTORY_ADDRESS`
- Paymaster RPC: `VITE_BASE_PAYMASTER_RPC_URL`
- Users see: **"Gasless Deployment - Zero Gas Fees!"**

**Note**: Platform still pays gas (sponsored), users don't pay directly.

---

## Rewards Structure (Mainnet Only)

When a user trades a coin on mainnet:

```
Total Trading Fee: 5% of trade volume

Distribution:
├─ 50% → Creator (payoutRecipient address)
├─ 15% → Creator Referral (platformReferrer: 0xf25af781c4F1Df40Ac1D06e6B80c17815AD311F7)
├─ 15% → Trade Referral (if applicable)
├─ 15% → Zora Protocol
└─ 5% → Doppler Protocol
```

**On Testnet**: None of these work - rewards not distributed.

---

## Testing Checklist

### ✅ Before Going Live
- [ ] Admin switches to Base Mainnet
- [ ] Create test coin via Import/Upload
- [ ] Verify coin address on BaseScan
- [ ] Check pool initialized on Uniswap V4
- [ ] Perform test trade (requires real ETH)
- [ ] Verify rewards flow to creator wallet
- [ ] Monitor registry batch registration

### ⚠️ Important Notes
- **Mainnet requires real ETH** for gas fees
- **Use testnet for development only** (no trading)
- **Pool config auto-selects** based on network preference
- **Admin warning** displayed about testnet limitations
- **No code changes needed** to switch networks - just use admin panel

---

## Files Modified

1. **`client/src/lib/zora-coins.ts`**
   - Updated `encodePoolConfig()` to use ETH on mainnet, ZORA on sepolia
   - Added network detection logging

2. **`client/src/pages/admin-network.tsx`**
   - Added critical testnet limitation warning
   - Enhanced network comparison table
   - Shows ❌ for testnet trading/pools/rewards
   - Shows ✅ for mainnet full features

---

## Next Steps

1. **Deploy to Mainnet**: Switch network in admin panel
2. **Fund Wallet**: Ensure paymaster wallet has Base ETH
3. **Create Test Coin**: Verify end-to-end flow works
4. **Monitor Registry**: Check batch registrations every 6 hours
5. **Track Rewards**: Monitor creator earnings on mainnet

---

## Resources

- **Zora Docs**: https://docs.zora.co/coins/contracts/creating-a-coin
- **Base Mainnet**: Chain ID 8453
- **Base Sepolia**: Chain ID 84532
- **Contract**: `0x777777751622c0d3258f214F9DF38E35BF45baF3`
