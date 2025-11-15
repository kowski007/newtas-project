# 🚀 Pimlico Paymaster - Quick Start

## The Change
**From**: Coinbase Paymaster ($50-100/month fixed)
**To**: Pimlico Paymaster (Pay-as-you-go ~$30/month)

## What's Different For You?
✅ **Nothing** - Users still get free gas sponsorship
✅ **Same** smart account experience
✅ **Same** coin creation flow
✅ **Cheaper** by ~$20/month

## What Changed In Code?
```typescript
// Before (Coinbase)
import from 'permissionless/clients/pimlico' ❌
paymaster: { getPaymasterData: async () => ({ paymasterData: '0x' }) }

// After (Pimlico)
import { createPimlicoClient } from 'permissionless/clients/pimlico' ✅
paymaster: createPimlicoClient({ transport, entryPoint })
```

## In 3 Steps

### 1. Get API Key (5 min)
- Go to https://dashboard.pimlico.io/
- Sign up (free)
- Create API Key
- Copy key: `pim_...`

### 2. Add to .env
```bash
VITE_PIMLICO_API_KEY=pim_gNUshp4eDg2kW9c6hs6Sop
```

### 3. Test & Deploy
```bash
npm run dev        # Test locally
npm run build      # Build
npm run deploy     # Deploy
```

## Monitor
**Dashboard**: https://dashboard.pimlico.io/
- User Operation Logs → See sponsorships
- Usage → Track spending
- Billing → Pay-as-you-go charges

## Cost Savings
```
100 deployments/month:
  Coinbase: $50/month
  Pimlico: $30/month
  Savings: $20/month ✅
```

## Optional Upgrades
- **Gas Grants**: Apply at https://www.pimlico.io/grants (free $5K-50K)
- **ERC-20 Paymaster**: Let users pay in USDC
- **Sponsorship Policies**: Fine-grained control

## Status
✅ Code Ready
❓ Waiting for your Pimlico API key

**All files updated. Ready to deploy!**
