# Coinbase Paymaster - Quick Reference Guide

## 🎯 TL;DR

✅ **Your Coinbase Paymaster is FULLY IMPLEMENTED and PRODUCTION READY**

- Email users get **free coin creation** (gas sponsored)
- Wallet users get **free coin creation** (gas sponsored)  
- Uses Coinbase Base Paymaster ($50-100/month on mainnet)
- Uses Privy for smart account generation
- ZORA pairing for all networks

---

## 📁 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `client/src/contexts/SmartAccountContext.tsx` | Smart account + paymaster init | ✅ Ready |
| `client/src/lib/gasless-deployment.ts` | Gasless coin deployment | ✅ Ready |
| `client/src/lib/zora-coins.ts` | Zora Factory contract calls | ✅ Ready |
| `package.json` | Dependencies (permissionless v0.2.57) | ✅ Ready |

---

## 🔧 Configuration

### Required Environment Variables

```bash
VITE_COINBASE_PAYMASTER_API_KEY=your_api_key
VITE_PRIVY_APP_ID=your_app_id
```

### Get Keys

1. **Paymaster API Key**: https://coinbase.com/developer-platform
   - Project → Base Paymaster → Generate Key
   
2. **Privy App ID**: https://dashboard.privy.io/
   - Project Settings → Copy App ID

---

## 🚀 How It Works

```
User Signs Up (Email)
    ↓
Privy: Embedded Wallet Created
    ↓
Smart Account: Generated (0xe57A...)
    ↓
User: Creates Coin
    ↓
SmartAccountClient: Prepares Transaction
    ↓
Paymaster: Validates & Approves
    ↓
Chain: Executes Coin Deployment
    ↓
Result: Coin Created ✅ Gas $0 ✅
```

---

## 💰 Costs

| Network | Cost/Deployment | Monthly Budget | Limit |
|---------|-----------------|----------------|-------|
| Base Sepolia (Test) | ~$0.02 | FREE | Unlimited |
| Base Mainnet (Prod) | ~$0.30 | $50-100 | ~150-300 coins/month |

---

## ✅ Implementation Checklist

- [x] Paymaster URL configured (mainnet + sepolia)
- [x] Smart account client created
- [x] Privy integration complete
- [x] Gasless deployment function implemented
- [x] ZORA pairing standardized
- [x] TypeScript validation passed
- [x] All users get gasless (email + wallet)

---

## 🧪 Test Locally

1. Set up `.env.local` with test keys
2. Connect to Base Sepolia
3. Sign up with test email
4. Create test coin
5. Check console for flow logs
6. Verify on https://sepolia.basescan.org

---

## 📊 Paymaster Dashboard

Monitor at: https://coinbase.com/developer-platform

**Track**:
- ✅ Sponsored transactions count
- ✅ Gas sponsored (gwei)
- ✅ Monthly budget remaining
- ✅ Failed sponsorships (if any)

**Alerts**: Set at 20% budget remaining

---

## 🔗 Network Configuration

| Network | Chain ID | Paymaster URL |
|---------|----------|---------------|
| Base Mainnet | 8453 | `https://api.developer.coinbase.com/rpc/v1/base/{KEY}` |
| Base Sepolia | 84532 | `https://api.developer.coinbase.com/rpc/v1/base-sepolia/{KEY}` |

---

## 📝 Environment Variables Template

```bash
# .env.local or .env.production
VITE_COINBASE_PAYMASTER_API_KEY=paste_key_here
VITE_PRIVY_APP_ID=paste_app_id_here
VITE_ADMIN_NETWORK_PREFERENCE=mainnet  # or 'sepolia'
```

---

## 🎯 User Journey

### Email User (No Wallet)

```
1. Sign up → Email verification
2. Privy creates embedded wallet
3. Smart account auto-generated
4. Upload content
5. Click "Create Coin"
6. Gas sponsored → Coin created ✅
7. Start earning ZORA rewards ✅
```

### Wallet User (MetaMask, etc.)

```
1. Sign in → Connect wallet
2. Smart account auto-generated
3. Upload content
4. Click "Create Coin"
5. Gas sponsored → Coin created ✅
6. Start earning ZORA rewards ✅
```

---

## 📦 Dependencies Installed

```json
"permissionless": "^0.2.57"  // Smart account client
"viem": "^2.x"               // Contract interaction
"@privy-io/react-auth": "^..."  // Authentication
```

---

## 🔍 Console Logs to Expect

```
🔐 Initializing smart account on Base Sepolia...
📡 Using Base Paymaster RPC: https://api.developer.coinbase.com/rpc/v1/base-sepolia/{KEY}
💼 Found wallet: privy
👤 Owner address: 0x40E564fE1fac10Cc5BEa9a34457b6bC6291B4F8e
✅ Smart account created: 0xe57A9531896F96610E0dD47270a7b849DE536d06
✅ Smart account client ready

[When user creates coin]
📤 [Gasless] Deploying coin using DIRECT contract call...
⚠️  [Gasless] Gas will be sponsored by Base Paymaster
✅ [Gasless] Transaction sent! Hash: 0x...
✅ [Gasless] Transaction confirmed!
```

---

## 🚨 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Smart account not initializing | Privy not ready | Wait for authentication |
| Deployment fails | API key not set | Add `VITE_COINBASE_PAYMASTER_API_KEY` to `.env.local` |
| Wrong network | Network preference not set | Check localStorage `ADMIN_NETWORK_PREFERENCE` |
| Type errors | permissionless not installed | Run `npm install` |

---

## 📚 Documentation Files

1. **PAYMASTER_GASLESS_SYSTEM.md** - Complete system documentation
2. **COINBASE_PAYMASTER_VERIFICATION.md** - Full verification checklist
3. **MAINNET_UPGRADE.md** - Network upgrade documentation
4. **EARNINGS_NOTIFICATIONS.md** - Notification system documentation

---

## 🎓 Learning Resources

- **Coinbase Paymaster Docs**: https://docs.coinbase.com/paymaster/
- **ERC-4337 Spec**: https://www.erc4337.io/
- **Privy Guide**: https://docs.privy.io/guide/frontend/smart-wallets
- **Base Network**: https://docs.base.org/

---

**Status**: ✅ PRODUCTION READY - Ready to deploy!
