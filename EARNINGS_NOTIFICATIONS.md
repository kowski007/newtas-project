# Earnings Notifications System Documentation

## Overview

Your platform has a **comprehensive, multi-channel earnings notification system** that automatically notifies creators when they earn from trading activity. The system combines real-time personal notifications with community leaderboard announcements.

---

## 1. Personal Earnings Notifications ✅

### How It Works

When someone trades a creator's coin:
1. **Trade occurs** on Zora protocol
2. **Creator fee captured** (50% of 5% total fee = 2.5% of trade)
3. **Reward recorded** in database via `/api/rewards`
4. **Notification triggered** → `notificationService.notifyUserEarnings()`
5. **Delivered via**:
   - ✅ Telegram (personal DM)
   - ✅ In-app notification (persistent database)

### Randomized Message Templates (12 variations)

Users receive personalized, randomized messages:

```
💰 Ka-ching! You've earned 0.0045 ZORA from COIN!
🎉 Great news! 0.0045 ZORA just landed in your wallet from COIN
💎 You're making moves! 0.0045 ZORA earned from COIN
🔥 Hot earnings alert! 0.0045 ZORA from COIN is yours
⚡ Zap! 0.0045 ZORA just hit your account from COIN
🌟 Success! You've earned 0.0045 ZORA from COIN trades
💸 Money alert! 0.0045 ZORA from COIN arrived
🎯 Bulls-eye! 0.0045 ZORA earned from COIN
🚀 To the moon! 0.0045 ZORA from COIN deposited
💵 Cha-ching! 0.0045 ZORA from COIN is in your wallet
🏆 Winner! You earned 0.0045 ZORA from COIN
✨ Sweet! 0.0045 ZORA from COIN just dropped
```

### Example Notification

| Field | Value |
|-------|-------|
| **Title** | 💰 Earnings Received! |
| **Message** | 💰 Ka-ching! You've earned **0.004 ZORA** from **SONGCOIN**! |
| **Amount** | 0.004 ZORA |
| **Coin** | SONGCOIN |
| **Type** | reward |
| **Channel** | Telegram DM + In-app |

---

## 2. Community Leaderboard Notifications

### Top Earners (by period)
**Format**: "💎 TOP EARNERS - [24H | 7D | ALL TIME]"

```
1. 0x1234...5678
   💰 Earnings: $857.50
   🎯 Trades: 23

2. 0xabcd...ef99
   💰 Earnings: $632.20
   🎯 Trades: 18

[... top 10 ...]
```

**Broadcast**: Telegram channel (automatic)

---

### Top Traders (multiple timeframes)

Shows who's earning the most in specific periods with randomized templates:

#### Top Traders Messages (9 variations)

```
🔥 @johndoe is on fire! Earned 465 ZORA in the last 24 hours
💎 Whale alert! @johndoe made 465 ZORA in 24 hours
🚀 @johndoe just crushed it with 465 ZORA in 24 hours!
⚡ Power move! @johndoe earned 465 ZORA in 24 hours
👑 King of trades! @johndoe made 465 ZORA in 24 hours
🎯 Perfect execution! @johndoe earned 465 ZORA in 24 hours
💰 Big money! @johndoe raked in 465 ZORA in 24 hours
🌟 Star trader @johndoe earned 465 ZORA in 24 hours
🔮 Magic touch! @johndoe made 465 ZORA in 24 hours
```

**Schedule**:
- **24h rankings**: Every 6 hours (4x daily) 📊
- **10h rankings**: Every 3 hours (8x daily) 🔥
- **3-day rankings**: Once daily at 12 PM 💎

---

## 3. Additional Notifications

