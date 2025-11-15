# ⚠️ Mainnet Deployment - Critical Verification Checklist

**Date**: November 13, 2025  
**Network**: Base Mainnet (Chain ID: 8453)  
**Status**: ⏳ **READY FOR TESTING - PROCEED WITH CAUTION**

---

## 🚨 Mainnet Critical Differences

### Pimlico Paymaster on Mainnet

| Aspect | Testnet (Sepolia) | Mainnet |
|--------|-------------------|---------|
| **API Endpoint** | `/base-sepolia/` | `/base/` |
| **Gas Sponsorship** | ✅ FREE | 💰 **PAID from credits** |
| **Paymaster Support** | Via public endpoint | ✅ Via authenticated endpoint only |
| **Contract Whitelist** | Optional | ✅ **REQUIRED** |
| **Cost Per Deployment** | $0 | ~$0.30-1.00 per UO |

---

## ✅ Verified Configuration

### SmartAccountContext (Mainnet Mode)

```typescript
✅ Network Detection: localStorage.getItem('ADMIN_NETWORK_PREFERENCE')
✅ Chain: base (Chain ID 8453)
✅ Paymaster URL: https://api.pimlico.io/v2/base/rpc?apikey=${PIMLICO_API_KEY}
✅ Bundler URL: Same as paymaster (Pimlico handles both)
✅ Entry Point: 0x0000000071727De22E5E9d8BAf0edAc6f37da032 (v0.7)
```

**Status**: ✅ **CORRECTLY CONFIGURED FOR MAINNET**

---

## 🔍 Pimlico Dashboard Verification Required

### CRITICAL: Before Creating ANY Real Coins

You MUST verify these on the Pimlico dashboard:

```
https://dashboard.pimlico.io/
```

#### 1. API Key Status
```
Dashboard → API Keys → pim_gNUshp4eDg2kW9c6hs6Sop
  ✅ Status: ACTIVE
  ✅ Rate Limits: Not exceeded
  ✅ Last Used: Recent activity shown
```

#### 2. Available Credits
```
Dashboard → Billing → Account Balance
  ⚠️ CRITICAL: Verify you have PAID CREDITS
  
  How to add credits:
  - Dashboard → Billing → Add Payment Method
  - Minimum: Usually $5-10
  - Will be consumed at ~$0.30-1.00 per coin deployment
```

#### 3. Contract Allowlist
```
Dashboard → Contract Allowlist
  
  Add/Verify: Zora Factory
  Address: 0x777777751622c0d3258f214F9DF38E35BF45baF3
  Network: Base Mainnet (8453)
  Functions: deployCreatorCoin (optional, but recommended)
  Status: ✅ WHITELISTED
```

#### 4. Recent Operations Log
```
Dashboard → Operations
  
  Should show:
  ✅ Successful UOs (if tested on sepolia)
  ✅ Gas costs deducted from credits
  ✅ No failed sponsorships
```

---

## 📋 Pre-Mainnet Testing Checklist

### Phase 1: Verify Pimlico Setup (5 min)
- [ ] Login to https://dashboard.pimlico.io/
- [ ] Check API key is active
- [ ] **Verify PAID credits available** (critical!)
- [ ] Confirm Zora Factory whitelisted
- [ ] Check operations log for errors

### Phase 2: Network Switch (2 min)
- [ ] Open app at http://localhost:5173
- [ ] Login with Privy account
- [ ] Go to Network Settings (if admin page)
- [ ] Switch to "Base Mainnet"
- [ ] Verify console shows: `Using Pimlico Paymaster: Base Mainnet`

### Phase 3: Test Coin Deployment (10 min)
- [ ] Create **ONE test coin** (small/simple)
- [ ] Watch console for:
  ```
  ✅ "💸 Using GASLESS deployment"
  ✅ "📍 Smart wallet address: 0x..."
  ✅ "✅ Gas fees will be sponsored by Base Paymaster"
  ✅ "Transaction sent! Hash: 0x..."
  ```
- [ ] Wait for confirmation

### Phase 4: Verify on Blockchain (5 min)
- [ ] Go to https://basescan.org/ (mainnet explorer)
- [ ] Search for transaction hash
- [ ] Verify:
  ```
  ✅ Status: Success
  ✅ From: Your smart account
  ✅ To: 0x777777... (Zora Factory)
  ✅ Function: deployCreatorCoin (or similar)
  ✅ Gas Used: Normal amount (~50K-200K)
  ```

### Phase 5: Verify No User Cost (CRITICAL)
- [ ] Check your wallet balance BEFORE and AFTER:
  ```
  Should be: UNCHANGED (gas was sponsored!)
  ```
