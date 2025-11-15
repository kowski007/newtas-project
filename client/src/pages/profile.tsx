import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useLocation } from "wouter";
import type { Coin } from "@shared/schema";
import { CoinCard } from "@/components/coin-card";
import {
  User as UserIcon,
  Share2,
  Copy,
  Check,
  Edit2,
  Settings,
  Bell,
  Grid3x3,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatSmartCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@privy-io/react-auth";
import { ShareModal } from "@/components/share-modal";
import WithdrawEarningsModal from "@/components/withdraw-earnings-modal";
import { useSmartAccount } from "@/contexts/SmartAccountContext";

export default function Profile() {
  const { user: privyUser, authenticated } = usePrivy();
  const [selectedTab, setSelectedTab] = useState<"coins" | "trades">(
    "coins",
  );
  const [copied, setCopied] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [totalMarketCap, setTotalMarketCap] = useState<number>(0);
  const [totalHolders, setTotalHolders] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState<string>("");
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [totalE1XPPoints, setTotalE1XPPoints] = useState<number>(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); // State for share modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false); // State for withdraw modal

  const privyId = privyUser?.id;
  const address = privyUser?.wallet?.address;
  const email = privyUser?.email?.address;
  const { smartAccountAddress } = useSmartAccount();

  // Ensure creator exists on mount
  useEffect(() => {
    if (!authenticated || !privyId) return;

    const ensureCreator = async () => {
      try {
        const response = await apiRequest("POST", "/api/creators/sync", {
          privyId,
          address: address || null,
          email: email || null,
        });

        if (response.ok) {
          queryClient.invalidateQueries({
            queryKey: ["/api/creators/privy", privyId],
          });
        }
      } catch (error) {
        console.error("Failed to ensure creator exists:", error);
        // Don't show error to user, will retry on next action
      }
    };

    ensureCreator();
  }, [authenticated, privyId, address, email]);

  // Fetch creator by Privy ID (works for both email and wallet users)
  const { data: creatorData, isLoading: isLoadingCreatorData } = useQuery({
    queryKey: ["/api/creators/privy", privyId],
    enabled: !!privyId && authenticated,
    retry: 3,
    retryDelay: 1000,
  });

  const avatarUrl = creatorData?.avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";

  // Fetch E1XP status for streak info
  const { data: e1xpStatus } = useQuery({
    queryKey: ["/api/e1xp/status", authenticated],
    enabled: authenticated,
    refetchInterval: 5000, // Refetch every 5 seconds to catch updates
    queryFn: async () => {
      const headers: Record<string, string> = {};
      try {
        const accessToken = await getAccessToken();
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
      } catch (error) {
        console.error("Failed to get access token:", error);
      }
      const response = await fetch("/api/e1xp/status", {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch E1XP status");
      return response.json();
    },
  });

  // Use creator address if available, otherwise these queries will be disabled
  const creatorAddress = creatorData?.address || address;

  const { data: followers = [] } = useQuery({
    queryKey: ["/api/follows/followers", creatorAddress],
    enabled: !!creatorAddress && authenticated && !!creatorData,
    retry: false,
  });

  const { data: following = [] } = useQuery({
    queryKey: ["/api/follows/following", creatorAddress],
    enabled: !!creatorAddress && authenticated && !!creatorData,
    retry: false,
  });

  useEffect(() => {
    setFollowersCount(followers.length || 0);
    setFollowingCount(following.length || 0);
  }, [followers, following]);

  // Update local stats when e1xpStatus changes
  useEffect(() => {
    if (e1xpStatus) {
      setCurrentStreak(e1xpStatus.streak || 0);
      setLongestStreak(e1xpStatus.longestStreak || 0);
      setTotalE1XPPoints(e1xpStatus.points || 0);
    }
  }, [e1xpStatus]);

  const { data: coins = [], isLoading: isLoadingCoins } = useQuery<Coin[]>({
    queryKey: ["/api/coins"],
  });

  const createdCoins = useMemo(() => {
    const creatorAddress = creatorData?.address || address;
    if (!creatorAddress) return [];
    return coins.filter(
      (coin) =>
        coin.creatorWallet &&
        coin.creatorWallet.toLowerCase() === creatorAddress.toLowerCase(),
    );
  }, [coins, creatorData, address]);

  const displayedCoins = createdCoins.filter(
    (coin) => coin.address !== null,
  ) as Array<(typeof createdCoins)[0] & { address: string }>;

  useEffect(() => {
    if (!address || !authenticated || !createdCoins.length) {
      setTotalEarnings(0);
      setTotalMarketCap(0);
      setTotalHolders(0);
      setIsLoadingStats(false);
      return;
    }

    let isMounted = true;
    setIsLoadingStats(true);

    async function fetchAllStats() {
      try {
        let earnings = 0;
        let marketCap = 0;
        let holders = 0;

        for (const coin of createdCoins) {
          if (coin.address && coin.status === "active") {
            try {
              const coinData = await getCoin({
                address: coin.address as `0x${string}`,
                chain: base,
              });

              const tokenData = coinData.data?.zora20Token;

              if (
                tokenData?.creatorEarnings &&
                tokenData.creatorEarnings.length > 0
              ) {
                const earningAmount = parseFloat(
                  String(
                    tokenData.creatorEarnings[0].amountUsd ||
                      tokenData.creatorEarnings[0].amount?.amountDecimal ||
                      "0",
                  ),
                );
                earnings += earningAmount;
              }

              if (tokenData?.marketCap) {
                marketCap += parseFloat(tokenData.marketCap);
              }

              if (tokenData?.uniqueHolders) {
                holders += tokenData.uniqueHolders;
              }
            } catch (err) {
              console.error(
                `Error fetching coin stats for ${coin.address}:`,
                err,
              );
            }
          }
        }

        if (isMounted) {
          setTotalEarnings(earnings);
          setTotalMarketCap(marketCap);
          setTotalHolders(holders);
          setIsLoadingStats(false);
        }
      } catch (error) {
        console.error("Error fetching creator stats:", error);
        if (isMounted) {
          setTotalEarnings(0);
          setTotalMarketCap(0);
          setTotalHolders(0);
          setIsLoadingStats(false);
        }
      }
    }

    fetchAllStats();

    return () => {
      isMounted = false;
    };
  }, [address, authenticated, createdCoins]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getDisplayName = () => {
    // First check if creator has a custom name set
    if (creatorData?.name) {
      return creatorData.name;
    }

    // For wallet users, show formatted address
    if (address) {
      return formatAddress(address);
    }

    // For email-only users, use email prefix
    if (email) {
      return email.split("@")[0];
    }

    return "Creator";
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy address to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    // This function will now open the modal instead of directly sharing
    setIsShareModalOpen(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setProfileImage(file);

      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload image");
        }

        const data = await response.json();
        setProfileImageUrl(data.url);

        toast({
          title: "Image uploaded",
          description: "Profile image uploaded successfully",
        });
      } catch (error) {
        console.error("Image upload error:", error);
        toast({
          title: "Upload failed",
          description: "Failed to upload profile image",
          variant: "destructive",
        });
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  useEffect(() => {
    if (creatorData) {
      setUsername(creatorData.name || "");
      setBio(creatorData.bio || "");
      setProfileImageUrl(creatorData.avatar || "");
      setWalletAddress(creatorData.walletAddress || address || "");
    } else if (email && !creatorData) {
      // For new email users without a creator profile yet, set a default username
      setUsername(email.split("@")[0]);
    }
  }, [creatorData, address, email]);

  useEffect(() => {
    if (address) {
      const profilePath = creatorData?.name
        ? `/@${creatorData.name}`
        : `/profile/${address}`;
      const profileUrl = `${window.location.origin}${profilePath}`;
      setShareUrl(profileUrl);
    }
  }, [address, creatorData]);

  const handleSaveProfile = async () => {
    if (!privyId) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      });
      return;
    }

    // Validate payout wallet address format if provided
    if (
      walletAddress &&
      walletAddress.trim() &&
      !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)
    ) {
      toast({
        title: "Error",
        description:
          "Invalid payout wallet address format. Must be a valid Ethereum address (0x...)",
        variant: "destructive",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      let creator: any = creatorData;

      // For email users, ensure creator exists by syncing first
      if (!creator) {
        console.log("Creator not found, syncing profile...");
        const syncResponse = await apiRequest("POST", "/api/creators/sync", {
          privyId,
          address: address || null,
          email: email || null,
        });

        if (!syncResponse.ok) {
          throw new Error("Failed to sync creator profile");
        }

        creator = await syncResponse.json();
        console.log("Creator synced:", creator);
      }

      if (!creator || !creator.id) {
        toast({
          title: "Error",
          description:
            "Unable to create profile. Please try logging out and back in.",
          variant: "destructive",
        });
        return;
      }

      // Update the creator profile
      const updateResponse = await apiRequest(
        "PATCH",
        `/api/creators/${creator.id}`,
        {
          name: username.trim() || null,
          bio: bio.trim() || null,
          avatar: profileImageUrl || null,
          walletAddress: walletAddress.trim() || null, // Payout address
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.message || "Failed to update profile");
      }

      creator = await updateResponse.json();

      // Invalidate all relevant queries to refresh the UI
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/creators/privy", privyId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/creators/address", address],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/creators"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/coins"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/e1xp/status"] }),
      ]);

      // Force a refetch of creator data
      await queryClient.refetchQueries({
        queryKey: ["/api/creators/privy", privyId],
      });

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });

      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2
            className="text-2xl font-bold text-foreground mb-2"
            data-testid="text-connect-wallet"
          >
            Connect Your Wallet
          </h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingCreatorData) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col items-center text-center mb-6">
          <Skeleton className="w-24 h-24 rounded-full mb-4" />
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-24 mb-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 px-4">
      {/* Profile Section */}
      <div className="flex flex-col items-center text-center pt-4 pb-6 px-4">
        {/* Avatar */}
        <img
          src={avatarUrl}
          alt="Profile"
          className="w-24 h-24 rounded-full border-2 border-border object-cover mb-4"
          data-testid="img-profile-avatar"
        />

        {/* Username with verification */}
        <div className="flex items-center gap-1 mb-1">
          <h2 className="text-base font-semibold">
            @{getDisplayName()}
          </h2>
          {creatorData?.verified === "true" && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="8" fill="#20D5EC" />
              <path
                d="M6.5 8.5L7.5 9.5L10 7"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-4">
          <div>
            <div className="text-lg font-bold" data-testid="text-posts">
              {isLoadingCoins ? "-" : createdCoins.length}
            </div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="text-lg font-bold" data-testid="text-followers">
              {followersCount}
            </div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div>
            <div className="text-lg font-bold" data-testid="text-following">
              {followingCount}
            </div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => setShowWithdrawModal(true)}
          >
            <div
              className="text-lg font-bold text-green-500"
              data-testid="text-earnings"
            >
              {isLoadingStats
                ? "-"
                : totalEarnings > 1000
                  ? `$${(totalEarnings / 1000).toFixed(1)}k`
                  : formatSmartCurrency(totalEarnings)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              Cash out
              {totalEarnings > 0 && (
                <Wallet className="w-3 h-3 text-green-500" />
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2 mb-4 w-full max-w-sm mx-auto">
          <Button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg h-9 text-xs px-3"
            data-testid="button-edit-profile"
          >
            Edit Profile
          </Button>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z"
                fill="#EAB308"
              />
            </svg>
            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-500">
              {totalE1XPPoints.toLocaleString()}
            </span>
          </div>
          <Button
            onClick={handleShare}
            variant="outline"
            size="icon"
            className="rounded-lg h-9 w-9"
            data-testid="button-share-profile"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Bio */}
        {creatorData?.bio && (
          <p
            className="text-sm text-foreground mb-2 max-w-md"
            data-testid="text-bio"
          >
            {creatorData.bio}
          </p>
        )}

        {/* Smart Account Address (for email users) */}
        {email && smartAccountAddress && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg text-xs font-mono max-w-md mx-auto mb-2">
            <Wallet className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground truncate">
              {formatAddress(smartAccountAddress)}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(smartAccountAddress);
                toast({
                  title: "Smart account copied",
                  description: "Your smart account address has been copied",
                });
              }}
              className="p-1 hover:bg-muted rounded"
            >
              {copied ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setSelectedTab("coins")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            selectedTab === "coins"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          <Grid3x3 className="w-4 h-4" />
          <span className="text-sm">Coins</span>
        </button>
        <button
          onClick={() => setSelectedTab("trades")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            selectedTab === "trades"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </svg>
          <span className="text-sm">Trades</span>
        </button>
      </div>

      {/* Content Grid */}
      {selectedTab === "coins" && (
        <>
          {isLoadingCoins ? (
            <div className="grid grid-cols-3 gap-1 p-1">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-muted/20 animate-pulse"
                ></div>
              ))}
            </div>
          ) : displayedCoins.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Grid3x3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3
                className="text-xl font-bold text-foreground mb-2"
                data-testid="text-no-coins"
              >
                No coins created yet
              </h3>
              <p className="text-muted-foreground">
                Start creating your first coin!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 p-1">
              {displayedCoins.map((coin) => (
                <div
                  key={coin.id}
                  className="aspect-square relative cursor-pointer group overflow-hidden"
                  onClick={() => setLocation(`/coins/${coin.id}`)}
                >
                  {coin.imageUrl ? (
                    <img
                      src={coin.imageUrl}
                      alt={coin.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary/40">
                        {coin.symbol.slice(0, 2)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-white text-xs font-semibold flex items-center gap-1">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                        <path d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z" />
                      </svg>
                      {coin.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedTab === "trades" && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            No trades yet
          </h3>
          <p className="text-muted-foreground">
            Your trading history will appear here
          </p>
        </div>
      )}

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl p-5">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-semibold">
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Profile Image
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isUploadingImage || isSavingProfile}
                data-testid="input-profile-image"
                className="h-8 text-xs"
              />
              {isUploadingImage && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Uploading image...
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                data-testid="input-username"
                disabled={isSavingProfile}
                className="h-8 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Bio
              </label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={2}
                data-testid="input-bio"
                disabled={isSavingProfile}
                className="text-sm resize-none min-h-[60px]"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Payout Wallet Address
              </label>
              <Input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x... (where you want to receive Zora rewards)"
                data-testid="input-wallet-address"
                disabled={isSavingProfile}
                className="h-8 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Your Zora coin earnings and rewards will be sent to this wallet
                address
              </p>
            </div>

            <Button
              onClick={handleSaveProfile}
              className="w-full h-9 relative rounded-full"
              data-testid="button-save-profile"
              disabled={isUploadingImage || isSavingProfile}
            >
              {isSavingProfile && (
                <div className="absolute left-3 w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              )}
              <span className={isSavingProfile ? "ml-5" : ""}>
                {isSavingProfile ? "Saving profile..." : "Save Changes"}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={shareUrl}
        title={`${creatorData?.name || formatAddress(address || "")} - CoinIT Profile`}
        description="Check out my profile on CoinIT!"
      />

      <WithdrawEarningsModal
        open={showWithdrawModal}
        onOpenChange={setShowWithdrawModal}
        userCoins={
          createdCoins.filter((coin) => coin.address !== null) as Array<
            (typeof createdCoins)[0] & { address: string }
          >
        }
      />
    </div>
  );
}