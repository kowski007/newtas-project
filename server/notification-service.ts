import { storage } from './supabase-storage';
import { sendTelegramNotification } from './telegram-bot';
import type { Reward, Creator, Coin } from '@shared/schema';

// Randomized earnings notification messages
const EARNINGS_MESSAGES = [
  "💰 Ka-ching! You've earned {amount} from {coin}!",
  "🎉 Great news! {amount} just landed in your wallet from {coin}",
  "💎 You're making moves! {amount} earned from {coin}",
  "🔥 Hot earnings alert! {amount} from {coin} is yours",
  "⚡ Zap! {amount} just hit your account from {coin}",
  "🌟 Success! You've earned {amount} from {coin} trades",
  "💸 Money alert! {amount} from {coin} arrived",
  "🎯 Bulls-eye! {amount} earned from {coin}",
  "🚀 To the moon! {amount} from {coin} deposited",
  "💵 Cha-ching! {amount} from {coin} is in your wallet",
  "🏆 Winner! You earned {amount} from {coin}",
  "✨ Sweet! {amount} from {coin} just dropped",
];

const TOP_TRADER_MESSAGES = [
  "🔥 {trader} is on fire! Earned {amount} in the last {period}",
  "💎 Whale alert! {trader} made {amount} in {period}",
  "🚀 {trader} just crushed it with {amount} in {period}!",
  "⚡ Power move! {trader} earned {amount} in {period}",
  "👑 King of trades! {trader} made {amount} in {period}",
  "🎯 Perfect execution! {trader} earned {amount} in {period}",
  "💰 Big money! {trader} raked in {amount} in {period}",
  "🌟 Star trader {trader} earned {amount} in {period}",
  "🔮 Magic touch! {trader} made {amount} in {period}",
];