| Type | Trigger | Template |
|------|---------|----------|
| **Login Streak** | Daily login | "🔥 Day {streak}! Earned {points} E1XP" |
| **New Trade** | Buy/Sell action | "💰 Successfully {bought\|sold} {coin} for {amount}" |
| **E1XP Points** | Points earned | "⚡ You earned {points} E1XP for {reason}" |
| **Coin Created** | New coin launch | "🎊 Your coin {name} is now live!" |
| **Coin Performance** | High 24h earnings | "💎 {coin} earned ${amount} in 24h" |
| **Top Coins Trending** | Trending update | "🏆 TOP TRENDING COINS - [daily broadcast]" |
| **Welcome Bonus** | New user | "🎁 Welcome! You earned 10 E1XP to start" |
| **Referral Bonus** | Referral completes | "🎉 {user} joined! You earned {points} E1XP" |

---

## 4. Implementation Details

### Core Files

| File | Purpose |
|------|---------|
| `server/notification-service.ts` | Main notification logic, randomized templates, service class |
| `server/telegram-bot.ts` | Telegram integration, message formatting, bot commands |
| `server/notification-cron.ts` | Scheduled jobs for periodic broadcasts |
| `server/routes.ts` | API endpoints that trigger notifications on reward creation |
| `shared/schema.ts` | Database schema for notifications table |

### Database Schema

```typescript
// Notifications table
notifications {
  id: string (UUID)
  userId: string // wallet address or Privy ID
  type: string // 'reward', 'trade', 'streak', 'coin_created', 'performance', etc.
  title: string // "💰 Earnings Received!"
  message: string // Full notification text
  coinAddress?: string // Optional coin contract
  coinSymbol?: string // Optional coin symbol
  amount?: string // Optional amount
  transactionHash?: string // Optional tx hash
  read: boolean // Default: false
  createdAt: Date // Timestamp
}
```

### API Integration

**When reward is created** (`POST /api/rewards`):

```typescript
// 1. Save reward to database
const reward = await storage.createReward(rewardData);

// 2. Trigger notification
if (rewardData.type === "trade" && rewardData.recipientAddress) {
  // Send personalized earnings notification
  await notificationService.notifyUserEarnings(
    rewardData.recipientAddress,
    reward
  );
  
  // Also send trade notification
  await notificationService.notifyNewTrade(
    rewardData.recipientAddress,
    reward.coinSymbol,
    'buy',
    `${amount} ${reward.rewardCurrency}`
  );
}
```

---

## 5. Notification Delivery Channels

### Telegram (Primary)
- **Personal DMs**: Each user's unique Telegram chat ID
- **Channel broadcasts**: Community announcements (top earners, trending)
- **Parsing**: Markdown for formatting, links, and emphasis
- **Fallback**: Gracefully handles users without wallet/Telegram

### In-App Database
- **Persistent storage**: All notifications saved to database
- **Read status**: Users can mark as read/unread
- **Queries**: `/api/notifications` endpoint
- **Real-time**: Socket.IO for instant delivery to connected users

### Email (Future)
- Infrastructure ready but not yet activated
- Would send to email users who don't have Telegram

---

## 6. Scheduled Broadcasts (Cron Jobs)

### Daily Periodic Notifications
```
Every 12 hours at midnight & noon:
├─ Top Creators by Volume
├─ Top Earners (all-time)
├─ Top Points Earners
├─ Top Trending Coins
└─ Recent Trading Activity
```

### Top Traders Notifications
```
Every 6 hours: 24-hour top traders (4x daily)
Every 3 hours: 10-hour top traders (8x daily)
Every day (12 PM): 3-day top traders (1x daily)
```

### Weekly
```
Every Monday 10 AM: Weekly top earners (with USD values)
```

---

## 7. Configuration

### Environment Variables Required

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=your_channel_id_for_broadcasts

# Optional: User ID mappings (if storing Telegram IDs)
TELEGRAM_ALERTS_ENABLED=true
NOTIFICATION_RETRY_ATTEMPTS=3
```

### Optional Customization

In `server/notification-service.ts`:

```typescript
// Customize message templates
const EARNINGS_MESSAGES = [
  "Your custom message template {amount} from {coin}",
  // ... more templates
];

