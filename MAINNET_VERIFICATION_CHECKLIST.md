# ✅ Pre-Test Mainnet Verification Checklist

**Date**: November 13, 2025  
**Environment**: Base Mainnet  
**Objective**: Verify all systems ready before coin creation test

---

## 📋 Code-Level Verification (Already Completed ✅)

### SmartAccountContext.tsx
- [x] Pimlico client imports correct: `createPimlicoClient`
- [x] Paymaster URL format correct: `https://api.pimlico.io/v2/base/...`
- [x] Network detection working: reads from `ADMIN_NETWORK_PREFERENCE`
- [x] EntryPoint v0.7 configured
- [x] Smart account client created with paymaster attached

### gasless-deployment.ts
- [x] Uses smart account client (not regular wallet client)
- [x] Calls `createCoinOnBaseSepolia` with smart account
- [x] Waits for transaction receipt
- [x] Error handling implemented

### zora-coins.ts
- [x] ZORA pairing configured
- [x] Pool configuration correct (tick ranges)
- [x] Coin creation function accepts smart account client

### Environment Variables
- [x] `VITE_PIMLICO_API_KEY` set in .env
- [x] `VITE_PRIVY_APP_ID` configured
- [x] All required vars present

---

## 🔌 External Service Verification

### ✅ Pimlico API
- [x] Endpoint responding (tested via curl)
- [x] API key valid (no auth errors)
- [x] Both networks configured (mainnet + sepolia URLs)

### ⚠️ Pimlico Dashboard (YOU MUST CHECK BEFORE TESTING)
- [ ] Login to https://dashboard.pimlico.io/
- [ ] Check: Do you have available credits?
- [ ] Check: Is Zora Factory `0x777...` whitelisted?
- [ ] Check: Is there an active sponsorship policy?

### ✅ Privy Authentication
- [x] `VITE_PRIVY_APP_ID` configured
- [x] Privy auth middleware initialized
- [x] SmartAccountProvider wraps app
- [x] Embedded wallets enabled

### ✅ Zora Factory
- [x] Address correct: `0x777777751622c0d3258f214F9DF38E35BF45baF3`
- [x] Contract exists on Base mainnet
- [x] `deployCreatorCoin` function available
- [x] ZORA token pair configured

---

## 🚀 Runtime Verification (TO DO)

### Before Starting Dev Server
- [ ] Confirm network is set to "mainnet" (check localStorage or UI)
- [ ] Confirm you're logged into Pimlico dashboard
- [ ] Confirm you can see available credits
- [ ] Confirm Zora Factory is whitelisted

### When Dev Server Starts
- [ ] Server starts without errors
- [ ] "✅ Privy authentication middleware initialized" appears
- [ ] "serving on port 5000" appears
- [ ] Browser opens to http://localhost:5173

### When You Open Browser
- [ ] No console errors in browser
- [ ] Privy login/signup modal appears
- [ ] You can sign in or create account
- [ ] Smart account initializes
- [ ] Console shows gasless messages

### When You Create a Coin
- [ ] Console shows "💸 Using GASLESS deployment"
- [ ] Console shows smart wallet address
- [ ] Coin creation form accepts input
- [ ] "Deploy" button works
- [ ] Transaction appears in console
- [ ] No error messages
- [ ] Coin appears on blockchain within 1-2 minutes

---

## 💰 Cost Verification

**Before Testing, Answer These:**

1. Do you have Pimlico credits?
   - [ ] Yes, I checked dashboard
   - [ ] No, I need to purchase

2. Do you know how many tests you can run?
   - [ ] Yes: ~$0.30-0.50 per deployment
   - [ ] No, I'll check dashboard

3. Is the Zora Factory whitelisted?
   - [ ] Yes, I can see it in allowlist
   - [ ] No, I need to add it
   - [ ] I'm not sure how to check

4. Is there an active sponsorship policy?
   - [ ] Yes, verified in dashboard
   - [ ] No, I need to create one
   - [ ] I'm not sure how to check

---

## 🔍 Final Checks (DO THESE NOW)

