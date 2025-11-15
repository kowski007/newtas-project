import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  User, 
  Palette, 
  HelpCircle,
  Info,
  Star,
  FileText,
  ChevronRight,
  Moon,
  Users
} from "lucide-react";
import type { Creator } from "@shared/schema";
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

export default function Settings() {
  const { user: privyUser, authenticated } = usePrivy();
  const [, setLocation] = useLocation();
  const address = privyUser?.wallet?.address;

  const { data: creator } = useQuery<Creator>({
    queryKey: ['/api/creators/address', address],
    enabled: !!address && authenticated,
  });

  const [darkMode, setDarkMode] = useState(true);

  const avatarSvg = createAvatar(avataaars, {
    seed: address || 'anonymous',
    size: 128,
  }).toDataUri();

  const profileImageUrl = creator?.avatar || avatarSvg;

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <SettingsIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to access settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Profile Card */}
      <Card 
        className="p-4 rounded-2xl border-2 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setLocation("/profile")}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profileImageUrl} alt={creator?.name || "Profile"} />
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">
              {creator?.name || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </Card>

      {/* Dark Mode Toggle */}
      <Card className="p-4 rounded-2xl border-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5" />
            <span className="font-medium">Dark Mode</span>
          </div>
          <Switch
            checked={darkMode}
            onCheckedChange={setDarkMode}
          />
        </div>
      </Card>

      {/* Menu Items */}
      <div className="space-y-2">
        <Card 
          className="p-4 rounded-2xl border-2 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setLocation("/referrals")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <span className="font-medium">Referrals</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Account Info */}
      <Card className="p-4 rounded-2xl bg-muted/20 border-2 mt-6">
        <p className="text-xs text-muted-foreground text-center mb-2">Account Information</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono text-xs">{address?.slice(0, 8)}...{address?.slice(-6)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Points</span>
            <span className="font-bold text-primary">{creator?.points || 0} E1XP</span>
          </div>
        </div>
      </Card>
    </div>
  );
}