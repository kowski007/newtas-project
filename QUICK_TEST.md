# 🚀 Quick Test - 5 Minute Check

**You're on Mainnet - Real Gas Costs Apply**

## Before You Start (2 minutes)

```bash
# 1. CRITICAL: Check Pimlico Dashboard
# Open: https://dashboard.pimlico.io/
# Check:
#   ✓ Do you have credits? (Billing tab)
#   ✓ Is 0x777... whitelisted? (Contract Allowlist)
#   ✓ Is sponsorship policy active? (Sponsorship Policies)

# If any of these fail → STOP and fix before testing
```

## Run Test (3 minutes)

```bash
# 1. Start dev server
npm run dev

# 2. Wait for: "serving on port 5000"

# 3. Open browser: http://localhost:5173

# 4. Sign in with test account

# 5. Check console (F12) for:
#    ✓ "💸 Using GASLESS deployment"
#    ✓ "Smart wallet address: 0x..."
#    ✓ "Gas fees will be sponsored by Base Paymaster (FREE)"
#    ✓ "📡 Using Pimlico Paymaster: Base Mainnet"
```

## Create Test Coin (1 minute)

```
1. Click "Create Coin"
2. Fill in:
   Name: "Test Mainnet"
   Symbol: "TST"
3. Click Deploy
4. Watch for: "✅ Coin deployed successfully!"
```

## Verify (2 minutes)

```
1. Copy transaction hash from console
2. Go to: https://basescan.org/
3. Paste hash in search
4. Verify:
   ✓ Status: Success
   ✓ From: Your smart account
   ✓ To: 0x777... (Zora Factory)
   ✓ Your wallet: UNCHANGED balance

5. Go to: https://dashboard.pimlico.io/
6. Check:
   ✓ Recent operation shows
   ✓ Status: Success
   ✓ Credits reduced
```

---

## ✅ Success = No Gas Cost to User

**Critical:** Your wallet balance should NOT decrease.
Gas was paid by Pimlico from your credits.

---

## ❌ If Anything Fails

**Check these in order:**

1. Browser console (F12) - Any error messages?
2. Pimlico dashboard - Transaction in Operations tab?
3. Basescan - Does transaction exist?
4. Privy dashboard - Smart account created?

---

**Ready?** 👉 `npm run dev`
