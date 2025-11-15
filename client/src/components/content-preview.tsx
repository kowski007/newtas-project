import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadToIPFS } from "@/lib/pinata";
import { Loader2, ExternalLink, Sparkles } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, createPublicClient, http, type Address } from "viem";
import { base, baseSepolia } from "viem/chains";
import { createCoinOnBaseSepolia, generateCoinSymbol } from "@/lib/zora-coins";
import { deployGaslessCoin } from "@/lib/gasless-deployment";
import { useSmartAccount } from "@/contexts/SmartAccountContext";
import confetti from "canvas-confetti";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContentPreviewProps {
  scrapedData: any;
  onCoinCreated: () => void;
}

export default function ContentPreview({ scrapedData, onCoinCreated }: ContentPreviewProps) {
  const { toast } = useToast();
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { 
    smartAccountClient, 
    smartAccountAddress, 
    isLoading: isSmartAccountLoading, 
    smartAccountReady,
    smartAccountStatus,
    error: smartAccountError,
    initSmartAccount,
    retryWalletCreation
  } = useSmartAccount();

  // Get the actual wallet address from Privy wallets array
  const privyWallet = wallets[0];
  const walletAddress = privyWallet?.address as Address | undefined;
  const privyId = user?.id;
  const email = user?.email?.address;
  const isEmailUser = email && !walletAddress;

  // Use smart wallet address if available, otherwise use regular wallet address
  const effectiveWalletAddress = smartAccountAddress || walletAddress;

  // Auto-generate symbol from platform/channel/content - NON-EDITABLE
  const coinSymbol = generateCoinSymbol({
    platform: scrapedData.platform,
    author: scrapedData.author,
    title: scrapedData.title,
    url: scrapedData.url,
  });

  const createCoinMutation = useMutation({
    mutationFn: async () => {
      if (!authenticated || !user) {
        throw new Error("Please sign in to create a coin");
      }

      // Get network preference (default to mainnet)
      const networkPreference = localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null;
      const chainId = networkPreference === 'sepolia' ? baseSepolia.id : base.id;

      console.log('🚀 Creating coin on chain:', chainId === base.id ? 'Base Mainnet' : 'Base Sepolia');

      // 1. Upload metadata to IPFS
      const metadata = {
        name: scrapedData.title,
        symbol: coinSymbol,
        description: scrapedData.description || `A coin representing ${scrapedData.title}`,
        image: scrapedData.image || "",
        external_url: scrapedData.url || "",
        attributes: {
          platform: scrapedData.platform,
          author: scrapedData.author,
          publishDate: scrapedData.publishDate,
          contentType: scrapedData.type,
        },
      };

      // Ensure smart account is initialized
      let accountClient = smartAccountClient;
      let accountAddress = smartAccountAddress;

      if (!accountClient || !accountAddress) {
        console.log("⏳ Smart account not ready, initializing...");
        const result = await initSmartAccount();

        if (!result) {
          throw new Error("Smart account initialization failed. Please refresh and try again.");
        }

        accountClient = result.client;
        accountAddress = result.address;
      }

      console.log("📤 Uploading metadata to IPFS...");
      const ipfsUri = await uploadToIPFS(metadata);
      console.log("✅ Metadata uploaded:", ipfsUri);

      // 2. Create coin record in database (pending status)
      console.log("💾 Creating database record...");
      
      // Determine creator wallet: prefer privy wallet, fallback to smart account
      const creatorWalletAddress = walletAddress || accountAddress;
      console.log('📍 Using creator wallet address:', creatorWalletAddress);
      
      if (!creatorWalletAddress) {
        throw new Error("No wallet address available. Please ensure you're logged in with a wallet.");
      }

      const coinData = {
        name: scrapedData.title,
        symbol: coinSymbol,
        description: scrapedData.description || `A coin representing ${scrapedData.title}`,
        image: scrapedData.image || "",
        creatorWallet: creatorWalletAddress,
        status: 'pending' as const,
        ipfsUri,
      };

      const createdCoin = await apiRequest("POST", "/api/coins", coinData);
      const createdCoinJson = await createdCoin.json();
      console.log("✅ Database record created:", createdCoinJson.id);

      // 3. Deploy coin using gasless deployment
      console.log('💸 Using GASLESS deployment for ALL users!');
      console.log('📍 Smart wallet address:', accountAddress);
      console.log('✅ Gas fees will be sponsored by Base Paymaster (FREE)');

      const deployResult = await deployGaslessCoin(
        {
          name: scrapedData.title,
          symbol: coinSymbol,
          metadataUri: ipfsUri,
          smartAccountAddress: accountAddress,
          platformReferrer: import.meta.env.VITE_ADMIN_REFERRAL_ADDRESS as Address | undefined,
        },
        accountClient
      );

      console.log("✅ Gasless deployment successful!");
      console.log("💰 You paid ZERO gas fees!");
      console.log("📍 Contract address:", deployResult.address || "Pending...");
      console.log("🔗 Transaction hash:", deployResult.hash);

      // Determine the chain ID from the deployment result
      const deployedChainId = deployResult.chainId || baseSepolia.id;

      // Update database with deployment info
      console.log("💾 Updating database with deployment info...");
      await apiRequest("PATCH", `/api/coins/${createdCoinJson.id}`, {
        address: deployResult.address,
        chainId: deployedChainId.toString(),
        status: 'active' as const,
        createdAt: deployResult.createdAt,
      });

      console.log("🎉 Coin creation complete!");
      return {
        coin: {
          ...createdCoinJson,
          address: deployResult.address,
          status: 'active',
          chainId: deployedChainId.toString(),
        }
      };
    },
    onSuccess: (data) => {
      const isGasless = smartAccountClient && smartAccountAddress;
      
      // Show immediate toast feedback
      toast({
        title: isGasless ? "🎉 Coin Created (Gasless)!" : "🎉 Coin Created Successfully!",
        description: isGasless
          ? `${data.coin.symbol} is now live with ZERO gas fees paid!`
          : `${data.coin.symbol} is now live on Base Sepolia testnet`
      });
      
      // Trigger confetti animation
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
      
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/e1xp/notifications"] });
      
      onCoinCreated();
    },
    onError: (error: Error) => {
      console.error("❌ Coin creation failed:", error);
      toast({
        title: "Coin creation failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  return (
    <div className="space-y-4">
      {/* Compact preview card */}
      <div className="flex gap-3">
        {/* Image thumbnail - compact */}
        {scrapedData.image && (
          <div className="flex-shrink-0">
            <img
              src={scrapedData.image}
              alt={scrapedData.title}
              className="w-20 h-20 object-cover rounded-lg border border-border"
            />
          </div>
        )}

        {/* Content info - compact */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {scrapedData.title}
          </h3>
          {scrapedData.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {scrapedData.description}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-2">
            {scrapedData.platform && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {scrapedData.platform}
              </span>
            )}
            {scrapedData.author && (
              <span className="text-xs text-muted-foreground truncate">
                by {scrapedData.author}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Auto-generated symbol display - non-editable */}
      <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Auto-Generated Symbol
            </p>
            <p className="text-lg font-bold text-foreground">
              ${coinSymbol}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on {scrapedData.author || scrapedData.platform || 'content name'}
            </p>
          </div>
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Network info & Gasless indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 rounded-lg p-2">
        <span>Network: {localStorage.getItem('ADMIN_NETWORK_PREFERENCE') === 'mainnet' ? 'Base Mainnet' : 'Base Sepolia (Testnet)'}</span>
        <span>Currency: ETH</span>
      </div>

      {/* Wallet status indicator */}
      {authenticated && smartAccountStatus === 'waiting_for_wallet' && (
        <div className="flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs font-medium text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Creating your wallet - Please wait...</span>
        </div>
      )}

      {authenticated && smartAccountStatus === 'initializing' && (
        <div className="flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs font-medium text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Initializing smart account...</span>
        </div>
      )}

      {authenticated && smartAccountStatus === 'error' && smartAccountError && (
        <div className="flex flex-col items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <span className="text-xs font-medium text-red-600 dark:text-red-400">{smartAccountError}</span>
          <Button
            onClick={retryWalletCreation}
            variant="outline"
            size="sm"
            className="text-xs"
            data-testid="button-retry-wallet"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Gasless deployment indicator - show when ready */}
      {authenticated && smartAccountReady && (
        <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-xs font-medium text-green-600 dark:text-green-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gasless Deployment - Zero Gas Fees!</span>
        </div>
      )}

      {/* Create button */}
      <Button
        onClick={() => {
          if (!authenticated) {
            toast({
              title: "Sign in required",
              description: "Please sign in to create a coin",
              variant: "destructive",
            });
            return;
          }
          createCoinMutation.mutate();
        }}
        disabled={createCoinMutation.isPending || !authenticated || !smartAccountReady}
        className="w-full h-11 bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/80 font-semibold"
        data-testid="button-create-coin"
      >
        {createCoinMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Coin (Gasless)...
          </>
        ) : smartAccountStatus === 'waiting_for_wallet' ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Preparing Wallet...
          </>
        ) : smartAccountStatus === 'initializing' ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Initializing...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Create ${coinSymbol} Coin (FREE)
          </>
        )}
      </Button>

      {/* Source link */}
      {scrapedData.url && (
        <a
          href={scrapedData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View original content
        </a>
      )}


    </div>
  );
}