import { ethers } from "ethers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const COIN_REGISTRY_ABI = [
  "function register(address creator, address zoraContract, bytes32 txHash) external",
  "function batchRegister(address[] calldata creators, address[] calldata zoraContracts, bytes32[] calldata txHashes) external",
  "function getRegistration(address zoraContract) external view returns (tuple(address creator, address zoraContract, uint256 timestamp, bytes32 txHash))",
  "function isRegistered(address zoraContract) external view returns (bool)",
  "function totalCoins() external view returns (uint256)",
  "function platformWallet() external view returns (address)",
  "event CoinRegistered(address indexed creator, address indexed zoraContract, uint256 timestamp, bytes32 txHash)",
  "event BatchRegistered(uint256 count, uint256 timestamp)"
];

export class RegistryService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;
  private supabase: SupabaseClient | null = null;

  constructor() {
    // Use mainnet RPC (contract deployed on mainnet)
    const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
    this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true // Disable ENS lookups for Base network
    });

    const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY;
    if (process.env.REGISTRY_CONTRACT_ADDRESS && privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(
        process.env.REGISTRY_CONTRACT_ADDRESS,
        COIN_REGISTRY_ABI,
        this.wallet
      );
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase not configured");
      }
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  }

  isConfigured(): boolean {
    return this.contract !== null && this.wallet !== null;
  }

  async verifyConfiguration(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const platformWallet = await this.contract!.platformWallet();
      const expectedWallet = this.wallet!.address;

      if (platformWallet.toLowerCase() !== expectedWallet.toLowerCase()) {
        console.error(`❌ Platform wallet mismatch: contract has ${platformWallet}, wallet is ${expectedWallet}`);
        return false;
      }

      await this.contract!.totalCoins();
      
      return true;
    } catch (error: any) {
      console.error("❌ Failed to verify registry configuration:", error.message);
      return false;
    }
  }

  async getPendingRegistrations() {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("coins")
      .select("*")
      .in("registry_status", ["pending", "failed"])
      .not("address", "is", null)
      .not("creator_wallet", "is", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("❌ Error fetching pending registrations:", error);
      return [];
    }

    return data || [];
  }

  async registerSingleCoin(coin: any): Promise<boolean> {
    if (!this.contract || !this.wallet) {
      console.error("❌ Registry contract not configured");
      return false;
    }

    try {
      console.log(`📝 Registering coin ${coin.symbol} (${coin.address})...`);

      const supabase = this.getSupabase();
      await supabase
        .from("coins")
        .update({ registry_status: "registering" })
        .eq("id", coin.id);

      const txHashBytes = coin.registry_tx_hash 
        ? ethers.getBytes(coin.registry_tx_hash)
        : ethers.ZeroHash;

      const tx = await this.contract.register(
        coin.creator_wallet,
        coin.address,
        txHashBytes
      );

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed: ${receipt.hash}`);

      await supabase
        .from("coins")
        .update({
          registry_status: "registered",
          registry_tx_hash: receipt.hash,
          registered_at: new Date().toISOString()
        })
        .eq("id", coin.id);

      return true;
    } catch (error: any) {
      console.error(`❌ Error registering coin ${coin.symbol}:`, error.message);

      const errorMsg = error.message.toLowerCase();
      const isPermanentError = errorMsg.includes("already registered") ||
                               errorMsg.includes("not a contract") ||
                               errorMsg === "invalid creator address" ||
                               errorMsg === "invalid contract address";

      const supabase = this.getSupabase();
      await supabase
        .from("coins")
        .update({ 
          registry_status: isPermanentError ? "failed_permanent" : "failed"
        })
        .eq("id", coin.id);

      return false;
    }
  }

  async batchRegisterCoins(coins: any[]): Promise<{ success: number; failed: number }> {
    if (!this.contract || !this.wallet) {
      console.error("❌ Registry contract not configured");
      return { success: 0, failed: 0 };
    }

    if (coins.length === 0) {
      return { success: 0, failed: 0 };
    }

    try {
      console.log(`📦 Batch registering ${coins.length} coins...`);

      const supabase = this.getSupabase();
      const coinIds = coins.map(c => c.id);
      await supabase
        .from("coins")
        .update({ registry_status: "registering" })
        .in("id", coinIds);

      const creators = coins.map(c => c.creator_wallet);
      const contracts = coins.map(c => c.address);
      const txHashes = coins.map(c => 
        c.registry_tx_hash 
          ? ethers.getBytes(c.registry_tx_hash)
          : ethers.ZeroHash
      );

      const estimatedGas = await this.contract.batchRegister.estimateGas(
        creators,
        contracts,
        txHashes
      );
      console.log(`⛽ Estimated gas: ${estimatedGas.toString()}`);

      const tx = await this.contract.batchRegister(creators, contracts, txHashes, {
        gasLimit: estimatedGas * BigInt(120) / BigInt(100)
      });

      console.log(`⏳ Batch transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Batch transaction confirmed: ${receipt.hash}`);

      await supabase
        .from("coins")
        .update({
          registry_status: "registered",
          registry_tx_hash: receipt.hash,
          registered_at: new Date().toISOString()
        })
        .in("id", coinIds);

      return { success: coins.length, failed: 0 };
    } catch (error: any) {
      console.error(`❌ Error in batch registration:`, error.message);

      const errorMsg = error.message.toLowerCase();
      const isPermanentError = errorMsg.includes("array length mismatch") ||
                               errorMsg.includes("empty arrays") ||
                               errorMsg.includes("batch too large");

      const supabase = this.getSupabase();
      const coinIds = coins.map(c => c.id);
      await supabase
        .from("coins")
        .update({ 
          registry_status: isPermanentError ? "failed_permanent" : "failed"
        })
        .in("id", coinIds);

      return { success: 0, failed: coins.length };
    }
  }

  async isRegistered(zoraContract: string): Promise<boolean> {
    if (!this.contract) {
      return false;
    }

    try {
      return await this.contract.isRegistered(zoraContract);
    } catch (error) {
      console.error("Error checking registration status:", error);
      return false;
    }
  }

  async getTotalRegistrations(): Promise<number> {
    if (!this.contract) {
      return 0;
    }

    try {
      const total = await this.contract.totalCoins();
      return Number(total);
    } catch (error) {
      console.error("Error getting total registrations:", error);
      return 0;
    }
  }

  async getRegistrationDetails(zoraContract: string) {
    if (!this.contract) {
      return null;
    }

    try {
      const registration = await this.contract.getRegistration(zoraContract);
      return {
        creator: registration.creator,
        zoraContract: registration.zoraContract,
        timestamp: Number(registration.timestamp),
        txHash: registration.txHash
      };
    } catch (error) {
      console.error("Error getting registration details:", error);
      return null;
    }
  }
}

export const registryService = new RegistryService();