// Adjust notification frequency
const BROADCAST_INTERVAL = '0 */6 * * *'; // Every 6 hours
```

---

## 8. User Experience

### For Creators

1. **Create coin** → "🎊 Coin Created Successfully!"
2. **Someone trades** → "💰 Ka-ching! You've earned 0.004 ZORA!"
3. **Multiple trades** → Rapid notifications with randomized messaging
4. **Top performer** → "🏆 Top Trader Alert - You made $857 in 24h!"
5. **Daily digest** → Community leaderboard broadcasts

### Notification Flow

```
Trade Event
    ↓
Zora Hook captures 50% of 5% fee
    ↓
Platform records reward in DB
    ↓
POST /api/rewards triggered
    ↓
notifyUserEarnings() called
    ↓
Message template randomly selected
    ↓
Sent to:
├─ Telegram (personal DM) ✅
├─ In-app DB (persistent) ✅
└─ Socket.IO (real-time) ✅
```

---

## 9. Current Status

| Feature | Status | Details |
|---------|--------|---------|
| Personal earnings alerts | ✅ Active | Randomized templates, Telegram + in-app |
| Leaderboard broadcasts | ✅ Active | Daily + multiple timeframes |
| Trade notifications | ✅ Active | Buy/sell confirmations |
| Scheduled cron jobs | ✅ Active | 8 different notification types |
| Telegram integration | ✅ Active | Bot configured and running |
| In-app storage | ✅ Active | Full database persistence |
| Socket.IO real-time | ✅ Ready | Configured for connected users |
| Email delivery | ⏳ Pending | Infrastructure ready, not activated |

---

## 10. Example: User Journey

**Creator: Alice (@alice)**
- Creates coin "ALICE" 
- 5 users trade it over 1 hour
- Earns 0.05 ZORA total

**Notifications Alice Receives:**

| Time | Channel | Message |
|------|---------|---------|
| 12:01 | Telegram | 🎊 Your coin ALICE is now live! |
| 12:05 | Telegram | 💰 Ka-ching! You've earned 0.0089 ZORA from ALICE! |
| 12:10 | Telegram | 🎉 Great news! 0.0075 ZORA just landed in your wallet from ALICE |
| 12:15 | Telegram | 💎 You're making moves! 0.0078 ZORA earned from ALICE |
| 12:20 | Telegram | 🔥 Hot earnings alert! 0.0089 ZORA from ALICE is yours |
| 12:25 | In-app | 0.0069 ZORA from ALICE (via Socket.IO real-time) |
| 12 AM | Telegram | 👑 Top Trader Alert - 24h: You earned 0.05 ZORA! Rank: #7 |

**Community also sees:**

| Time | Channel | Message |
|------|---------|---------|
| 12 AM | Community Channel | 💎 TOP EARNERS - 24 HOURS: #1 @alice - $25.50 (0.05 ZORA) |

---

## 11. Best Practices

✅ **Do**:
- Randomize messages to avoid notification fatigue
- Include USD value in channel broadcasts
- Separate personal from community notifications
- Gracefully handle users without wallet addresses
- Retry failed Telegram sends

❌ **Avoid**:
- Sending duplicate notifications
- Flooding with too many notifications per hour
- Showing incomplete data (always format amounts)
- Broadcasting private information publicly

---

## 12. Future Enhancements

- [ ] Email notifications for email-only users
- [ ] Discord bot integration
- [ ] Custom notification preferences per user
- [ ] Batch notifications (hourly digest instead of per-trade)
- [ ] Webhooks for external integrations
- [ ] Analytics dashboard for notification metrics
- [ ] A/B testing different message templates
- [ ] Milestone celebrations ("You earned your 100th ZORA!")

---

**System Status**: ✅ Fully Implemented & Active
**Last Updated**: November 13, 2025
**Maintained By**: Every1.fun Platform Team
