import { useQuery } from "@tanstack/react-query";
import { CreatorCard } from "@/components/creator-card";
import { CoinCard } from "@/components/coin-card";
import { TopCreatorsStories } from "@/components/top-creators-stories";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  TrendingUp,
  Music,
  Palette,
  Gamepad2,
  Code,
  Shirt,
  Dumbbell,
  GraduationCap,
  Tv,
  Globe,
  ChevronLeft,
  ChevronRight,
  Coins,
  PenTool,
  Heart,
  Search,
  PlusCircle,
  User,
  Users,
} from "lucide-react";
import {
  SiYoutube,
  SiTiktok,
  SiInstagram,
  SiMedium,
  SiX,
} from "react-icons/si";
import type { User as UserType } from "@shared/schema";
import { useState, useMemo, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import TradeModalMobile from "@/components/trade-modal-mobile";
import { useLocation } from "wouter";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import { getMostValuableCreatorCoins } from "@zoralabs/coins-sdk";
import { useEffect } from "react";
import { updateOGMeta } from "@/lib/og-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Coin = {
  id: string;
  name: string;
  symbol: string;
  address: string;
  image?: string;
  marketCap?: string;
  volume24h?: string;
  holders?: number;
  creator?: string;
  createdAt?: string;
  category?: string;
  platform?: string;
  creator_wallet?: string;
  metadata?: any;
};