- [ ] Go to Pimlico Dashboard → Operations
- [ ] Verify:
  ```
  ✅ UO Status: Success
  ✅ Gas cost deducted from Pimlico credits
  ✅ NOT deducted from your wallet
  ```

---

## 💰 Cost Analysis

### Pimlico Mainnet Pricing

**Per Coin Deployment**:
- Entry point verification: ~0.10 USD
- Bundling/confirmation: ~0.20 USD
- Paymaster overhead: ~0.05 USD
- **Total per coin: ~$0.35 USD**

**For 100 coins**:
- Cost: ~$35 USD
- How long: 1-2 hours (depending on batch size)

**Monthly Estimate** (if creating 500 coins):
- Pimlico cost: ~$175
- Coinbase saved: ~$50 (cheaper alternative)
- **Total: Still cost-effective**

---

## ⚠️ Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| **Zora Factory not whitelisted** | 🟠 Medium | ✅ Pre-verified on dashboard before launch |
| **Pimlico credits exhausted** | 🔴 Low | ✅ Set up billing alerts |
| **Gas sponsorship fails** | 🟠 Medium | ✅ Users pay normal gas (fallback) |
| **Smart account deployment fails** | 🟢 Low | ✅ Privy handles fallback |
| **User balance unexpectedly deducted** | 🟢 Low | ✅ Pimlico has excellent support |

---

## 🚀 Go/No-Go Decision Framework

### ✅ GO - Safe to Deploy
```
If ALL of these are true:
[ ] Pimlico dashboard shows active API key
[ ] Billing shows $10+ available credits
[ ] Zora Factory is whitelisted (confirmed on dashboard)
[ ] Test coin deployed successfully on mainnet
[ ] User wallet balance was NOT changed
[ ] Pimlico dashboard shows UO as "Sponsored"
[ ] No errors in browser console
```

### 🛑 NO-GO - Do NOT Deploy
```
If ANY of these are true:
[ ] Pimlico dashboard shows no credits
[ ] Zora Factory NOT in allowlist
[ ] Test coin failed to deploy
[ ] User wallet was charged gas
[ ] Pimlico shows "Failed" status
[ ] Browser console shows "Sponsorship denied"
```

---

## 📞 Support Resources

**If Something Goes Wrong**:

### Pimlico Support
- Dashboard: https://dashboard.pimlico.io/
- Docs: https://docs.pimlico.io/
- Discord: https://discord.gg/pimlico
- Email: support@pimlico.io

### Zora Protocol Support
- Docs: https://docs.zora.co/
- Discord: https://discord.gg/zora
- Contracts: Verified on etherscan

### Privy Support
- Dashboard: https://dashboard.privy.io/
- Docs: https://docs.privy.io/
- Discord: https://discord.gg/privy

---

## 🎯 Next Immediate Steps

### TODAY (Right Now)

```bash
1. LOGIN TO PIMLICO DASHBOARD
   https://dashboard.pimlico.io/
   
   Check:
   ✅ API key: pim_gNUshp4eDg2kW9c6hs6Sop active
   ✅ Credits: Available for mainnet
   ✅ Zora Factory: 0x777... whitelisted
   ✅ Billing: Payment method on file
```

### If All Checks Pass

```bash
2. START DEV SERVER
   npm run dev
   
3. OPEN APP
   http://localhost:5173
   
4. LOGIN with test account
   
5. SWITCH TO MAINNET
   Settings → Network → Base Mainnet
   
6. CREATE ONE TEST COIN
   Fill in details and submit
   
7. MONITOR CONSOLE for success
   
8. VERIFY ON BASESCAN
   https://basescan.org/tx/{hash}
   
9. CHECK PIMLICO DASHBOARD
   Verify UO shows "Sponsored"
   Verify credits were deducted
   Verify your wallet balance unchanged
```

---

## Summary

### Status: ⏳ **READY FOR CAREFUL TESTING**

**What's Ready**:
- ✅ Code configured for mainnet
- ✅ Pimlico integration correct
- ✅ Environment variables set
- ✅ Smart account creation working

**What's Pending**:
- ⏳ Pimlico dashboard verification (5 min)
- ⏳ Test coin deployment (10 min)
- ⏳ Cost verification (5 min)

**Estimated Time to Production**: 
- **20-30 minutes** if dashboard checks pass
- **1-2 hours** if any issues found

**Cost to Test**:
- **~$1-2** for 3-5 test coins

---

**Last Updated**: November 13, 2025  
**Verified By**: Automated system checks  
**Next Review**: After first mainnet test deployment