// Format number with commas
function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format address
function formatAddress(address: string): string {
  if (!address) return 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Calculate time periods
function getTimePeriod(hours: number): Date {
  const now = new Date();
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export class NotificationService {
  
  // Send daily login streak notification
  async notifyDailyLoginStreak(userAddress: string, streak: number, pointsEarned: number): Promise<void> {
    const messages = [
      `🔥 ${streak} day streak! You earned ${pointsEarned} E1XP!`,
      `⚡ Amazing! ${streak} days in a row! +${pointsEarned} E1XP`,
      `💪 Keep it up! ${streak} day streak = ${pointsEarned} E1XP`,
      `🌟 ${streak} days strong! Earned ${pointsEarned} E1XP!`,
    ];
    
    const message = messages[Math.floor(Math.random() * messages.length)];
    const title = `🔥 ${streak} Day Streak!`;

    await storage.createNotification({
      userId: userAddress,
      type: 'streak',
      title,
      message,
      amount: pointsEarned.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'streak');
  }

  // Send E1XP claim reminder
  async notifyE1XPClaimReminder(userAddress: string, availablePoints: number): Promise<void> {
    const title = `⏰ Don't Forget Your E1XP!`;
    const message = `You have ${availablePoints} E1XP waiting to be claimed! Don't break your streak!`;

    await storage.createNotification({
      userId: userAddress,
      type: 'reminder',
      title,
      message,
      amount: availablePoints.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'reminder');
  }

  // Send referral notification to referrer
  async notifyReferralEarned(referrerAddress: string, referredUser: string, bonusPoints: number): Promise<void> {
    const title = `🎉 Referral Bonus!`;
    const message = `${formatAddress(referredUser)} joined using your referral! You earned ${bonusPoints} E1XP (2x bonus)`;

    await storage.createNotification({
      userId: referrerAddress,
      type: 'referral',
      title,
      message,
      amount: bonusPoints.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(referrerAddress, title, message, 'referral');
  }

  // Send new trade notification
  async notifyNewTrade(userAddress: string, coinSymbol: string, tradeType: 'buy' | 'sell', amount: string, earnedPoints?: number): Promise<void> {
    const emoji = tradeType === 'buy' ? '💰' : '💸';
    const action = tradeType === 'buy' ? 'Bought' : 'Sold';
    const title = `${emoji} ${action} ${coinSymbol}!`;
    let message = `Successfully ${action.toLowerCase()} ${coinSymbol} for ${amount}`;
    
    if (earnedPoints) {
      message += ` | +${earnedPoints} E1XP earned!`;
    }

    await storage.createNotification({
      userId: userAddress,
      type: 'trade',
      title,
      message,
      coinSymbol,
      amount: earnedPoints?.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'trade');
  }

  // Send E1XP points earned notification
  async notifyE1XPEarned(userAddress: string, points: number, reason: string): Promise<void> {
    const title = `⚡ E1XP Earned!`;
    const message = `You earned ${points} E1XP for ${reason}`;

    await storage.createNotification({
      userId: userAddress,
      type: 'points',
      title,
      message,
      amount: points.toString(),
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'points');
  }

  // Send welcome bonus notification for new users
  async notifyWelcomeBonus(userAddress: string): Promise<void> {
    const title = `🎁 Welcome to Every1Fun!`;
    const message = `You earned 10 E1XP as a welcome bonus! Come back daily to earn more points and build your streak! 🔥`;

    await storage.createNotification({
      userId: userAddress,
      type: 'reward',
      title,
      message,
      amount: '10',
      createdAt: new Date(),
    });

    await sendTelegramNotification(userAddress, title, message, 'reward');
  }

  // Send new creators to follow notification
  async notifyNewCreatorsToFollow(userAddress: string, creators: Creator[]): Promise<void> {
    const title = `👥 Discover New Creators!`;
    const creatorNames = creators.slice(0, 3).map(c => c.name || formatAddress(c.address)).join(', ');
    const message = `Check out these trending creators: ${creatorNames}${creators.length > 3 ? ` and ${creators.length - 3} more!` : ''}`;

    await storage.createNotification({
      userId: userAddress,
      type: 'creator_suggestion',
      title,
      message,
    });

    await sendTelegramNotification(userAddress, title, message, 'creator_suggestion');
  }

  // Send new follower notification
  async notifyNewFollower(creatorAddress: string, followerAddress: string): Promise<void> {
    const title = `🎉 New Follower!`;
    const message = `${formatAddress(followerAddress)} started following you!`;

    await storage.createNotification({
      userId: creatorAddress,
      type: 'follower',
      title,
      message,
    });

    await sendTelegramNotification(creatorAddress, title, message, 'follower');
  }

  // Send new coin notification
  async notifyNewCoin(userAddress: string, coin: Coin): Promise<void> {
    const title = `🪙 New Coin Alert!`;
    const message = `${coin.name} (${coin.symbol}) just launched! Be an early trader and earn rewards!`;

    await storage.createNotification({
      userId: userAddress,
      type: 'coin_created',
      title,
      message,
      coinAddress: coin.address,
      coinSymbol: coin.symbol,
    });

    await sendTelegramNotification(userAddress, title, message, 'coin_created');
  }

  // Send coin created success notification to creator
  async notifyCoinCreated(creatorAddress: string, coin: Coin): Promise<void> {
    const title = `🎊 Coin Created Successfully!`;
    const message = `Your coin ${coin.name} (${coin.symbol}) is now live! Share it to get more holders and earn rewards!`;

    await storage.createNotification({
      userId: creatorAddress,
      type: 'coin_created',
      title,
      message,
      coinAddress: coin.address,
      coinSymbol: coin.symbol,
    });

    await sendTelegramNotification(creatorAddress, title, message, 'coin_created');
  }

  // Send milestone notification
  async notifyMilestone(userAddress: string, milestone: string, reward?: number): Promise<void> {
    const title = `🏆 Milestone Reached!`;
    let message = `Congratulations! You've ${milestone}`;
    
    if (reward) {
      message += ` | +${reward} E1XP bonus!`;
    }

    await storage.createNotification({
      userId: userAddress,
      type: 'milestone',
      title,
      message,
      amount: reward?.toString(),
    });

    await sendTelegramNotification(userAddress, title, message, 'milestone');
  }

  // Get top creators by total volume
  async getTopCreatorsByVolume(limit: number = 10): Promise<Creator[]> {
    const creators = await storage.getAllCreators();
    return creators
      .sort((a, b) => parseFloat(b.totalVolume || '0') - parseFloat(a.totalVolume || '0'))
      .slice(0, limit);
  }

  // Get top creators by points
  async getTopCreatorsByPoints(limit: number = 10): Promise<Creator[]> {
    const creators = await storage.getAllCreators();
    return creators
      .sort((a, b) => parseFloat(b.points || '0') - parseFloat(a.points || '0'))
      .slice(0, limit);
  }

  // Get top earners from rewards
  async getTopEarners(limit: number = 10, hoursAgo?: number): Promise<Array<{address: string, totalEarnings: number, rewardCount: number}>> {
    const rewards = await storage.getAllRewards();
    
    // Filter by time if specified
    let filteredRewards = rewards;
    if (hoursAgo) {
      const cutoff = getTimePeriod(hoursAgo);
      filteredRewards = rewards.filter(r => new Date(r.createdAt) >= cutoff);
    }

    // Aggregate earnings by recipient
    const earningsMap = new Map<string, { totalEarnings: number, rewardCount: number }>();
    
    for (const reward of filteredRewards) {
      const current = earningsMap.get(reward.recipientAddress) || { totalEarnings: 0, rewardCount: 0 };
      const amount = parseFloat(reward.rewardAmount) / 1e18; // Convert from wei to ETH
      current.totalEarnings += amount;
      current.rewardCount += 1;
      earningsMap.set(reward.recipientAddress, current);
    }

    // Convert to array and sort
    return Array.from(earningsMap.entries())
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, limit);
  }

  // Get top coins (you can customize the metric)
  async getTopCoins(limit: number = 10): Promise<Coin[]> {
    const coins = await storage.getAllCoins();
    // For now, sort by creation date (most recent first)
    // You can modify this to sort by volume or other metrics when available
    return coins
      .filter(c => c.status === 'active' && c.address)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // Get recent trades (based on recent rewards)
  async getRecentTrades(limit: number = 20): Promise<Reward[]> {
    const rewards = await storage.getAllRewards();
    return rewards
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // Send earnings notification with randomized message
  async notifyUserEarnings(userAddress: string, reward: Reward): Promise<void> {
    const amount = (parseFloat(reward.rewardAmount) / 1e18).toFixed(4);
    const template = EARNINGS_MESSAGES[Math.floor(Math.random() * EARNINGS_MESSAGES.length)];
    
    const message = template
      .replace('{amount}', `${amount} ${reward.rewardCurrency}`)
      .replace('{coin}', reward.coinSymbol);

    const title = `💰 Earnings Received!`;
    
    // Save to database
    await storage.createNotification({
      userId: userAddress,
      type: 'reward',
      title,
      message,
      coinAddress: reward.coinAddress,
      coinSymbol: reward.coinSymbol,
      amount: reward.rewardAmount,
      transactionHash: reward.transactionHash,
      createdAt: new Date(),
    });

    // Send to Telegram
    await sendTelegramNotification(
      userAddress,
      title,
      message,
      'reward'
    );
  }

  // Notify about top traders
  async notifyTopTraders(hours: number): Promise<void> {
    const topEarners = await this.getTopEarners(5, hours);
    
    if (topEarners.length === 0) return;

    const periodText = hours <= 10 ? `${hours} hours` : 
                       hours === 24 ? '24 hours' :
                       `${Math.floor(hours / 24)} days`;

    for (const earner of topEarners) {
      const template = TOP_TRADER_MESSAGES[Math.floor(Math.random() * TOP_TRADER_MESSAGES.length)];
      const message = template
        .replace('{trader}', formatAddress(earner.address))
        .replace('{amount}', `$${formatNumber(earner.totalEarnings)}`)
        .replace('{period}', periodText);

      const title = `🏆 Top Trader Alert - ${periodText}`;

      // Broadcast to channel
      const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
      if (TELEGRAM_CHANNEL_ID) {
        try {
          const { bot } = await import('./telegram-bot');
          if (bot) {
            await bot.sendMessage(
              TELEGRAM_CHANNEL_ID,
              `${title}\n\n${message}\n\n💎 Trader: [${formatAddress(earner.address)}](https://zora.co/profile/${earner.address})\n📊 Total Earnings: $${formatNumber(earner.totalEarnings)}\n🎯 Trades: ${earner.rewardCount}`,
              { parse_mode: 'Markdown', disable_web_page_preview: false }
            );
          }
        } catch (error) {
          console.error('Error broadcasting top trader:', error);
        }
      }
    }
  }

  // Send top creators notification
  async sendTopCreatorsNotification(): Promise<void> {
    const topCreators = await this.getTopCreatorsByVolume(10);
    
    if (topCreators.length === 0) return;

    let message = `👑 TOP CREATORS BY VOLUME\n\n`;
    
    topCreators.forEach((creator, index) => {
      const volume = parseFloat(creator.totalVolume || '0');
      message += `${index + 1}. ${creator.name || formatAddress(creator.address)}\n`;
      message += `   💰 Volume: $${formatNumber(volume)}\n`;
      message += `   🪙 Coins: ${creator.totalCoins}\n`;
      message += `   ⭐ Points: ${formatNumber(parseFloat(creator.points || '0'))}\n\n`;
    });

    const title = `👑 Top Creators Leaderboard`;

    // Broadcast to channel
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    if (TELEGRAM_CHANNEL_ID) {
      try {
        const { bot } = await import('./telegram-bot');
        if (bot) {
          await bot.sendMessage(
            TELEGRAM_CHANNEL_ID,
            `${title}\n\n${message}`,
            { parse_mode: 'Markdown', disable_web_page_preview: true }
          );
        }
      } catch (error) {
        console.error('Error broadcasting top creators:', error);
      }
    }
  }

  // Send top earners notification
  async sendTopEarnersNotification(hours?: number): Promise<void> {
    const topEarners = await this.getTopEarners(10, hours);
    
    if (topEarners.length === 0) return;

    const periodText = hours ? 
      (hours <= 10 ? `${hours} hours` : 
       hours === 24 ? '24 hours' :
       `${Math.floor(hours / 24)} days`) : 
      'All Time';

    let message = `💎 TOP EARNERS - ${periodText.toUpperCase()}\n\n`;
    
    topEarners.forEach((earner, index) => {
      message += `${index + 1}. [${formatAddress(earner.address)}](https://zora.co/profile/${earner.address})\n`;
      message += `   💰 Earnings: $${formatNumber(earner.totalEarnings)}\n`;
      message += `   🎯 Trades: ${earner.rewardCount}\n\n`;
    });

    const title = `💎 Top Earners - ${periodText}`;

    // Broadcast to channel
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    if (TELEGRAM_CHANNEL_ID) {
      try {
        const { bot } = await import('./telegram-bot');
        if (bot) {
          await bot.sendMessage(
            TELEGRAM_CHANNEL_ID,
            `${title}\n\n${message}`,
            { parse_mode: 'Markdown', disable_web_page_preview: false }
          );
        }
      } catch (error) {
        console.error('Error broadcasting top earners:', error);
      }
    }
  }

  // Send top coins notification
  async sendTopCoinsNotification(): Promise<void> {
    const topCoins = await this.getTopCoins(10);
    
    if (topCoins.length === 0) return;

    let message = `🏆 TOP TRENDING COINS\n\n`;
    
    topCoins.forEach((coin, index) => {
      message += `${index + 1}. *${coin.name}* (${coin.symbol})\n`;
      message += `   👤 Creator: [${formatAddress(coin.creator_wallet)}](https://zora.co/profile/${coin.creator_wallet})\n`;
      if (coin.address) {
        message += `   🔗 [Trade Now](https://zora.co/creator-coins/base:${coin.address})\n`;
      }
      message += `\n`;
    });

    const title = `🏆 Top Trending Coins`;

    // Broadcast to channel
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    if (TELEGRAM_CHANNEL_ID) {
      try {
        const { bot } = await import('./telegram-bot');
        if (bot) {
          await bot.sendMessage(
            TELEGRAM_CHANNEL_ID,
            `${title}\n\n${message}`,
            { parse_mode: 'Markdown', disable_web_page_preview: false }
          );
        }
      } catch (error) {
        console.error('Error broadcasting top coins:', error);
      }
    }
  }

  // Send top points earners notification
  async sendTopPointsNotification(): Promise<void> {
    const topCreators = await this.getTopCreatorsByPoints(10);
    
    if (topCreators.length === 0) return;

    let message = `⭐ TOP POINTS EARNERS\n\n`;
    
    topCreators.forEach((creator, index) => {
      const points = parseFloat(creator.points || '0');
      message += `${index + 1}. ${creator.name || formatAddress(creator.address)}\n`;
      message += `   ⭐ Points: ${formatNumber(points)}\n`;
      message += `   🪙 Coins: ${creator.totalCoins}\n`;
      message += `   📊 Volume: $${formatNumber(parseFloat(creator.totalVolume || '0'))}\n\n`;
    });

    const title = `⭐ Top Points Earners`;

    // Broadcast to channel
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    if (TELEGRAM_CHANNEL_ID) {
      try {
        const { bot } = await import('./telegram-bot');
        if (bot) {
          await bot.sendMessage(
            TELEGRAM_CHANNEL_ID,
            `${title}\n\n${message}`,
            { parse_mode: 'Markdown', disable_web_page_preview: true }
          );
        }
      } catch (error) {
        console.error('Error broadcasting top points:', error);
      }
    }
  }

  // Send recent trades notification
  async sendRecentTradesNotification(): Promise<void> {
    const recentTrades = await this.getRecentTrades(10);
    
    if (recentTrades.length === 0) return;

    let message = `📊 RECENT TRADING ACTIVITY\n\n`;
    
    recentTrades.forEach((trade, index) => {
      const amount = (parseFloat(trade.rewardAmount) / 1e18).toFixed(4);
      message += `${index + 1}. ${trade.coinSymbol}\n`;
      message += `   💰 ${amount} ${trade.rewardCurrency}\n`;
      message += `   👤 [${formatAddress(trade.recipientAddress)}](https://zora.co/profile/${trade.recipientAddress})\n`;
      message += `   🔗 [Tx](https://basescan.org/tx/${trade.transactionHash})\n\n`;
    });

    const title = `📊 Recent Trades`;

    // Broadcast to channel
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    if (TELEGRAM_CHANNEL_ID) {
      try {
        const { bot } = await import('./telegram-bot');
        if (bot) {
          await bot.sendMessage(
            TELEGRAM_CHANNEL_ID,
            `${title}\n\n${message}`,
            { parse_mode: 'Markdown', disable_web_page_preview: false }
          );
        }
      } catch (error) {
        console.error('Error broadcasting recent trades:', error);
      }
    }
  }

  // Weekly top earners (convenience method)
  async sendWeeklyTopEarnersNotification(): Promise<void> {
    await this.sendTopEarnersNotification(24 * 7); // 7 days
  }

  // Send all periodic notifications
  async sendAllPeriodicNotifications(): Promise<void> {
    console.log('📢 Sending periodic notifications...');
    
    try {
      await this.sendTopCreatorsNotification();
      await this.sendTopEarnersNotification(24); // 24h
      await this.sendTopCoinsNotification();
      await this.sendTopPointsNotification();
      await this.sendRecentTradesNotification();
      
      console.log('✅ All periodic notifications sent successfully');
    } catch (error) {
      console.error('❌ Error sending periodic notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