### Check 1: Pimlico Dashboard Login
```
1. Open: https://dashboard.pimlico.io/
2. Login with your email
3. Can you see the dashboard? YES / NO
```

### Check 2: Available Credits
```
1. Click: Billing tab
2. Look for: "Account Credits" or "Balance"
3. Do you have credits? YES / NO
4. How much? $___________
```

### Check 3: Contract Allowlist
```
1. Click: Contract Allowlist (or similar)
2. Search: 0x777777751622c0d3258f214F9DF38E35BF45baF3
3. Is it listed? YES / NO
4. Status: WHITELISTED / PENDING / NOT FOUND
```

### Check 4: Sponsorship Policy
```
1. Click: Sponsorship Policies (or similar)
2. Look for: Policy for "Base" mainnet
3. Does one exist? YES / NO
4. Status: ACTIVE / INACTIVE / CREATE NEW
```

---

## ✨ Network Settings in App

### Verify You're on Mainnet

**In Browser Console (F12):**
```javascript
// Run this in console:
localStorage.getItem('ADMIN_NETWORK_PREFERENCE')

// Should return: "mainnet"
// NOT "sepolia"
```

**If it shows "sepolia":**
1. Go to admin panel (if available)
2. Change network to "Base Mainnet"
3. Refresh page
4. Verify console shows mainnet

---

## 🎯 Test Success Criteria

### ✅ Test Passes If ALL True:

1. [ ] Coin creation succeeds (no errors in console)
2. [ ] Transaction hash appears in console
3. [ ] Transaction shows on Basescan (basescan.org)
4. [ ] Status on Basescan: "Success"
5. [ ] From address: Your smart account
6. [ ] To address: Zora Factory (0x777...)
7. [ ] Function: deployCreatorCoin
8. [ ] Your wallet balance: UNCHANGED (gas was sponsored!)
9. [ ] Pimlico dashboard shows the operation
10. [ ] Pimlico credits decreased

### ❌ Test Fails If ANY True:

1. [ ] Console shows error messages
2. [ ] Transaction doesn't appear on Basescan
3. [ ] Status on Basescan: "Failed"
4. [ ] Your wallet balance decreased (means paymaster didn't work)
5. [ ] Pimlico shows failed operation
6. [ ] Pimlico credits not deducted (means sponsorship didn't happen)

---

## 🚨 Common Issues & Fixes

### Issue: "Contract not whitelisted"
**Fix:**
1. Go to Pimlico dashboard
2. Find "Contract Allowlist"
3. Add contract: `0x777777751622c0d3258f214F9DF38E35BF45baF3`
4. Set function: `deployCreatorCoin`
5. Save and wait ~1 minute

### Issue: "Insufficient paymaster balance"
**Fix:**
1. Go to Pimlico dashboard
2. Click "Billing"
3. Purchase credits (or enable pay-as-you-go)
4. Minimum: $1-5 recommended

### Issue: "Network not mainnet"
**Fix:**
1. Open browser console
2. Run: `localStorage.setItem('ADMIN_NETWORK_PREFERENCE', 'mainnet')`
3. Refresh page
4. Verify: `localStorage.getItem('ADMIN_NETWORK_PREFERENCE')` returns "mainnet"

### Issue: "Smart account not initialized"
**Fix:**
1. Make sure you're logged in (Privy)
2. Wait 2-3 seconds for smart account to initialize
3. Check console for "✅ Smart account client ready"
4. Try coin creation again

---

## 📞 Support Information

**If something goes wrong:**

1. Check console (F12 → Console tab) for exact error
2. Take screenshot of error
3. Go to Pimlico dashboard and check "Operations" tab
4. Look for your transaction in the logs
5. Note the error code and status

**Useful URLs:**
- Pimlico Docs: https://docs.pimlico.io/
- Pimlico Discord: https://discord.gg/pimlico
- Basescan: https://basescan.org/

---

## ✅ Ready to Test?

If you've checked ALL items above and answered YES to the key questions:

✅ **You're ready to run: `npm run dev`**

Then:
1. Open http://localhost:5173
2. Sign in
3. Create a test coin
4. Verify on Basescan
5. Check Pimlico dashboard

Good luck! 🚀
