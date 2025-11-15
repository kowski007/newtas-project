import type { Express } from "express";
import { createServer, type Server } from "http";
// Use the Supabase-backed storage implementation which includes notifications, push subscriptions, and moderation
import { storage } from "./supabase-storage";
import { createAdminRouter } from "./routes/admin";
import registryRouter from "./routes/registry";
import { registerAdminRegistryRoutes } from "./routes/admin-registry";
import { serveStatic } from "./vite";
import {
  insertScrapedContentSchema,
  insertCoinSchema,
  updateCoinSchema,
  insertCommentSchema,
  insertNotificationSchema,
  insertFollowSchema,
  insertReferralSchema,
  users,
  referrals,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { awardPoints as rewardPoints, POINTS_REWARDS } from "./points";
import axios from "axios";
import { detectPlatform } from "./platform-detector";
import { scrapeByPlatform } from "./platform-scrapers";
import { migrateOldData } from "./migrate-old-data";
import { sendTelegramNotification } from "./telegram-bot";
import { RegistryService } from "./registry-service";
import { ActivityTrackerService } from "./activity-tracker-service";
import { base } from "viem/chains";
import { handleFileUpload } from "./upload-handler"; // Import the upload handler
import { walletAuthMiddleware, type AuthenticatedRequest } from "./privy-middleware";

// Placeholder functions for OG meta generation (implement these based on your needs)
const generateProfileOGMeta = (creator: any, baseUrl: string) => ({
  title: `${creator.name || 'User'} on CoinIT`,
  description: creator.bio || 'Check out this creator on CoinIT!',
  image: creator.avatar || `${baseUrl}/default-avatar.png`,
  url: `${baseUrl}/profile/${creator.address}`,
});

const generateCoinOGMeta = (coin: any, baseUrl: string) => ({
  title: `${coin.name} (${coin.symbol})`,
  description: coin.description || `Discover ${coin.name} (${coin.symbol}) on CoinIT.`,
  image: coin.image || `${baseUrl}/default-coin-image.png`,
  url: `${baseUrl}/coins/${coin.address}`,
});

const generateProjectOGMeta = (project: any, baseUrl: string) => ({
  title: project.name,
  description: project.description || `Learn more about ${project.name}.`,
  image: project.image || `${baseUrl}/default-project-image.png`,
  url: `${baseUrl}/projects/${project.id}`,
});

const generateReferralOGMeta = (creator: any, baseUrl: string) => ({
  title: `${creator.name || 'User'} invited you to CoinIT!`,
  description: `Join CoinIT and start your crypto journey! Use referral code ${creator.referralCode}.`,
  image: creator.avatar || `${baseUrl}/default-referral-banner.png`,
  url: `${baseUrl}/?ref=${creator.referralCode}`,
});

// Helper function to award points to a user
async function awardPoints(
  userId: string,
  amount: number,
  type: string,
  title: string,
  metadata?: Record<string, any>,
): Promise<void> {
  const creator = await storage.getCreatorByAddress(userId);
  if (!creator) {
    console.error(`[awardPoints] Creator not found for user: ${userId}`);
    return;
  }

  // Update creator's points
  const currentPoints = parseInt(creator.points || "0");
  const newPoints = (currentPoints + amount).toString();
  await storage.updateCreator(creator.id, { points: newPoints });

  // Create an E1XP reward record
  await storage.createE1xpReward({
    userId: userId,
    amount: amount.toString(),
    type: type,
    title: title,
    message: title, // Using title as message for simplicity here
    metadata: metadata || {},
  });

  // Create an in-app notification
  await storage.createNotification({
    userId: userId,
    type: "reward",
    title: title,
    message: `You earned ${amount} E1XP!`,
    amount: amount.toString(),
    read: false,
  });
}

// Helper function to get referral code from username/name
async function generateReferralCode(address: string): Promise<string> {
  const creator = await storage.getCreatorByAddress(address);

  if (creator?.name) {
    // Use username/name as referral code
    await storage.updateCreator(creator.id, {
      referralCode: creator.name
    });
    return creator.name;
  }

  // Fallback to shortened address if no name
  const code = address.slice(0, 8);
  if (creator) {
    await storage.updateCreator(creator.id, {
      referralCode: code
    });
  }
  return code;
}

// Helper function to sync or create a creator profile
export async function syncCreatorProfile(privyId: string, address: string | null, email: string | null) {
  console.log('[syncCreatorProfile] Syncing creator:', { privyId, address, email });

  // First, check if creator exists by privyId
  let creator = await storage.getCreatorByPrivyId(privyId);

  if (creator) {
    console.log('[syncCreatorProfile] Found existing creator by privyId:', creator.id);
    // Update existing creator with latest address if changed
    const updates: any = {};
    if (address && address !== creator.address) {
      updates.address = address;
    }
    if (Object.keys(updates).length > 0) {
      creator = await storage.updateCreator(creator.id, updates);
      console.log('[syncCreatorProfile] Updated creator with new address');
    }
    return creator;
  }

  // If not found by privyId, check by address (legacy creators)
  if (address) {
    creator = await storage.getCreatorByAddress(address);
    if (creator) {
      console.log('[syncCreatorProfile] Found legacy creator by address, backfilling privyId');
      // Backfill privyId for legacy creator
      creator = await storage.updateCreator(creator.id, { privyId });
      return creator;
    }
  }

  // Generate a default username for email users
  const { getDefaultUsername } = await import("./username-generator");
  const defaultUsername = getDefaultUsername(email, privyId);

  console.log('[syncCreatorProfile] Creating new creator with username:', defaultUsername);

  // Create new creator with privyId (address can be null for email users)
  const creatorData = {
    privyId,
    address: address || null,
    email: email || null,
    name: defaultUsername,
    bio: null,
    avatar: null,
    walletAddress: null,
    verified: "false",
    totalCoins: "0",
    totalVolume: "0",
    followers: "0",
    referralCode: defaultUsername, // Use generated username as referral code
    points: "100", // Welcome bonus
  };

  creator = await storage.createCreator(creatorData);
  console.log('[syncCreatorProfile] Successfully created new creator:', creator.id, 'with email:', email);

  // Also create user record for email users (for modern user tracking)
  if (email && !address) {
    try {
      await storage.createUser({
        privyId,
        email,
        username: defaultUsername,
        displayName: defaultUsername,
        e1xpPoints: 100,
      });
      console.log('[syncCreatorProfile] Created user record for email user:', email);
    } catch (userError) {
      console.warn('[syncCreatorProfile] Could not create user record:', userError);
    }
  }

  // Send welcome notification and E1XP reward
  try {
    const userId = creator.address || creator.id;
    const welcomePoints = 100;

    // Create welcome notification
    await storage.createNotification({
      userId: userId,
      type: 'reward',
      title: '🎁 Welcome to Every1.fun!',
      message: `You earned ${welcomePoints} E1XP as a welcome bonus! Come back daily to earn more points and build your streak! 🔥`,
      amount: welcomePoints.toString(),
      read: false,
    });

    // Create E1XP reward record
    await storage.createE1xpReward({
      userId: userId,
      amount: welcomePoints.toString(),
      type: 'welcome',
      title: '🎉 Welcome Bonus!',
      message: `Welcome to Every1.fun! You've earned ${welcomePoints} E1XP to get started!`,
      metadata: { 
        isWelcomeBonus: true,
        timestamp: new Date().toISOString()
      },
    });

    // Send real-time notification via Socket.IO if user is connected
    const { emitNotificationToUser } = await import('./socket-server');
    emitNotificationToUser(userId, {
      type: 'reward',
      title: '🎁 Welcome to Every1.fun!',
      message: `You earned ${welcomePoints} E1XP as a welcome bonus!`,
      amount: welcomePoints.toString(),
    });

    // Send Telegram notification if address available
    if (address) {
      try {
        await sendTelegramNotification(
          address,
          '🎁 Welcome to Every1.fun!',
          `Welcome! You've earned ${welcomePoints} E1XP points to get started. Come back daily to earn more points and build your streak! 🔥`,
          'reward'
        );
      } catch (telegramError) {
        console.warn('[syncCreatorProfile] Failed to send Telegram welcome notification:', telegramError);
      }
    }

    console.log(`[syncCreatorProfile] Sent welcome notification and ${welcomePoints} E1XP to new user ${userId}`);
  } catch (notificationError) {
    console.error('[syncCreatorProfile] Failed to send welcome notifications:', notificationError);
    // Don't fail the whole request if notifications fail
  }

  return creator;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // GeckoTerminal API endpoints
  app.get(
    "/api/geckoterminal/pools/:network/:tokenAddress",
    async (req, res) => {
      try {
        const { network, tokenAddress } = req.params;
        const page = parseInt((req.query.page as string) || "1");

        const response = await axios.get(
          `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${tokenAddress}/pools`,
          { params: { page } },
        );

        res.json(response.data);
      } catch (error) {
        console.error("GeckoTerminal pool search error:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch pool data from GeckoTerminal" });
      }
    },
  );

  app.get("/api/geckoterminal/pool/:network/:poolAddress", async (req, res) => {
    try {
      const { network, poolAddress } = req.params;
      const include = (req.query.include as string) || "base_token,quote_token";

      const response = await axios.get(
        `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}`,
        { params: { include } },
      );

      res.json(response.data);
    } catch (error) {
      console.error("GeckoTerminal pool data error:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch pool details from GeckoTerminal" });
    }
  });

  app.get(
    "/api/geckoterminal/ohlcv/:network/:poolAddress/:timeframe",
    async (req, res) => {
      try {
        const { network, poolAddress, timeframe } = req.params;
        const {
          aggregate = "1",
          limit = "100",
          currency = "usd",
          token = "base",
        } = req.query;

        const response = await axios.get(
          `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}`,
          { params: { aggregate, limit, currency, token } },
        );

        res.json(response.data);
      } catch (error) {
        console.error("GeckoTerminal OHLCV data error:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch chart data from GeckoTerminal" });
      }
    },
  );

  // File upload endpoint
  app.post("/api/upload", handleFileUpload);

  // Create scraped content endpoint (for direct content creation)
  app.post("/api/scraped-content", async (req, res) => {
    try {
      const validatedData = insertScrapedContentSchema.parse(req.body);
      const stored = await storage.createScrapedContent(validatedData);
      res.json(stored);
    } catch (error) {
      console.error("Create scraped content error:", error);
      res.status(400).json({
        error: "Invalid scraped content data",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Scrape URL endpoint
  app.post("/api/scrape", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Detect platform
      const platformInfo = detectPlatform(url);

      // Scrape content using platform-specific logic
      const scrapedData = await scrapeByPlatform(url, platformInfo.type);

      // Validate and store
      const validatedData = insertScrapedContentSchema.parse(scrapedData);
      const stored = await storage.createScrapedContent(validatedData);

      res.json(stored);
    } catch (error) {
      console.error("Scraping error:", error);

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          return res.status(408).json({
            error: "Request timeout - the page took too long to load",
          });
        }
        if (error.response?.status === 404) {
          return res.status(404).json({
            error: "Page not found - please check the URL is correct",
          });
        }
        if (error.response?.status === 403) {
          return res.status(403).json({
            error: "Access forbidden - this platform blocks automated access",
          });
        }
        if (error.response?.status === 429) {
          return res.status(429).json({
            error:
              "Rate limit exceeded - Instagram and TikTok often block scrapers. Try YouTube, Medium, or blog URLs instead.",
          });
        }
      }

      res.status(500).json({
        error:
          "Failed to scrape content - some platforms block automated access. Try a different URL or platform.",
      });
    }
  });

  // Get all coins
  app.get("/api/coins", async (req, res) => {
    try {
      const coins = await storage.getAllCoins();

      // Add platform detection to each coin based on available fields
      const coinsWithPlatform = coins.map((coin) => {
        let platform = "all";

        // Check multiple sources for URL
        const urls = [coin.image, coin.description, coin.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (urls.includes("youtube.com") || urls.includes("youtu.be")) {
          platform = "youtube";
        } else if (
          urls.includes("warpcast.com") ||
          urls.includes("farcaster")
        ) {
          platform = "farcaster";
        } else if (urls.includes("gitcoin.co")) {
          platform = "gitcoin";
        } else if (
          urls.includes("spotify.com") ||
          urls.includes("open.spotify")
        ) {
          platform = "spotify";
        } else if (urls.includes("tiktok.com")) {
          platform = "tiktok";
        } else if (urls.includes("instagram.com")) {
          platform = "instagram";
        } else if (urls.includes("medium.com")) {
          platform = "medium";
        } else if (urls.includes("giveth.io")) {
          platform = "giveth";
        } else if (urls.includes("twitter.com") || urls.includes("x.com")) {
          platform = "twitter";
        } else if (
          urls.includes("blog") ||
          urls.includes("wordpress") ||
          urls.includes("blogspot")
        ) {
          platform = "blog";
        }

        return {
          ...coin,
          platform,
        };
      });

      res.json(coinsWithPlatform);
    } catch (error: any) {
      console.error("Error fetching coins:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get pinned coins (ordered by pin_order)
  app.get("/api/coins/pinned", async (req, res) => {
    try {
      const pinnedCoins = await storage.getPinnedCoins();
      res.json(pinnedCoins || []);
    } catch (error: any) {
      console.error("Error fetching pinned coins:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get coins by creator
  app.get("/api/coins/creator/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const coins = await storage.getCoinsByCreator(address);
      res.json(coins);
    } catch (error) {
      console.error("Get creator coins error:", error);
      res.status(500).json({ error: "Failed to fetch creator coins" });
    }
  });

  // Create coin
  app.post("/api/coins", async (req, res) => {
    try {
      console.log("📥 Received coin data:", JSON.stringify(req.body, null, 2));
      const validatedData = insertCoinSchema.parse(req.body);
      console.log("✅ Validation passed:", JSON.stringify(validatedData, null, 2));
      const coin = await storage.createCoin(validatedData);

      // Auto-create or update creator (only if creator address exists)
      const creatorAddress = validatedData.creatorWallet;
      if (!creatorAddress) {
        return res.status(400).json({ error: "Creator address is required" });
      }

      let creator = await storage.getCreatorByAddress(creatorAddress);
      if (!creator) {
        // Create new creator with referral code (will be set when they set username)
        creator = await storage.createCreator({
          address: creatorAddress,
          totalCoins: "1",
          totalVolume: "0",
          followers: "0",
          referralCode: null,
        });
      } else {
        // Update existing creator's coin count
        const newTotalCoins = (parseInt(creator.totalCoins) + 1).toString();
        await storage.updateCreator(creator.id, {
          totalCoins: newTotalCoins,
        });
      }

      // Create in-app notification for coin creation (optional - don't fail if this errors)
      try {
        await storage.createNotification({
          userId: creatorAddress,
          type: "coin_created",
          title: "🪙 Coin Created Successfully!",
          message: `Your coin "${coin.name}" (${coin.symbol}) has been created${coin.address ? " and is now live on the blockchain!" : "!"}`,
          coinAddress: coin.address,
          coinSymbol: coin.symbol,
          read: false,
        });
      } catch (error) {
        console.warn("Failed to create notification:", error);
      }

      // Notify creator about successful coin creation (optional)
      try {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyCoinCreated(creatorAddress, coin);
      } catch (error) {
        console.warn("Failed to send notification service:", error);
      }

      // Send real-time Socket.IO notification
      try {
        const io = (await import("./socket-server")).io;
        if (io) {
          io.to(creatorAddress).emit('notification', {
            type: 'coin_created',
            title: '🪙 Coin Created Successfully!',
            message: `Your coin "${coin.name}" (${coin.symbol}) is now live!`,
            coinAddress: coin.address,
            coinSymbol: coin.symbol,
            timestamp: new Date().toISOString()
          });
          console.log(`📢 Sent real-time notification to ${creatorAddress}`);
        }
      } catch (error) {
        console.warn("Failed to send Socket.IO notification:", error);
      }

      // Award E1XP for coin creation (optional - don't fail if table doesn't exist)
      try {
        const e1xpAmount = 100; // Base reward for creating a coin
        await storage.createE1xpReward({
          userId: creatorAddress,
          amount: e1xpAmount.toString(),
          type: "coin_creation",
          title: "🎉 Coin Created!",
          message: `Congratulations! You earned ${e1xpAmount} E1XP for creating ${coin.name} (${coin.symbol})! 🚀`,
          metadata: {
            coinId: coin.id,
            coinAddress: coin.address,
            coinSymbol: coin.symbol,
            coinName: coin.name,
          },
        });

        // Send notification about the claimable reward
        await storage.createNotification({
          userId: creatorAddress,
          type: "reward",
          title: "🎁 E1XP Reward Available!",
          message: `You have ${e1xpAmount} E1XP waiting to be claimed for creating ${coin.symbol}! Claim it now in the Points page.`,
          amount: e1xpAmount.toString(),
          coinAddress: coin.address,
          coinSymbol: coin.symbol,
          read: false,
        });
      } catch (error) {
        console.warn("Failed to create E1XP reward (table may not exist):", error);
      }

      // Record on-chain if coin has been deployed (has address)
      if (coin.address && coin.status === "active") {
        try {
          const { activityTrackerService } = await import(
            "./activity-tracker.js"
          );
          const txHash = await activityTrackerService.recordCoinCreation(
            coin.address as `0x${string}`,
            creatorAddress as `0x${string}`,
            coin.image || "",
            coin.name,
            coin.symbol,
          );

          if (txHash) {
            console.log(`✅ Coin ${coin.symbol} recorded on-chain: ${txHash}`);
          }
        } catch (error) {
          console.error("Failed to record coin creation on-chain:", error);
          // Don't fail the request if on-chain recording fails
        }
      }

      // Send Telegram notification for coin creation (optional)
      try {
        await sendTelegramNotification(
          creatorAddress,
          "New Coin Created! 🪙",
          `Your coin "${coin.name}" (${coin.symbol}) has been created successfully!${coin.address ? "\n\nAddress: " + coin.address : ""}`,
          "coin_created",
          coin,
          undefined, // Stats will be fetched if coin has an address
        );
      } catch (error) {
        console.warn("Failed to send Telegram notification:", error);
      }

      res.json(coin);
    } catch (error) {
      console.error("❌ Create coin error:", error);
      
      // Better error handling for Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as any;
        console.error("Validation issues:", JSON.stringify(zodError.issues, null, 2));
        return res.status(400).json({
          error: "Invalid coin data",
          details: zodError.issues,
        });
      }
      
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      
      // Send real-time failure notification
      try {
        const io = (await import("./socket-server")).io;
        if (io && creatorAddress) {
          io.to(creatorAddress).emit('notification', {
            type: 'coin_creation_failed',
            title: '❌ Coin Creation Failed',
            message: `Failed to create coin: ${errorMessage.substring(0, 100)}`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (socketError) {
        console.warn("Failed to send failure notification:", socketError);
      }
      
      return res.status(400).json({
        error: "Invalid coin data",
        details: errorMessage,
      });
    }
  });

  // Update coin
  app.patch("/api/coins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateCoinSchema.parse(req.body);
      const coin = await storage.updateCoin(id, validatedData);
      if (!coin) {
        return res.status(404).json({ error: "Coin not found" });
      }

      // Create in-app notification when coin becomes active
      if (
        validatedData.status === "active" &&
        validatedData.address &&
        coin.creatorWallet
      ) {
        await storage.createNotification({
          userId: coin.creatorWallet,
          type: "coin_created",
          title: "🚀 Coin Deployed Successfully!",
          message: `Your coin "${coin.name}" (${coin.symbol}) is now live on the blockchain! Address: ${validatedData.address}`,
          coinAddress: validatedData.address,
          coinSymbol: coin.symbol,
          read: false,
        });

        // Also send Telegram notification
        await sendTelegramNotification(
          coin.creatorWallet,
          "🪙 Coin Deployed Successfully!",
          `Your coin "${coin.name}" (${coin.symbol}) is now live on the blockchain!\n\nAddress: ${validatedData.address}\n\n🚀 Start trading now!`,
          "coin_created",
          coin,
          undefined, // Stats will be fetched if needed
        );

        // Award E1XP for successful deployment
        const deploymentReward = 50; // Bonus for deployment
        await storage.createE1xpReward({
          userId: coin.creatorWallet,
          amount: deploymentReward.toString(),
          type: "coin_creation",
          title: "🚀 Coin Deployed!",
          message: `Amazing! Your coin ${coin.symbol} is now live on the blockchain! You earned ${deploymentReward} E1XP bonus! 💎`,
          metadata: {
            coinId: coin.id,
            coinAddress: validatedData.address,
            coinSymbol: coin.symbol,
            coinName: coin.name,
          },
        });

        // Send notification about deployment reward
        await storage.createNotification({
          userId: coin.creatorWallet,
          type: "reward",
          title: "🎁 Deployment Bonus!",
          message: `You have ${deploymentReward} E1XP waiting for deploying ${coin.symbol} on-chain! Claim it now.`,
          amount: deploymentReward.toString(),
          coinAddress: validatedData.address,
          coinSymbol: coin.symbol,
          read: false,
        });
      }

      res.json(coin);
    } catch (error) {
      console.error("Update coin error:", error);
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  // Get coin by address
  app.get("/api/coins/address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const coin = await storage.getCoinByAddress(address);
      if (!coin) {
        return res.status(404).json({ error: "Coin not found" });
      }
      res.json(coin);
    } catch (error) {
      console.error("Get coin error:", error);
      res.status(500).json({ error: "Failed to fetch coin" });
    }
  });

  // Migrate old data endpoint
  app.post("/api/migrate", async (_req, res) => {
    try {
      const coinsResult = await migrateOldData();
      const { migrateOldRewards } = await import("./migrate-old-data");
      const rewardsResult = await migrateOldRewards();

      res.json({
        coins: coinsResult,
        rewards: rewardsResult,
        summary: {
          totalMigrated: coinsResult.count + rewardsResult.count,
          coinsCount: coinsResult.count,
          rewardsCount: rewardsResult.count,
        },
      });
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ error: "Migration failed" });
    }
  });

  // Broadcast all existing coins to Telegram
  app.post("/api/telegram/broadcast-coins", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();

      if (coins.length === 0) {
        return res.json({
          success: true,
          message: "No coins to broadcast",
          broadcasted: 0,
        });
      }

      // Broadcast coins one by one with professional formatting
      let successCount = 0;
      const errors: string[] = [];

      for (const coin of coins) {
        try {
          // Only broadcast coins that have addresses (deployed coins)
          if (coin.address && coin.creatorWallet) {
            await sendTelegramNotification(
              coin.creatorWallet,
              "New Coin Created",
              "",
              "coin_created",
              coin,
              undefined,
            );
            successCount++;

            // Add a small delay between broadcasts to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errors.push(`${coin.name}: ${errorMsg}`);
          console.error(`Failed to broadcast coin ${coin.name}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Broadcasted ${successCount} out of ${coins.length} coins`,
        broadcasted: successCount,
        total: coins.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Broadcast error:", error);
      res.status(500).json({ error: "Broadcast failed" });
    }
  });

  // Create reward endpoint (for tracking platform and trade fees)
  app.post("/api/rewards", async (req, res) => {
    try {
      const validatedData = insertReferralSchema.parse(req.body); // Assuming reward schema is similar to referral for now, adjust if different

      const {
        type,
        coinAddress,
        coinSymbol,
        transactionHash,
        rewardAmount,
        recipientAddress,
        traderAddress,
      } = validatedData;

      if (
        !type ||
        !coinAddress ||
        !coinSymbol ||
        !transactionHash ||
        !rewardAmount ||
        !recipientAddress
      ) {
        return res
          .status(400)
          .json({ error: "Missing required reward fields" });
      }

      const reward = await storage.createReward({
        type,
        coinAddress,
        coinSymbol,
        transactionHash,
        rewardAmount,
        rewardCurrency: "ZORA", // Default currency, adjust if needed
        recipientAddress,
      });

      // Record fees on-chain if activity tracker is configured
      if (traderAddress) {
        const { activityTrackerService } = await import(
          "./activity-tracker.js"
        );

        // Calculate creator and platform fees based on type
        const rewardAmountBigInt = BigInt(rewardAmount);
        let creatorFee = 0n;
        let platformFee = 0n;

        if (type === "platform") {
          platformFee = rewardAmountBigInt;
        } else if (type === "trade") {
          creatorFee = rewardAmountBigInt;
        }

        // Record to blockchain
        await activityTrackerService.recordFees(
          coinAddress as `0x${string}`,
          traderAddress as `0x${string}`,
          creatorFee,
          platformFee,
        );
      }

      // Send earnings notification to creator (for trade fees only, not platform)
      if (type === "trade" && recipientAddress) {
        // Use notification service for randomized earnings messages
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyUserEarnings(recipientAddress, reward);

        // Also send trade notification
        const amount = (parseFloat(reward.rewardAmount) / 1e18).toFixed(4);
        await notificationService.notifyNewTrade(
          recipientAddress,
          reward.coinSymbol,
          'buy',
          `${amount} ${reward.rewardCurrency}`
        );
      }

      res.json(reward);
    } catch (error) {
      console.error("Create reward error:", error);
      res.status(500).json({ error: "Failed to create reward" });
    }
  });

  // Get all rewards
  app.get("/api/rewards", async (_req, res) => {
    try {
      const rewards = await storage.getAllRewards();
      res.json(rewards);
    } catch (error) {
      console.error("Get rewards error:", error);
      res.status(500).json({ error: "Failed to fetch rewards" });
    }
  });

  // Get rewards by coin
  app.get("/api/rewards/coin/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const rewards = await storage.getRewardsByCoin(address);
      res.json(rewards);
    } catch (error) {
      console.error("Get coin rewards error:", error);
      res.status(500).json({ error: "Failed to fetch coin rewards" });
    }
  });

  // Check coin's platform referral status and earnings
  app.get("/api/rewards/coin/:address/status", async (req, res) => {
    try {
      const { address } = req.params;

      // Get coin info
      const coin = await storage.getCoinByAddress(address);
      if (!coin) {
        return res.status(404).json({ error: "Coin not found" });
      }

      // Get all rewards for this coin
      const rewards = await storage.getRewardsByCoin(address);

      // Calculate earnings
      const platformFees = rewards
        .filter((r) => r.type === "platform")
        .reduce((sum, r) => sum + parseFloat(r.rewardAmount) / 1e18, 0);

      const tradeFees = rewards
        .filter((r) => r.type === "trade")
        .reduce((sum, r) => sum + parseFloat(r.rewardAmount) / 1e18, 0);

      const totalEarnings = platformFees + tradeFees;

      // Check if platform referral was likely set (has platform rewards)
      const hasPlatformReferral = rewards.some((r) => r.type === "platform");

      res.json({
        coinAddress: address,
        coinSymbol: coin.symbol,
        coinName: coin.name,
        status: coin.status,
        hasPlatformReferral,
        platformReferralAddress: hasPlatformReferral
          ? rewards.find((r) => r.type === "platform")?.recipientAddress
          : null,
        earnings: {
          total: totalEarnings,
          platform: platformFees,
          trade: tradeFees,
          currency: "ZORA",
        },
        rewardsCount: {
          total: rewards.length,
          platform: rewards.filter((r) => r.type === "platform").length,
          trade: rewards.filter((r) => r.type === "trade").length,
        },
        firstReward: rewards.length > 0 ? rewards.length - 1 : null,
        lastReward: rewards.length > 0 ? rewards[0].createdAt : null,
      });
    } catch (error) {
      console.error("Get coin status error:", error);
      res.status(500).json({ error: "Failed to fetch coin status" });
    }
  });

  // Get rewards by recipient
  app.get("/api/rewards/recipient/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const rewards = await storage.getRewardsByRecipient(address);
      res.json(rewards);
    } catch (error) {
      console.error("Get recipient rewards error:", error);
      res.status(500).json({ error: "Failed to fetch recipient rewards" });
    }
  });

  // Record a new reward (duplicate endpoint - should be consolidated)
  app.post("/api/rewards/record", async (req, res) => {
    try {
      const rewardData = {
        type: req.body.type, // 'platform' or 'trade'
        coinAddress: req.body.coinAddress,
        coinSymbol: req.body.coinSymbol,
        transactionHash: req.body.transactionHash,
        rewardAmount: req.body.rewardAmount, // In wei as string
        rewardCurrency: req.body.rewardCurrency || "ZORA",
        recipientAddress: req.body.recipientAddress,
      };

      const reward = await storage.createReward(rewardData);

      // Send earnings notification if it's a trade reward
      if (rewardData.type === "trade" && rewardData.recipientAddress) {
        const { notificationService } = await import("./notification-service");
        await notificationService.notifyUserEarnings(
          rewardData.recipientAddress,
          reward,
        );

        // Also send trade notification
        const amount = (parseFloat(reward.rewardAmount) / 1e18).toFixed(4);
        await notificationService.notifyNewTrade(
          rewardData.recipientAddress,
          reward.coinSymbol,
          'buy',
          `${amount} ${reward.rewardCurrency}`
        );
      }

      res.json(reward);
    } catch (error) {
      console.error("Create reward error:", error);
      res.status(400).json({ error: "Invalid reward data" });
    }
  });

  // Get all users with earnings stats
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const coins = await storage.getAllCoins();
      const rewards = await storage.getAllRewards();

      // Calculate stats for each user
      const usersWithStats = users.map(user => {
        const userAddress = user.walletAddress?.toLowerCase();

        // Count coins created by this user
        const userCoins = coins.filter(coin => 
          coin.creatorWallet?.toLowerCase() === userAddress
        );

        // Calculate total earnings from rewards
        const userRewards = rewards.filter(reward => 
          reward.recipientAddress?.toLowerCase() === userAddress
        );

        const totalEarnings = userRewards.reduce((sum, reward) => {
          const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
          return sum + amount;
        }, 0);

        return {
          ...user,
          totalCoins: userCoins.length,
          totalEarnings: totalEarnings.toFixed(4),
        };
      });

      res.json(usersWithStats);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get all creators with earnings stats
  app.get("/api/creators", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      const coins = await storage.getAllCoins();
      const rewards = await storage.getAllRewards();

      // Get follower/following counts and earnings for each creator
      const creatorsWithCounts = await Promise.all(
        creators.map(async (creator) => {
          const followers = await storage.getFollowers(creator.address);
          const following = await storage.getFollowing(creator.address);

          const creatorAddress = creator.address?.toLowerCase();

          // Count coins created by this creator
          const creatorCoins = coins.filter(coin => 
            coin.creatorWallet?.toLowerCase() === creatorAddress
          );

          // Calculate total earnings from rewards
          const creatorRewards = rewards.filter(reward => 
            reward.recipientAddress?.toLowerCase() === creatorAddress
          );

          const totalEarnings = creatorRewards.reduce((sum, reward) => {
            const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
            return sum + amount;
          }, 0);

          return {
            ...creator,
            followerCount: followers.length,
            followingCount: following.length,
            totalCoins: creatorCoins.length,
            totalEarnings: totalEarnings.toFixed(4),
          };
        })
      );

      res.json(creatorsWithCounts);
    } catch (error) {
      console.error("Get creators error:", error);
      res.status(500).json({ error: "Failed to fetch creators" });
    }
  });

  // Get top creators
  app.get("/api/creators/top", async (req, res) => {
    try {
      const creators = await storage.getTopCreators();
      res.json(creators);
    } catch (error) {
      console.error("Get top creators error:", error);
      res.status(500).json({ error: "Failed to fetch top creators" });
    }
  });

  // Get creator by Privy ID
  app.get("/api/creators/privy/:privyId", async (req, res) => {
    try {
      const { privyId } = req.params;

      if (!privyId) {
        return res.status(400).json({ error: "Privy ID is required" });
      }

      const creator = await storage.getCreatorByPrivyId(privyId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      res.json(creator);
    } catch (error) {
      console.error("Error fetching creator by privyId:", error);
      res.status(500).json({ error: "Failed to fetch creator" });
    }
  });

  // Get creator by address (kept for backwards compatibility)
  app.get("/api/creators/address/:address", async (req, res) => {
    const { address } = req.params;
    try {
      const creator = await storage.getCreatorByAddress(address);
      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }
      res.json(creator);
    } catch (error: any) {
      console.error("Error fetching creator:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get creator by username
  app.get("/api/creators/username/:username", async (req, res) => {
    const { username } = req.params;
    try {
      const creators = await storage.getAllCreators();
      const creator = creators.find(
        (c) => c.name?.toLowerCase() === username.toLowerCase(),
      );
      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }
      res.json(creator);
    } catch (error: any) {
      console.error("Error fetching creator:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get admin stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const creators = await storage.getAllCreators();
      const rewards = await storage.getAllRewards();

      // Calculate total coins
      const totalCoins = coins.length;

      // Calculate total volume from all creator trading activity
      const totalVolume = creators.reduce((sum, creator) => {
        const volume = parseFloat(creator.totalVolume || '0');
        return sum + volume;
      }, 0);

      // Market cap calculation
      // Note: Accurate market cap requires fetching live (price × circulating supply)
      // for each coin from Zora API. For now, using totalVolume as an approximation
      // since volume represents actual value transacted on the platform.
      // Future enhancement: integrate per-coin market cap aggregation from Zora SDK
      const totalMarketCap = totalVolume;

      // Calculate total earnings from rewards
      const totalEarnings = rewards.reduce((sum, reward) => {
        const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
        return sum + amount;
      }, 0);

      // Calculate platform fees and trade fees
      // Platform fees use type 'platform', trade fees use type 'trade'
      const platformFees = rewards
        .filter(r => r.type === 'platform')
        .reduce((sum, reward) => {
          const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
          return sum + amount;
        }, 0);

      const tradeFees = rewards
        .filter(r => r.type === 'trade')
        .reduce((sum, reward) => {
          const amount = parseFloat(reward.rewardAmount || '0') / 1e18;
          return sum + amount;
        }, 0);

      res.json({
        totalCoins,
        totalMarketCap: totalMarketCap.toFixed(2),
        totalVolume: totalVolume.toFixed(2),
        totalEarnings: totalEarnings.toFixed(4),
        platformFees: platformFees.toFixed(4),
        tradeFees: tradeFees.toFixed(4),
      });
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // Sync creator profile on login (Privy ID-based with legacy support)
  app.post("/api/creators/sync", async (req, res) => {
    try {
      const { privyId, address, email } = req.body;

      if (!privyId) {
        console.error('[Creator Sync] Missing Privy ID');
        return res.status(400).json({ error: "Privy ID is required" });
      }

      console.log('[Creator Sync] Syncing creator:', { privyId, address, email });

      // First, check if creator exists by privyId
      let creator = await storage.getCreatorByPrivyId(privyId);

      if (creator) {
        console.log('[Creator Sync] Found existing creator by privyId:', creator.id);
        // Update existing creator with latest address/email if changed (but preserve walletAddress!)
        const updates: any = {};
        if (address && address !== creator.address) {
          updates.address = address;
        }
        if (email && email !== creator.email) {
          updates.email = email;
        }
        if (Object.keys(updates).length > 0) {
          creator = await storage.updateCreator(creator.id, updates);
          console.log('[Creator Sync] Updated creator with new address/email');
        }
        return res.json(creator);
      }

      // If not found by privyId, check by address (legacy creators)
      if (address) {
        creator = await storage.getCreatorByAddress(address);
        if (creator) {
          console.log('[Creator Sync] Found legacy creator by address, backfilling privyId');
          // Backfill privyId for legacy creator (preserve existing walletAddress!)
          creator = await storage.updateCreator(creator.id, { privyId });
          return res.json(creator);
        }
      }

      // Generate a default username for email users
      const { getDefaultUsername } = await import("./username-generator");
      const defaultUsername = getDefaultUsername(email, privyId);

      console.log('[Creator Sync] Creating new creator with username:', defaultUsername);

      // Create new creator with privyId (address can be null for email users)
      const creatorData = {
        privyId,
        address: address || null, // Allow null for email-only users
        email: email || null, // Store email for email-only users
        name: defaultUsername, // Auto-generate username for email users
        bio: null,
        avatar: null,
        walletAddress: null, // No payout address for email users initially
        verified: "false",
        totalCoins: "0",
        totalVolume: "0",
        followers: "0",
        referralCode: defaultUsername, // Use generated username as referral code
        points: "100", // Welcome bonus
      };

      creator = await storage.createCreator(creatorData);
      console.log('[Creator Sync] Successfully created new creator:', creator.id, 'with email:', email);

      // Send welcome notification and E1XP reward
      try {
        const userId = creator.address || creator.id;
        const welcomePoints = 100;

        // Create welcome notification
        await storage.createNotification({
          userId: userId,
          type: 'reward',
          title: '🎁 Welcome to Every1.fun!',
          message: `You earned ${welcomePoints} E1XP as a welcome bonus! Come back daily to earn more points and build your streak! 🔥`,
          amount: welcomePoints.toString(),
          read: false,
        });

        // Create E1XP reward record
        await storage.createE1xpReward({
          userId: userId,
          amount: welcomePoints.toString(),
          type: 'welcome',
          title: '🎉 Welcome Bonus!',
          message: `Welcome to Every1.fun! You've earned ${welcomePoints} E1XP to get started!`,
          metadata: { 
            isWelcomeBonus: true,
            timestamp: new Date().toISOString()
          },
        });

        // Send real-time notification via Socket.IO if user is connected
        const { emitNotificationToUser } = await import('./socket-server');
        emitNotificationToUser(userId, {
          type: 'reward',
          title: '🎁 Welcome to Every1.fun!',
          message: `You earned ${welcomePoints} E1XP as a welcome bonus!`,
          amount: welcomePoints.toString(),
        });

        // Send Telegram notification if address available
        if (address) {
          try {
            await sendTelegramNotification(
              address,
              '🎁 Welcome to Every1.fun!',
              `Welcome! You've earned ${welcomePoints} E1XP points to get started. Come back daily to earn more points and build your streak! 🔥`,
              'reward'
            );
          } catch (telegramError) {
            console.warn('[Creator Sync] Failed to send Telegram welcome notification:', telegramError);
          }
        }

        console.log(`[Creator Sync] Sent welcome notification and ${welcomePoints} E1XP to new user ${userId}`);
      } catch (notificationError) {
        console.error('[Creator Sync] Failed to send welcome notifications:', notificationError);
        // Don't fail the whole request if notifications fail
      }

      res.json(creator);
    } catch (error) {
      console.error("[Creator Sync] Error:", error);
      res.status(500).json({
        error: "Failed to sync creator profile",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create or update creator (legacy, kept for backwards compatibility)
  app.post("/api/creators", async (req, res) => {
    try {
      const { address } = req.body;

      // Check if creator already exists
      const existingCreator = await storage.getCreatorByAddress(address);
      if (existingCreator) {
        return res.json(existingCreator);
      }

      // Create new creator with username as referral code
      const referralCode = await generateReferralCode(
        req.body.address,
      );
      const creatorData = {
        address: req.body.address,
        name: req.body.name || null,
        bio: req.body.bio || null,
        avatar: req.body.avatar || null,
        verified: req.body.verified || "false",
        totalCoins: req.body.totalCoins || "0",
        totalVolume: req.body.totalVolume || "0",
        followers: req.body.followers || "0",
        referralCode: referralCode,
        points: "0", // Initialize points
      };

      const creator = await storage.createCreator(creatorData);
      res.json(creator);
    } catch (error) {
      console.error("Create creator error:", error);
      res.status(400).json({ error: "Invalid creator data" });
    }
  });

  // Update creator profile
  app.patch("/api/creators/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      console.log('[Update Creator] Updating creator:', { id, updates });

      const creator = await storage.updateCreator(id, updates);

      if (!creator) {
        console.error('[Update Creator] Creator not found:', id);
        return res.status(404).json({ error: "Creator not found" });
      }

      // Update referral code if name was changed - ONLY for wallet users
      // Email-only users keep their auto-generated referral code for uniqueness
      if (updates.name !== undefined && creator && creator.address) {
        const newReferralCode = await generateReferralCode(creator.address);
        await storage.updateCreator(id, {
          referralCode: newReferralCode
        });
        console.log('[Update Creator] Updated referral code for creator:', creator.id, 'to', newReferralCode);
      }

      console.log('[Update Creator] Successfully updated creator:', creator.id);
      res.json(creator);
    } catch (error) {
      console.error("[Update Creator] Error:", error);
      res.status(500).json({ 
        error: "Failed to update creator",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all comments
  app.get("/api/comments", async (_req, res) => {
    try {
      const comments = await storage.getAllComments();
      res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Get comments by coin address
  app.get("/api/comments/coin/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const comments = await storage.getCommentsByCoin(address);
      res.json(comments);
    } catch (error) {
      console.error("Get coin comments error:", error);
      res.status(500).json({ error: "Failed to fetch coin comments" });
    }
  });

  // Create a comment
  app.post("/api/comments", async (req, res) => {
    try {
      const validatedData = insertCommentSchema.parse(req.body);
      const comment = await storage.createComment(validatedData);
      res.json(comment);
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(400).json({ error: "Invalid comment data" });
    }
  });

  // Get notifications for user
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications for user
  app.get("/api/notifications/:userId/unread", async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await storage.getUnreadNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get unread notifications error:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  // Create notification
  app.post("/api/notifications", async (req, res) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);

      // Send Telegram notification if available
      await sendTelegramNotification(
        notification.userId,
        notification.title,
        notification.message,
        notification.type,
      );

      res.json(notification);
    } catch (error) {
      console.error("Create notification error:", error);
      res.status(400).json({ error: "Invalid notification data" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/:userId/read-all", async (req, res) => {
    try {
      const { userId } = req.params;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res
        .status(500)
        .json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteNotification(id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Registry endpoints for onchain verification
  const registryService = new RegistryService(base.id);

  // Activity Tracker endpoints for grant verification
  const activityTrackerService = new ActivityTrackerService(base.id);

  // Manually trigger batch registration of unregistered coins
  app.post("/api/registry/sync", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const unregisteredCoins = coins.filter(
        (coin) =>
          coin.address && coin.status === "active" && !coin.registryTxHash,
      );

      if (unregisteredCoins.length === 0) {
        return res.json({
          message: "No coins to register",
          registered: 0,
        });
      }

      const txHash =
        await registryService.registerCoinsBatch(unregisteredCoins);

      if (txHash) {
        const now = new Date();
        for (const coin of unregisteredCoins) {
          const metadataHash = registryService.generateMetadataHash(coin);
          await storage.updateCoin(coin.id, {
            registryTxHash: txHash,
            metadataHash,
            registeredAt: now,
          });
        }

        return res.json({
          success: true,
          transactionHash: txHash,
          registered: unregisteredCoins.length,
        });
      } else {
        return res.status(500).json({
          error: "Failed to register coins batch",
        });
      }
    } catch (error) {
      console.error("Registry sync error:", error);
      res.status(500).json({ error: "Failed to sync registry" });
    }
  });

  // Get registry statistics
  app.get("/api/registry/stats", async (_req, res) => {
    try {
      const totalRegistered = await registryService.getTotalCoinsRegistered();
      const allCoins = await storage.getAllCoins();
      const registeredInDb = allCoins.filter((c) => c.registryTxHash).length;
      const pendingRegistration = allCoins.filter(
        (c) => c.address && c.status === "active" && !c.registryTxHash,
      ).length;

      res.json({
        totalOnchain: totalRegistered,
        totalInDb: allCoins.length,
        registeredInDb,
        pendingRegistration,
      });
    } catch (error) {
      console.error("Registry stats error:", error);
      res.status(500).json({ error: "Failed to fetch registry stats" });
    }
  });

  // Manually trigger batch recording of unrecorded coins to activity tracker
  app.post("/api/activity-tracker/sync", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const unrecordedCoins = coins.filter(
        (coin) =>
          coin.address &&
          coin.status === "active" &&
          !coin.activityTrackerTxHash,
      );

      if (unrecordedCoins.length === 0) {
        return res.json({
          success: true,
          message: "No coins to record on activity tracker",
          recorded: 0,
          alreadyRegistered: 0,
        });
      }

      // Ensure all coins have a createdAt timestamp
      for (const coin of unrecordedCoins) {
        if (!coin.createdAt) {
          // Set a reasonable past date for coins without creation dates
          const fallbackDate = new Date("2025-01-01T00:00:00Z");
          await storage.updateCoin(coin.id, {
            createdAt: fallbackDate,
          });
          coin.createdAt = fallbackDate;
          console.log(
            `✅ Set fallback createdAt for ${coin.symbol}: ${fallbackDate.toISOString()}`,
          );
        }
      }

      const results =
        await activityTrackerService.recordCoinBatch(unrecordedCoins);

      const now = new Date();
      let newlyRecorded = 0;
      let alreadyRegistered = 0;
      const failedCoins: string[] = [];

      for (const [coinId, txHash] of results.entries()) {
        await storage.updateCoin(coinId, {
          activityTrackerTxHash: txHash,
          activityTrackerRecordedAt: now,
        });

        // Check if this was already registered (txHash equals coin address)
        const coin = unrecordedCoins.find((c) => c.id === coinId);
        if (coin && txHash === coin.address) {
          alreadyRegistered++;
        } else {
          newlyRecorded++;
        }
      }

      // Track failed coins
      for (const coin of unrecordedCoins) {
        if (!results.has(coin.id)) {
          failedCoins.push(`${coin.symbol} (${coin.address})`);
        }
      }

      const response: any = {
        success: true,
        message: `Processed ${unrecordedCoins.length} coins: ${newlyRecorded} newly recorded, ${alreadyRegistered} already on-chain, ${failedCoins.length} failed`,
        recorded: newlyRecorded,
        alreadyRegistered: alreadyRegistered,
        failed: failedCoins.length,
        total: unrecordedCoins.length,
        transactionHashes: Array.from(results.values()).filter(
          (h) => h.startsWith("0x") && h.length > 42,
        ),
      };

      if (failedCoins.length > 0) {
        response.failedCoins = failedCoins;
        response.troubleshooting = [
          "Check console logs for detailed error messages",
          "Verify PLATFORM_PRIVATE_KEY has sufficient ETH for gas",
          "Ensure VITE_ACTIVITY_TRACKER_ADDRESS is correct",
          "Some coins may already be registered on-chain",
        ];
      }

      return res.json(response);
    } catch (error) {
      console.error("Activity tracker sync error:", error);
      res.status(500).json({ error: "Failed to sync activity tracker" });
    }
  });

  // Get activity tracker statistics
  app.get("/api/activity-tracker/stats", async (_req, res) => {
    try {
      const allCoins = await storage.getAllCoins();
      const recordedInDb = allCoins.filter(
        (c) => c.activityTrackerTxHash,
      ).length;
      const pendingRecording = allCoins.filter(
        (c) => c.address && c.status === "active" && !c.activityTrackerTxHash,
      ).length;

      res.json({
        totalInDb: allCoins.length,
        recordedInDb,
        pendingRecording,
      });
    } catch (error) {
      console.error("Activity tracker stats error:", error);
      res.status(500).json({ error: "Failed to fetch activity tracker stats" });
    }
  });

  // Broadcast all existing coins to Telegram
  app.post("/api/telegram/broadcast-coins", async (_req, res) => {
    try {
      const { broadcastExistingCoins } = await import("./telegram-bot");
      const coins = await storage.getAllCoins();
      await broadcastExistingCoins(coins);

      res.json({
        success: true,
        message: `Broadcasting ${coins.length} coins to connected Telegram users`,
      });
    } catch (error) {
      console.error("Telegram broadcast error:", error);
      res.status(500).json({ error: "Failed to broadcast coins" });
    }
  });

  // Verify if a coin is registered onchain
  app.get("/api/registry/verify/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const isRegistered = await registryService.isPlatformCoin(address);

      const coin = await storage.getCoinByAddress(address);

      res.json({
        address,
        isRegistered,
        registryTxHash: coin?.registryTxHash || null,
        registeredAt: coin?.registeredAt || null,
      });
    } catch (error) {
      console.error("Registry verify error:", error);
      res.status(500).json({ error: "Failed to verify coin" });
    }
  });

  // Get creator coin count from registry
  app.get("/api/registry/creator/:address/count", async (req, res) => {
    try {
      const { address } = req.params;
      const count = await registryService.getCreatorCoinCount(address);

      res.json({
        creator: address,
        onchainCoinCount: count,
      });
    } catch (error) {
      console.error("Registry creator count error:", error);
      res.status(500).json({ error: "Failed to fetch creator coin count" });
    }
  });

  // ===== FOLLOW/UNFOLLOW ENDPOINTS =====

  // Follow a user
  app.post("/api/follows", async (req, res) => {
    try {
      const validatedData = insertFollowSchema.parse(req.body);

      // Check if already following
      const isFollowing = await storage.isFollowing(
        validatedData.followerAddress,
        validatedData.followingAddress,
      );
      if (isFollowing) {
        return res.status(400).json({ error: "Already following this user" });
      }

      const follow = await storage.createFollow(validatedData);

      // Update follower count for the followed user
      const creator = await storage.getCreatorByAddress(
        validatedData.followingAddress,
      );
      if (creator) {
        const currentFollowers = parseInt(creator.followers || "0");
        await storage.updateCreator(creator.id, {
          followers: (currentFollowers + 1).toString(),
        });
      }

      res.json(follow);
    } catch (error) {
      console.error("Create follow error:", error);
      res.status(400).json({ error: "Failed to follow user" });
    }
  });

  // Unfollow a user
  app.delete(
    "/api/follows/:followerAddress/:followingAddress",
    async (req, res) => {
      try {
        const { followerAddress, followingAddress } = req.params;
        const deleted = await storage.deleteFollow(
          followerAddress,
          followingAddress,
        );

        if (deleted) {
          // Update follower count for the unfollowed user
          const creator = await storage.getCreatorByAddress(followingAddress);
          if (creator) {
            const currentFollowers = parseInt(creator.followers || "0");
            await storage.updateCreator(creator.id, {
              followers: Math.max(0, currentFollowers - 1).toString(),
            });
          }
        }

        res.json({ success: deleted });
      } catch (error) {
        console.error("Delete follow error:", error);
        res.status(500).json({ error: "Failed to unfollow user" });
      }
    },
  );

  // Check if following
  app.get(
    "/api/follows/check/:followerAddress/:followingAddress",
    async (req, res) => {
      try {
        const { followerAddress, followingAddress } = req.params;
        const isFollowing = await storage.isFollowing(
          followerAddress,
          followingAddress,
        );
        res.json({ isFollowing });
      } catch (error) {
        console.error("Check follow error:", error);
        res.status(500).json({ error: "Failed to check follow status" });
      }
    },
  );

  // Get followers of a user
  app.get("/api/follows/followers/:address", async (req, res) => {
    try {
      const { address } = req.params;

      // Check if user exists first
      const user = await storage.getCreatorByAddress(address);
      if (!user) {
        return res.json([]); // Return empty array instead of error
      }

      const followers = await storage.getFollowers(address);
      res.json(followers || []);
    } catch (error) {
      console.error("Get followers error:", error);
      res.json([]); // Return empty array on error
    }
  });

  // Get users that a user is following
  app.get("/api/follows/following/:address", async (req, res) => {
    try {
      const { address } = req.params;

      // Check if user exists first
      const user = await storage.getCreatorByAddress(address);
      if (!user) {
        return res.json([]); // Return empty array instead of error
      }

      const following = await storage.getFollowing(address);
      res.json(following || []);
    } catch (error) {
      console.error("Get following error:", error);
      res.json([]); // Return empty array on error
    }
  });

  // ===== REFERRAL ENDPOINTS =====

  // Generate referral link
  app.post("/api/referrals/generate", async (req, res) => {
    try {
      const { address, privyId } = req.body;

      if (!address && !privyId) {
        return res.status(400).json({ error: "Address or Privy ID is required" });
      }

      // Get or create user - support both email and wallet users
      let user = privyId
        ? await storage.getUserByPrivyId(privyId)
        : address
        ? await storage.getUserByAddress(address)
        : null;

      if (!user) {
        return res.status(404).json({ error: "User not found. Please create an account first." });
      }

      // Generate or get referral code based on user ID
      const referralCode = await generateReferralCode(user.id);

      // Update if referral code changed or is null
      if (!user.referralCode || user.referralCode !== referralCode) {
        const [updated] = await db
          .update(users)
          .set({ referralCode })
          .where(eq(users.id, user.id))
          .returning();
        if (updated) {
          user = updated;
        }
      }

      // Ensure we have a valid referral code
      const finalReferralCode = user.referralCode || referralCode;

      // Use the actual host from the request
      const host = req.get("host") || "localhost:5000";
      const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
      const referralLink = `${protocol}://${host}/?ref=${finalReferralCode}`;

      console.log(`Generated referral link for user ${user.id}: ${referralLink}`);

      res.json({
        referralCode: finalReferralCode,
        referralLink,
      });
    } catch (error) {
      console.error("Generate referral error:", error);
      res.status(500).json({ error: "Failed to generate referral link" });
    }
  });

  // Apply referral (when a new user signs up with a referral code)
  app.post("/api/referrals/apply", async (req, res) => {
    try {
      const { referralCode, referredUserId, referredAddress, referredPrivyId } = req.body;

      if (!referralCode) {
        return res.status(400).json({ error: "Referral code is required" });
      }

      if (!referredUserId && !referredAddress && !referredPrivyId) {
        return res.status(400).json({ error: "Referred user identifier is required" });
      }

      // Find referrer by referral code (from users table)
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer) {
        return res.status(400).json({ error: "Invalid referral code" });
      }

      // Find referred user
      let referredUser = referredUserId
        ? await storage.getUserById(referredUserId)
        : referredPrivyId
        ? await storage.getUserByPrivyId(referredPrivyId)
        : referredAddress
        ? await storage.getUserByAddress(referredAddress)
        : null;

      if (!referredUser) {
        return res.status(400).json({ error: "Referred user not found" });
      }

      // Check if user is trying to refer themselves
      if (referrer.id === referredUser.id) {
        return res.status(400).json({ error: "Cannot refer yourself" });
      }

      // Check if referral already exists
      const [existingReferral] = await db
        .select()
        .from(referrals)
        .where(
          and(
            eq(referrals.referrerId, referrer.id),
            eq(referrals.referredUserId, referredUser.id)
          )
        )
        .limit(1);

      if (existingReferral) {
        return res.status(400).json({ error: "Referral already exists" });
      }

      // Create referral record
      const [newReferral] = await db
        .insert(referrals)
        .values({
          referrerId: referrer.id,
          referredUserId: referredUser.id,
          status: 'pending',
          totalPointsEarned: 0,
          hasTradedOrCreated: false,
        })
        .returning();

      // Award signup bonus to referrer
      const pointsToAdd = POINTS_REWARDS.REFERRAL_SIGNUP;
      await rewardPoints(
        referrer.id,
        pointsToAdd,
        "referral",
        `New referral signup! ${referredUser.username || referredUser.email || 'User'} joined using your link!`,
        { referredUserId: referredUser.id }
      );

      const referredName = referredUser.displayName || referredUser.username || referredUser.email?.split('@')[0] || 'New user';
      const referrerName = referrer.displayName || referrer.username || referrer.email?.split('@')[0] || 'Referrer';

      // Send notification to REFERRER (they earned points)
      await storage.createNotification({
        userId: referrer.id,
        type: "reward",
        title: "Referral Successful! 🎉",
        message: `${referredName} joined using your referral link! You earned ${pointsToAdd} E1XP points.`,
        read: false,
      });

      // Send Telegram notification to referrer (if they have a wallet)
      if (referrer.walletAddress) {
        await sendTelegramNotification(
          referrer.walletAddress,
          "Referral Successful! 🎉",
          `${referredName} joined using your referral link! You earned ${pointsToAdd} E1XP points.`,
          "reward",
        );
      }

      // Send notification to REFERRED USER (welcoming them)
      await storage.createNotification({
        userId: referredUser.id,
        type: "reward",
        title: "Welcome to Every1.fun! 🚀",
        message: `You joined via ${referrerName}'s referral link. Start creating and trading coins now!`,
        read: false,
      });

      // Send Telegram notification to referred user (if they have a wallet)
      if (referredUser.walletAddress) {
        await sendTelegramNotification(
          referredUser.walletAddress,
          "Welcome to Every1.fun! 🚀",
          `You joined via ${referrerName}'s referral link. Start creating and trading coins now!`,
          "reward",
        );
      }

      res.json({
        success: true,
        referral: newReferral,
        pointsEarned: pointsToAdd,
      });
    } catch (error) {
      console.error("Apply referral error:", error);
      res.status(500).json({ error: "Failed to apply referral" });
    }
  });

  // Get referrals by referrer
  app.get("/api/referrals/referrer/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const referrals = await storage.getReferralsByReferrer(address);
      res.json(referrals);
    } catch (error) {
      console.error("Get referrals error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  // Get referrals by code
  app.get("/api/referrals/code/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const referrals = await storage.getReferralsByCode(code);
      res.json(referrals);
    } catch (error) {
      console.error("Get referrals by code error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  // Get referral stats for a user
  app.get("/api/referrals/stats/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const referrals = await storage.getReferralsByReferrer(address);
      const creator = await storage.getCreatorByAddress(address);

      const totalPoints = parseInt(creator?.points || "0");
      const totalReferrals = referrals.length;

      res.json({
        totalPoints,
        totalReferrals,
        referrals,
      });
    } catch (error) {
      console.error("Get referral stats error:", error);
      res.status(500).json({ error: "Failed to get referral stats" });
    }
  });

  // Push notification subscription
  app.post("/api/push-subscriptions", async (req, res) => {
    try {
      const { userAddress, subscription } = req.body;

      if (!userAddress || !subscription) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Store subscription in database
      await storage.createPushSubscription({
        userAddress,
        subscription: JSON.stringify(subscription),
        endpoint: subscription.endpoint,
      });

      res.json({ success: true, message: "Push subscription saved" });
    } catch (error) {
      console.error("Push subscription error:", error);
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  });

  // Register admin router (provides /api/admin/* endpoints)
  try {
    const adminRouter = createAdminRouter(storage as any);
    app.use('/api/admin', adminRouter);
    registerAdminRegistryRoutes(app);
  } catch (err) {
    console.warn('Failed to register admin router:', err);
  }

  // Register registry router (provides /api/registry/* endpoints)
  app.use('/api', registryRouter);

  // ===== E1XP REWARDS ENDPOINTS =====

  // Note: All E1XP endpoints are handled by the E1XP router in routes/e1xp.ts
  // Including: /api/e1xp/status, /api/e1xp/claim-daily, /api/e1xp/rewards/*, etc.

  // ===== PUSH NOTIFICATION ENDPOINTS =====

  // Subscribe to push notifications
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { userId, subscription } = req.body;

      if (!userId || !subscription) {
        return res.status(400).json({ error: "Missing userId or subscription" });
      }

      await storage.createPushSubscription({
        userId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
      });

      res.json({ success: true, message: "Push subscription saved" });
    } catch (error) {
      console.error("Push subscribe error:", error);
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { userId, endpoint } = req.body;

      if (!userId || !endpoint) {
        return res.status(400).json({ error: "Missing userId or endpoint" });
      }

      await storage.deletePushSubscription(userId, endpoint);

      res.json({ success: true, message: "Push subscription removed" });
    } catch (error) {
      console.error("Push unsubscribe error:", error);
      res.status(500).json({ error: "Failed to remove push subscription" });
    }
  });

  // Get login streak for a user
  app.get("/api/login-streak/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const loginStreak = await storage.getLoginStreak(identifier);
      res.json(loginStreak);
    } catch (error) {
      console.error("Get login streak error:", error);
      res.status(500).json({ error: "Failed to get login streak" });
    }
  });

  // Check for unclaimed daily points and send reminder
  app.post("/api/login-streak/check-unclaimed", async (req, res) => {
    try {
      const { address } = req.body;

      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }

      const today = new Date().toISOString().split("T")[0];
      const loginStreak = await storage.getLoginStreak(address);

      // If no streak exists, user hasn't claimed their first points
      if (!loginStreak) {
        await storage.createNotification({
          userId: address,
          type: "reward",
          title: "🎁 Claim Your Welcome Bonus!",
          message:
            "You have 10 points waiting for you! Visit the app to claim your first daily login bonus and start your streak.",
          amount: "10",
          read: false,
        });

        await sendTelegramNotification(
          address,
          "🎁 Claim Your Welcome Bonus!",
          "You have 10 points waiting! Visit the app to claim your first daily login bonus and start your streak 🔥",
          "reward",
        );

        return res.json({
          hasUnclaimed: true,
          pointsAvailable: 10,
          isFirstTime: true,
        });
      }

      // If last login was not today, user has unclaimed points
      if (loginStreak.lastLoginDate !== today) {
        const lastLogin = new Date(loginStreak.lastLoginDate || today);
        const todayDate = new Date(today);
        const daysDiff = Math.floor(
          (todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24),
        );

        let currentStreak = parseInt(loginStreak.currentStreak || "0");
        let pointsAvailable = 10;
        let streakStatus = "";

        if (daysDiff === 1) {
          // Can continue streak
          const nextStreak = currentStreak + 1;
          pointsAvailable = 10 + Math.min(Math.floor(nextStreak / 7) * 5, 50);
          streakStatus = `Continue your ${currentStreak} day streak`;
        } else {
          // Streak will reset
          pointsAvailable = 10;
          streakStatus = `Your ${currentStreak} day streak will reset`;
        }

        await storage.createNotification({
          userId: address,
          type: "reward",
          title: "🔥 Daily Points Available!",
          message: `${streakStatus}! Claim ${pointsAvailable} points now by visiting the app. Don't miss out!`,
          amount: pointsAvailable.toString(),
          read: false,
        });

        await sendTelegramNotification(
          address,
          "🔥 Daily Points Available!",
          `${streakStatus}! Claim ${pointsAvailable} points now 🎁`,
          "reward",
        );

        return res.json({
          hasUnclaimed: true,
          pointsAvailable,
          currentStreak,
          willReset: daysDiff > 1,
        });
      }

      res.json({ hasUnclaimed: false });
    } catch (error) {
      console.error("Check unclaimed error:", error);
      res.status(500).json({ error: "Failed to check unclaimed points" });
    }
  });

  // Check and record daily login
  app.post("/api/login-streak/check-in", async (req, res) => {
    try {
      const { address, privyId } = req.body;

      if (!privyId && !address) {
        return res.status(400).json({ error: "Either privyId or address is required" });
      }

      // Get or create creator
      let creator;
      if (privyId) {
        creator = await storage.getCreatorByPrivyId(privyId);
        if (!creator && address) {
          creator = await storage.getCreatorByAddress(address);
        }

        // If still no creator, create one for email users
        if (!creator) {
          console.log('Creating new creator for privyId:', privyId);
          const { getDefaultUsername } = await import("./username-generator");
          const defaultUsername = getDefaultUsername(req.body.email, privyId);

          creator = await storage.createCreator({
            privyId,
            address: address || null,
            name: defaultUsername,
            points: "0",
          } as any);
        }
      } else if (address) {
        creator = await storage.getCreatorByAddress(address);
        if (!creator) {
          creator = await storage.createCreator({
            address,
            name: `${address.slice(0, 6)}...${address.slice(-4)}`,
            points: "0",
          } as any);
        }
      }

      if (!creator) {
        return res.status(500).json({ error: "Failed to create creator profile" });
      }

      // Use creator's address for wallet users, or use a unique identifier for email users
      // For email users without address, use privyId or id
      const userId = creator.address && !creator.address.startsWith('email_')
        ? creator.address
        : creator.privyId || creator.id;

      const result = await storage.checkInStreak(userId);

      // Create welcome notification for first-time users
      if (result.isFirstLogin) {
        const welcomeNotification = {
          userId,
          type: 'reward',
          title: '🎉 Welcome to creatorland!',
          message: `You've earned ${result.pointsEarned} E1XP as a welcome bonus! Start creating coins, and earning more rewards.`,
          amount: result.pointsEarned.toString(),
          read: false,
        };
        await storage.createNotification(welcomeNotification);

        // Emit real-time notification via Socket.IO
        const { emitNotificationToUser } = await import('./socket-server');
        emitNotificationToUser(userId, welcomeNotification);
      } else if (result.currentStreak > 1) {
        // Create notification for streak achievement
        const streakNotification = {
          userId,
          type: 'streak',
          title: `🔥 ${result.currentStreak} Day Streak!`,
          message: `Amazing! You've earned ${result.pointsEarned} E1XP for your ${result.currentStreak} day streak! Keep it going! 💪`,
          amount: result.pointsEarned.toString(),
          read: false,
        };
        await storage.createNotification(streakNotification);

        // Emit real-time notification via Socket.IO
        const { emitNotificationToUser } = await import('./socket-server');
        emitNotificationToUser(userId, streakNotification);
      }

      res.json({
        ...result,
        isFirstLogin: result.isFirstLogin || false,
        pointsEarned: result.pointsEarned || 0,
        alreadyCheckedIn: false // Explicitly set to false for successful check-ins
      });
    } catch (error: any) {
      console.error("Login streak check-in error:", error);
      if (error.message && error.message.includes("already checked in")) {
        return res.status(200).json({ 
          alreadyCheckedIn: true,
          error: error.message,
          currentStreak: 0, // Return 0 for streak and points if already checked in
          pointsEarned: 0
        });
      }
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  // Get activity events from blockchain
  app.get("/api/blockchain/activity-events", async (req, res) => {
    try {
      const { activityTrackerService } = await import("./activity-tracker.js");
      const fromBlock = req.query.fromBlock
        ? BigInt(req.query.fromBlock as string)
        : 0n;
      const events = await activityTrackerService.getActivityEvents(fromBlock);

      res.json({
        success: true,
        events: events.map((log) => ({
          blockNumber: log.blockNumber?.toString(),
          transactionHash: log.transactionHash,
          args: log.args,
        })),
      });
    } catch (error) {
      console.error("Get activity events error:", error);
      res.status(500).json({ error: "Failed to get activity events" });
    }
  });

  // Blockchain metrics endpoints
  app.get("/api/blockchain/platform-stats", async (_req, res) => {
    try {
      const { activityTrackerService } = await import("./activity-tracker.js");
      const stats = await activityTrackerService.getPlatformStats();

      if (!stats) {
        return res.json({
          totalCoins: 0,
          totalPlatformFees: "0",
          totalCreatorFees: "0",
          totalVolume: "0",
          totalCreators: 0,
        });
      }

      res.json({
        totalCoins: stats.totalCoins.toString(),
        totalPlatformFees: stats.totalPlatformFees.toString(),
        totalCreatorFees: stats.totalCreatorFees.toString(),
        totalVolume: stats.totalVolume.toString(),
        totalCreators: stats.totalCreators.toString(),
      });
    } catch (error) {
      console.error("Get platform stats error:", error);
      res.status(500).json({ error: "Failed to get platform stats" });
    }
  });

  app.get("/api/blockchain/coin-metrics/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const { activityTrackerService } = await import("./activity-tracker.js");
      const metrics = await activityTrackerService.getCoinMetrics(
        address as `0x${string}`,
      );

      if (!metrics) {
        return res.json({
          totalCreatorFees: "0",
          totalPlatformFees: "0",
          currentMarketCap: "0",
          totalVolume: "0",
          tradeCount: "0",
          lastUpdated: "0",
        });
      }

      res.json({
        totalCreatorFees: metrics.totalCreatorFees.toString(),
        totalPlatformFees: metrics.totalPlatformFees.toString(),
        currentMarketCap: metrics.currentMarketCap.toString(),
        totalVolume: metrics.totalVolume.toString(),
        tradeCount: metrics.tradeCount.toString(),
        lastUpdated: metrics.lastUpdated.toString(),
      });
    } catch (error) {
      console.error("Get coin metrics error:", error);
      res.status(500).json({ error: "Failed to get coin metrics" });
    }
  });

  app.get("/api/blockchain/creator-stats/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const { activityTrackerService } = await import("./activity-tracker.js");
      const stats = await activityTrackerService.getCreatorStats(
        address as `0x${string}`,
      );

      if (!stats) {
        return res.json({
          coinsCreated: "0",
          totalFeesEarned: "0",
        });
      }

      res.json({
        coinsCreated: stats.coinsCreated.toString(),
        totalFeesEarned: stats.totalFeesEarned.toString(),
      });
    } catch (error) {
      console.error("Get creator stats error:", error);
      res.status(500).json({ error: "Failed to get creator stats" });
    }
  });

  // === NOTIFICATION SERVICE ENDPOINTS ===

  // Send test notification
  app.post("/api/notifications/send-test", async (req, res) => {
    try {
      const { type, title, message, address } = req.body;

      // Validate required fields
      if (!type || !title || !message) {
        return res.status(400).json({
          error: "Missing required fields: type, title, and message are required"
        });
      }

      let notificationCount = 0;

      if (address === "all") {
        // Send to all users
        try {
          const creators = await storage.getAllCreators();

          for (const creator of creators) {
            try {
              await storage.createNotification({
                userId: creator.address,
                type: type,
                title: title,
                message: message,
                read: false,
              });
              notificationCount++;

              // Try to send Telegram notification, but don't fail if it errors
              try {
                await sendTelegramNotification(creator.address, title, message, type);
              } catch (telegramError) {
                console.error(`Telegram notification failed for ${creator.address}:`, telegramError);
              }
            } catch (notifError) {
              console.error(`Failed to create notification for ${creator.address}:`, notifError);
            }
          }
        } catch (dbError) {
          console.error("Database error fetching creators:", dbError);
          return res.status(500).json({
            error: "Database connection failed. Please check your database configuration.",
            details: dbError instanceof Error ? dbError.message : String(dbError)
          });
        }
      } else if (address) {
        // Send to specific user
        try {
          await storage.createNotification({
            userId: address,
            type: type,
            title: title,
            message: message,
            read: false,
          });
          notificationCount++;

          // Try to send Telegram notification, but don't fail if it errors
          try {
            await sendTelegramNotification(address, title, message, type);
          } catch (telegramError) {
            console.error(`Telegram notification failed for ${address}:`, telegramError);
          }
        } catch (dbError) {
          console.error("Database error creating notification:", dbError);
          return res.status(500).json({
            error: "Database connection failed. Please check your database configuration.",
            details: dbError instanceof Error ? dbError.message : String(dbError)
          });
        }
      } else {
        return res.status(400).json({
          error: "Missing address field. Provide a specific address or 'all' to send to all users."
        });
      }

      res.json({
        success: true,
        message: `Test notification sent successfully to ${notificationCount} user(s)`
      });
    } catch (error) {
      console.error("Send test notification error:", error);
      res.status(500).json({
        error: "Failed to send test notification",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Send all periodic notifications (top creators, earners, coins, points, trades)
  app.post("/api/notifications/send-all", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendAllPeriodicNotifications();
      res.json({ success: true, message: "All periodic notifications sent" });
    } catch (error) {
      console.error("Send all notifications error:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  // Send top creators notification
  app.post("/api/notifications/top-creators", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendTopCreatorsNotification();
      res.json({ success: true, message: "Top creators notification sent" });
    } catch (error) {
      console.error("Send top creators notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send notification" });
    }
  });

  // Send top earners notification (with optional time period)
  app.post("/api/notifications/top-earners", async (req, res) => {
    try {
      const hours = parseInt(req.body.hours) || undefined; // 10, 24, 72, etc.
      const { notificationService } = await import("./notification-service");
      await notificationService.sendTopEarnersNotification(hours);
      res.json({
        success: true,
        message: `Top earners notification sent${hours ? ` for ${hours}h` : ""}`,
      });
    } catch (error) {
      console.error("Send top earners notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send notification" });
    }
  });

  // Send top coins notification
  app.post("/api/notifications/top-coins", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendTopCoinsNotification();
      res.json({ success: true, message: "Top coins notification sent" });
    } catch (error) {
      console.error("Send top coins notification error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Send trending coins notification
  app.post("/api/notifications/trending-coins", async (_req, res) => {
    try {
      const { checkAndNotifyTrendingCoins } = await import(
        "./trending-notifications"
      );
      await checkAndNotifyTrendingCoins();
      res.json({ success: true, message: "Trending coins notification sent" });
    } catch (error) {
      console.error("Send trending coins notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send trending coins notification" });
    }
  });

  // Send recent trades notification
  app.post("/api/notifications/recent-trades", async (_req, res) => {
    try {
      const { notificationService } = await import("./notification-service");
      await notificationService.sendRecentTradesNotification();
      res.json({ success: true, message: "Recent trades notification sent" });
    } catch (error) {
      console.error("Send recent trades notification error:", error);
      res
        .status(500)
        .json({ error: "Failed to send recent trades notification" });
    }
  });

  // Remind users about unclaimed daily points
  app.post("/api/notifications/remind-unclaimed-points", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      const today = new Date().toISOString().split("T")[0];
      let reminderCount = 0;

      for (const creator of creators) {
        const loginStreak = await storage.getLoginStreak(creator.address);

        if (!loginStreak || loginStreak.lastLoginDate !== today) {
          const pointsAvailable = loginStreak
            ? 10 +
              Math.min(
                Math.floor(
                  (parseInt(loginStreak.currentStreak || "0") + 1) / 7,
                ) * 5,
                50,
              )
            : 10;

          await storage.createNotification({
            userId: creator.address,
            type: "reward",
            title: "🎁 Don't Forget Your Daily E1XP!",
            message: `You have ${pointsAvailable} E1XP points waiting to be claimed! Visit the app now to keep your streak alive.`,
            amount: pointsAvailable.toString(),
            read: false,
          });
          reminderCount++;
        }
      }

      res.json({
        success: true,
        message: `Sent ${reminderCount} unclaimed points reminders`,
      });
    } catch (error) {
      console.error("Send unclaimed points reminder error:", error);
      res
        .status(500)
        .json({ error: "Failed to send unclaimed points reminders" });
    }
  });

  // Warn users about streak reset
  app.post("/api/notifications/remind-streak-reset", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      const today = new Date().toISOString().split("T")[0];
      let warningCount = 0;

      for (const creator of creators) {
        const loginStreak = await storage.getLoginStreak(creator.address);

        if (loginStreak && loginStreak.lastLoginDate !== today) {
          const lastLogin = new Date(loginStreak.lastLoginDate);
          const todayDate = new Date(today);
          const daysDiff = Math.floor(
            (todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (
            daysDiff === 1 &&
            parseInt(loginStreak.currentStreak || "0") > 3
          ) {
            await storage.createNotification({
              userId: creator.address,
              type: "reward",
              title: "⚠️ Your Streak Is About To Reset!",
              message: `Your ${loginStreak.currentStreak} day streak will reset at midnight! Claim your daily E1XP now to keep it going.`,
              read: false,
            });
            warningCount++;
          }
        }
      }

      res.json({
        success: true,
        message: `Sent ${warningCount} streak reset warnings`,
      });
    } catch (error) {
      console.error("Send streak reset warning error:", error);
      res.status(500).json({ error: "Failed to send streak reset warnings" });
    }
  });

  // Welcome new users
  app.post("/api/notifications/welcome-new-users", async (_req, res) => {
    try {
      const creators = await storage.getAllCreators();
      let welcomeCount = 0;

      for (const creator of creators) {
        const loginStreak = await storage.getLoginStreak(creator.address);

        if (!loginStreak) {
          await storage.createNotification({
            userId: creator.address,
            type: "reward",
            title: "🎉 Welcome to the Platform!",
            message:
              "Claim your 10 E1XP welcome bonus now! Start your daily login streak and earn even more points.",
            amount: "10",
            read: false,
          });
          welcomeCount++;
        }
      }

      res.json({
        success: true,
        message: `Sent ${welcomeCount} welcome notifications`,
      });
    } catch (error) {
      console.error("Send welcome notifications error:", error);
      res.status(500).json({ error: "Failed to send welcome notifications" });
    }
  });

  // Promote new coins
  app.post("/api/notifications/promote-new-coins", async (_req, res) => {
    try {
      const coins = await storage.getAllCoins();
      const recentCoins = coins
        .filter((c) => c.status === "active" && c.address)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5);

      if (recentCoins.length === 0) {
        return res.json({ success: true, message: "No new coins to promote" });
      }

      const creators = await storage.getAllCreators();
      let notificationCount = 0;

      for (const creator of creators) {
        const coinsList = recentCoins.map((c) => c.symbol).join(", ");

        await storage.createNotification({
          userId: creator.address,
          type: "coin_created",
          title: "🚀 Fresh Coins Just Dropped!",
          message: `Check out these new coins: ${coinsList}. Trade early and earn rewards!`,
          read: false,
        });
        notificationCount++;
      }

      res.json({
        success: true,
        message: `Promoted ${recentCoins.length} coins to ${notificationCount} users`,
      });
    } catch (error) {
      console.error("Promote new coins error:", error);
      res.status(500).json({ error: "Failed to promote new coins" });
    }
  });

  // Get current user session and ensure creator exists
  app.get("/api/auth/session", async (req, res) => {
    if (req.session?.user) {
      res.json({ authenticated: true, user: req.session.user });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Endpoint to ensure user exists in database after Privy auth
  app.post("/api/auth/ensure-user", async (req, res) => {
    try {
      const { address, username } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }

      let creator = await storage.getCreatorByAddress(address);
      const isNewUser = !creator;

      if (!creator) {
        // Auto-create creator for new authenticated user
        creator = await storage.createCreator({
          address: address,
          name: username || null,
          bio: null,
          avatar: null,
          verified: "false",
          totalCoins: "0",
          totalVolume: "0",
          followers: "0",
          points: "100", // Welcome bonus
        } as any);
        console.log(`[AUTH] Created creator record for new user: ${address}`);

        // Send welcome notification with E1XP bonus
        try {
          await storage.createNotification({
            userId: address,
            type: 'reward',
            title: '🎉 Welcome to Every1Fun!',
            message: 'You received 100 E1XP as a welcome bonus! Start creating coins to earn more.',
            amount: '100',
            read: false,
          } as any);
        } catch (notifError) {
          console.error(`[AUTH] Failed to send welcome notification:`, notifError);
        }

        // Create initial login streak
        try {
          const today = new Date().toISOString().split('T')[0];
          await storage.createLoginStreak({
            userId: address,
            currentStreak: "1",
            longestStreak: "1",
            lastLoginDate: today,
            totalPoints: "10",
            loginDates: [today],
          } as any);
        } catch (streakError) {
          console.error(`[AUTH] Failed to create login streak:`, streakError);
        }
      }

      res.json({ success: true, isNewUser, creator });
    } catch (error) {
      console.error('[AUTH] Error ensuring user exists:', error);
      res.status(500).json({ error: 'Failed to ensure user exists' });
    }
  });

  // OG Meta endpoint
  app.get("/api/og-meta/:type/:id", async (req, res) => {
    try {
      const { type, id } = req.params;
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      let meta;
      switch (type) {
        case "profile": {
          const creator = await storage.getCreatorById(id);
          if (!creator) return res.status(404).json({ error: "Creator not found" });
          meta = generateProfileOGMeta(creator, baseUrl);
          break;
        }
        case "coin": {
          const coin = await storage.getCoinById(id);
          if (!coin) return res.status(404).json({ error: "Coin not found" });
          meta = generateCoinOGMeta(coin, baseUrl);
          break;
        }
        case "project": {
          const project = await storage.getProjectById(id);
          if (!project) return res.status(404).json({ error: "Project not found" });
          meta = generateProjectOGMeta(project, baseUrl);
          break;
        }
        case "referral": {
          // id is the referral code
          const creator = await storage.getCreatorByReferralCode(id);
          if (!creator) return res.status(404).json({ error: "Referral code not found" });
          meta = generateReferralOGMeta(creator, baseUrl);
          break;
        }
        default:
          return res.status(400).json({ error: "Invalid type" });
      }

      res.json(meta);
    } catch (error) {
      console.error("OG meta error:", error);
      res.status(500).json({ error: "Failed to generate OG meta" });
    }
  });

  // Admin routes - these will be handled by the catch-all route below
  // No need for specific handlers, the React app routing will handle these paths

  // ===== COMMENT REACTIONS =====
  app.post("/api/comments/:commentId/reactions", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { commentId } = req.params;
      const { emoji } = req.body;
      const userAddress = req.userAddress;

      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const reaction = await storage.addCommentReaction({
        commentId,
        userAddress,
        emoji,
      });

      res.json(reaction);
    } catch (error: any) {
      console.error("Error adding comment reaction:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comments/:commentId/reactions/:emoji", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { commentId, emoji } = req.params;
      const userAddress = req.userAddress;

      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await storage.removeCommentReaction(commentId, userAddress, emoji);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing comment reaction:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/comments/:commentId/reactions", async (req, res) => {
    try {
      const { commentId } = req.params;
      const reactions = await storage.getCommentReactions(commentId);
      res.json(reactions);
    } catch (error: any) {
      console.error("Error fetching comment reactions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== USER BADGES =====
  app.get("/api/users/:userId/badges", async (req, res) => {
    try {
      const { userId } = req.params;
      const badges = await storage.getUserBadges(userId);
      res.json(badges);
    } catch (error: any) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== TRADE HISTORY =====
  app.post("/api/trades", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const trade = await storage.recordTrade({
        userAddress,
        ...req.body,
      });

      res.json(trade);
    } catch (error: any) {
      console.error("Error recording trade:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/trades/user/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getUserTradeHistory(address, limit);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching user trade history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/trades/coin/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getCoinTradeHistory(address, limit);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching coin trade history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== CREATOR STORIES =====
  app.post("/api/stories", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const story = await storage.createStory({
        creatorAddress: userAddress,
        ...req.body,
      });

      res.json(story);
    } catch (error: any) {
      console.error("Error creating story:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stories", async (req, res) => {
    try {
      const { creator } = req.query;
      const stories = await storage.getActiveStories(creator as string | undefined);
      res.json(stories);
    } catch (error: any) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stories/:storyId/view", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId } = req.params;
      const userAddress = req.userAddress;

      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await storage.recordStoryView(storyId, userAddress);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error recording story view:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stories/:storyId/views", async (req, res) => {
    try {
      const { storyId } = req.params;
      const views = await storage.getStoryViews(storyId);
      res.json(views);
    } catch (error: any) {
      console.error("Error fetching story views:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== SEARCH HISTORY & AUTOCOMPLETE =====
  app.post("/api/search", async (req, res) => {
    try {
      const search = await storage.recordSearch(req.body);
      res.json(search);
    } catch (error: any) {
      console.error("Error recording search:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/search/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const searches = await storage.getPopularSearches(limit);
      res.json(searches);
    } catch (error: any) {
      console.error("Error fetching popular searches:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/search/history", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const history = await storage.getUserSearchHistory(userAddress, limit);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching search history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== MESSAGING ENDPOINTS =====
  app.get("/api/messages/unread-count", walletAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userAddress = req.userAddress;
      if (!userAddress) {
        return res.json({ count: 0 });
      }

      // Get all conversations to count total unread messages
      const conversations = await storage.getUserConversations(userAddress.toLowerCase());
      let totalUnread = 0;

      for (const conv of conversations) {
        const unreadCount = await storage.getUnreadMessageCount(userAddress.toLowerCase(), conv.otherUserId);
        totalUnread += unreadCount;
      }

      res.json({ count: totalUnread });
    } catch (error: any) {
      console.error("Error fetching unread message count:", error);
      res.status(500).json({ error: error.message, count: 0 });
    }
  });

  // Register E1XP routes
  const { createE1XPRouter } = await import('./routes/e1xp');
  app.use('/api/e1xp', createE1XPRouter(storage as any));

  // Register Zora explore routes
  const { registerZoraExploreRoutes } = await import('./routes/zora-explore');
  registerZoraExploreRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}