export default function Home() {
  // Fetch trending creators from Zora for the stories section
  const { data: zoraCreators } = useQuery({
    queryKey: ["/api/zora/creators/most-valuable"],
    queryFn: async () => {
      const response = await getMostValuableCreatorCoins({ count: 20 });
      const creators =
        response.data?.exploreList?.edges?.map((edge: any) => {
          const coin = edge.node;
          return {
            id: coin.creatorAddress || coin.address,
            address: coin.creatorAddress || coin.address,
            username: coin.symbol || "creator",
            displayName: coin.name || "Creator",
            bio: coin.description || "",
            avatarUrl:
              coin.mediaContent?.previewImage?.medium ||
              coin.mediaContent?.previewImage?.small ||
              createAvatar(avataaars, {
                seed: coin.creatorAddress,
                size: 56,
              }).toDataUri(),
            e1xpPoints: Math.floor(parseFloat(coin.marketCap || "0") * 100),
          };
        }) || [];
      return creators;
    },
    refetchInterval: 30000,
  });

  const trendingCreators = zoraCreators || [];

  const { data: featuredProjects, isLoading: loadingProjects } = useQuery({
    queryKey: ["/api/projects/featured"],
  });

  // Fetch pinned coins from platform
  const { data: pinnedCoinsData, isLoading: loadingPinnedCoins } = useQuery({
    queryKey: ["/api/coins/pinned"],
    queryFn: async () => {
      const response = await fetch("/api/coins/pinned?_=" + Date.now());
      if (!response.ok) throw new Error("Failed to fetch pinned coins");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch trending coins from Zora
  const { data: zoraCoinsData, isLoading: loadingZoraCoins } = useQuery({
    queryKey: ["/api/zora/coins/top-volume"],
    queryFn: async () => {
      const response = await fetch("/api/zora/coins/top-volume?count=30");
      if (!response.ok) throw new Error("Failed to fetch Zora coins");
      return response.json();
    },
  });

  const [selectedCategory, setSelectedCategory] = useState("all");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [coinMarketCaps, setCoinMarketCaps] = useState<Record<string, string>>(
    {},
  );
  const [coinVolumes, setCoinVolumes] = useState<Record<string, string>>({});
  const [coinHolders, setCoinHolders] = useState<Record<string, number>>({});
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  // Custom icon components for platforms not in lucide-react
  const FarcasterIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.5 4h-17A1.5 1.5 0 002 5.5v13A1.5 1.5 0 003.5 20h17a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0020.5 4zm-8.53 11.94c-2.11 0-3.82-1.71-3.82-3.82s1.71-3.82 3.82-3.82 3.82 1.71 3.82 3.82-1.71 3.82-3.82 3.82z" />
    </svg>
  );

  const GitcoinIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
      <path d="M12 6c-3.309 0-6 2.691-6 6s2.691 6 6 6 6-2.691 6-6-2.691-6-6-6zm0 10c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4z" />
    </svg>
  );

  const KarmaIcon = ({ className }: { className?: string }) => (
    <Heart className={className} />
  );

  const categories = [
    { id: "all", label: "All", Icon: Globe },
    { id: "farcaster", label: "Farcaster", Icon: FarcasterIcon },
    { id: "gitcoin", label: "Gitcoin", Icon: GitcoinIcon },
    { id: "karmagap", label: "KarmaGap", Icon: KarmaIcon },
    { id: "publicgoods", label: "Public Goods", Icon: Coins },
    { id: "music", label: "Music", Icon: Music },
    { id: "tiktok", label: "TikTok", Icon: SiTiktok },
    { id: "instagram", label: "Instagram", Icon: SiInstagram },
    { id: "medium", label: "Medium", Icon: SiMedium },
    { id: "giveth", label: "Giveth", Icon: Coins },
    { id: "twitter", label: "Twitter", Icon: SiX },
    { id: "blog", label: "Blog", Icon: PenTool },
  ];

  // Transform pinned coins data (max 6)
  const pinnedCoins: Coin[] = useMemo(() => {
    if (!pinnedCoinsData || loadingPinnedCoins) return [];

    const rawCoins = Array.isArray(pinnedCoinsData) ? pinnedCoinsData : [];

    return rawCoins.slice(0, 6).map((coin: any) => ({
      id: coin.id || coin.address,
      name: coin.name || "Unnamed Coin",
      symbol: coin.symbol || "???",
      address: coin.address,
      image: coin.image,
      marketCap: coin.market_cap || coin.marketCap || "0",
      volume24h: coin.volume_24h || coin.volume24h || "0",
      holders: coin.holders || 0,
      creator: coin.creator_wallet || coin.creatorWallet || coin.creator,
      createdAt: coin.created_at || coin.createdAt,
      category: "Platform",
      platform: "platform",
      creator_wallet: coin.creator_wallet || coin.creatorWallet || coin.creator,
      metadata: coin,
    }));
  }, [pinnedCoinsData, loadingPinnedCoins]);

  // Transform Zora coins data to match our Coin type
  const zoraCoins: Coin[] = useMemo(() => {
    if (!zoraCoinsData?.coins) return [];

    return zoraCoinsData.coins.map((coin: any) => ({
      id: coin.id || coin.address,
      name: coin.name || "Unnamed Coin",
      symbol: coin.symbol || "???",
      address: coin.address,
      image:
        coin.mediaContent?.previewImage?.medium ||
        coin.mediaContent?.previewImage?.small,
      marketCap: coin.marketCap ? parseFloat(coin.marketCap).toFixed(2) : "0",
      volume24h: coin.volume24h ? parseFloat(coin.volume24h).toFixed(2) : "0",
      holders: coin.uniqueHolders || 0,
      creator: coin.creatorAddress,
      createdAt: coin.createdAt,
      category: "zora",
      platform: "zora",
      creator_wallet: coin.creatorAddress,
      metadata: coin,
    }));
  }, [zoraCoinsData]);

  // Combine pinned coins first, then Zora coins (limit total to 12)
  const displayCoins: Coin[] = useMemo(() => {
    const combined = [...pinnedCoins, ...zoraCoins];
    return combined.slice(0, 12);
  }, [pinnedCoins, zoraCoins]);

  const filteredCreators = useMemo(() => {
    if (!trendingCreators) return [];
    if (selectedCategory === "all") return trendingCreators;
    return trendingCreators.filter((creator) =>
      creator.categories?.includes(selectedCategory),
    );
  }, [trendingCreators, selectedCategory]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -400 : 400;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const openTradeModal = (coin: Coin) => {
    if (isMobile) {
      setSelectedCoin(coin);
      setIsTradeModalOpen(true);
    } else {
      setLocation(`/coin/${coin.address}`);
    }
  };

  // Check for referral code in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
      // Fetch OG meta for this referral
      fetch(`/api/og-meta/referral/${encodeURIComponent(refCode)}`)
        .then(res => res.json())
        .then(meta => {
          updateOGMeta({
            title: meta.title,
            description: meta.description,
            image: meta.image,
            url: meta.url,
          });
        })
        .catch(err => console.error('Failed to load referral OG meta:', err));
    }
  }, []);

  const renderMobileNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 z-50 md:hidden">
      <div className="flex justify-around items-center">
        <button
          onClick={() => setLocation("/")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <Sparkles className="w-6 h-6" />
          <span className="text-xs font-medium">Explore</span>
        </button>
        <button
          onClick={() => setLocation("/search")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <Search className="w-6 h-6" />
          <span className="text-xs font-medium">Search</span>
        </button>
        <button
          onClick={() => setLocation("/create")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <PlusCircle className="w-6 h-6" />
          <span className="text-xs font-medium">Create</span>
        </button>
        <button
          onClick={() => setLocation("/creators")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <div className="relative">
            <Users className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-[8px] font-bold">
              New
            </div>
          </div>
          <span className="text-xs font-medium">Creators</span>
        </button>
        <button
          onClick={() => setLocation("/profile")}
          className="flex flex-col items-center text-foreground/70 hover:text-foreground"
        >
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );


  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-4">
      {/* Instagram Stories Section */}
      <section className="space-y-3">
        {!zoraCreators ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : trendingCreators.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              No creators available yet. Be the first to create!
            </p>
          </div>
        ) : (
          <TopCreatorsStories creators={trendingCreators} limit={10} />
        )}
      </section>

      {/* Trending Coins */}
      <section className="space-y-4 -mt-2 md:mt-0" data-tour="trending-coins">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1"></div>
        </div>

        {/* Discover heading - Mobile only */}
      <div className="md:hidden">
        <h2 className="text-lg font-semibold text-foreground mb-4">Discover</h2>
      </div>

      {/* Coins Grid */}
      {(loadingZoraCoins || loadingPinnedCoins) ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="h-64 bg-card rounded-2xl animate-pulse"
                data-testid="skeleton-coin-card"
              />
            ))}
          </div>
        ) : displayCoins.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
            {displayCoins.map((coin: Coin) => (
              <CoinCard
                key={coin.id || coin.address}
                coin={coin}
                onClick={() => openTradeModal(coin)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No coins available at the moment
            </p>
          </div>
        )}
      </section>

      {selectedCoin && isMobile && (
        <TradeModalMobile
          coin={selectedCoin}
          open={isTradeModalOpen}
          onOpenChange={setIsTradeModalOpen}
        />
      )}
      {isMobile && renderMobileNav()}
    </div>
  );
}