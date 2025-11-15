import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, http, type Address, type Chain, createWalletClient, custom } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import type { SmartAccountClient } from 'permissionless';
import { entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const ENTRYPOINT_ADDRESS_V07 = entryPoint07Address;
const WALLET_READY_TIMEOUT = 25000; // 25 seconds

type SmartAccountStatus = 'idle' | 'waiting_for_wallet' | 'initializing' | 'ready' | 'error';

interface SmartAccountContextType {
  smartAccountClient: SmartAccountClient | null;
  smartAccountAddress: Address | null;
  isLoading: boolean;
  error: string | null;
  smartAccountReady: boolean;
  smartAccountStatus: SmartAccountStatus;
  initSmartAccount: () => Promise<{ client: SmartAccountClient; address: Address } | null>;
  retryWalletCreation: () => void;
}

const SmartAccountContext = createContext<SmartAccountContextType>({
  smartAccountClient: null,
  smartAccountAddress: null,
  isLoading: false,
  error: null,
  smartAccountReady: false,
  smartAccountStatus: 'idle',
  initSmartAccount: async () => null,
  retryWalletCreation: () => {},
});

export const useSmartAccount = () => useContext(SmartAccountContext);

interface SmartAccountProviderProps {
  children: ReactNode;
}

export function SmartAccountProvider({ children }: SmartAccountProviderProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [smartAccountClient, setSmartAccountClient] = useState<SmartAccountClient | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smartAccountStatus, setSmartAccountStatus] = useState<SmartAccountStatus>('idle');

  // Bootstrap promise: resolves when Privy embedded wallet is ready
  const walletReadyPromiseRef = useRef<Promise<void> | null>(null);
  const walletReadyResolveRef = useRef<(() => void) | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Clear wallet readiness watcher
  const clearWalletReadinessWatcher = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    walletReadyPromiseRef.current = null;
    walletReadyResolveRef.current = null;
  }, []);

  // Helper: Create wallet readiness watcher (returns cleanup function)
  const createWalletReadinessWatcher = useCallback(() => {
    // Clear any existing watcher first
    clearWalletReadinessWatcher();

    console.log("⏳ Starting wallet readiness watcher...");
    setSmartAccountStatus('waiting_for_wallet');

    walletReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
      walletReadyResolveRef.current = resolve;

      // Set timeout to reject if wallet doesn't appear in time
      timeoutIdRef.current = setTimeout(() => {
        console.error("❌ Wallet creation timeout after", WALLET_READY_TIMEOUT / 1000, "seconds");
        const timeoutError = new Error("Wallet creation timeout. Please try again or refresh the page.");
        // Update UI state even if no one is awaiting the promise
        setSmartAccountStatus('error');
        setError(timeoutError.message);
        reject(timeoutError);
        clearWalletReadinessWatcher();
      }, WALLET_READY_TIMEOUT);
    });

    // Return cleanup function
    return clearWalletReadinessWatcher;
  }, [clearWalletReadinessWatcher]);

  const initSmartAccount = useCallback(async () => {
    if (!authenticated || !user) {
      console.log("❌ Cannot initialize: User not authenticated");
      return null;
    }

    // Check if we already have a smart account for this user
    if (smartAccountClient && smartAccountAddress) {
      console.log("✅ Smart account already initialized:", smartAccountAddress);
      return { client: smartAccountClient, address: smartAccountAddress };
    }

    // Wait for Privy wallet to be ready (bootstrap promise)
    if (walletReadyPromiseRef.current) {
      console.log("⏳ Waiting for wallet to be ready...");
      setSmartAccountStatus('waiting_for_wallet');
      try {
        await walletReadyPromiseRef.current;
      } catch (err) {
        console.error("❌ Wallet readiness timeout:", err);
        setError(err instanceof Error ? err.message : "Wallet creation timeout");
        setSmartAccountStatus('error');
        return null;
      }
    }

    setIsLoading(true);
    setSmartAccountStatus('initializing');
    setError(null);

    try {
      const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');

      if (!embeddedWallet) {
        console.log("⏳ No embedded wallet found yet, waiting...");
        setIsLoading(false);
        setSmartAccountStatus('waiting_for_wallet');
        return null;
      }

      console.log("💼 Found wallet:", embeddedWallet.walletClientType);

      // Determine chain based on admin network preference (default to Mainnet)
      const networkPreference = typeof window !== 'undefined'
        ? localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null
        : null;

      const chain = networkPreference === 'sepolia' ? baseSepolia : base;
      const pimlicoApiKey = import.meta.env.VITE_PIMLICO_API_KEY;
      const paymasterUrl = networkPreference === 'sepolia'
        ? `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${pimlicoApiKey}`
        : `https://api.pimlico.io/v2/base/rpc?apikey=${pimlicoApiKey}`;
      const bundlerUrl = networkPreference === 'sepolia'
        ? `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${pimlicoApiKey}`
        : `https://api.pimlico.io/v2/base/rpc?apikey=${pimlicoApiKey}`;

      console.log(`🔐 Initializing smart account on ${chain.name}...`);
      console.log("📡 Using Pimlico Paymaster:", networkPreference === 'sepolia' ? 'Base Sepolia' : 'Base Mainnet');

      // Create public client for the chain
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      // Get the EIP1193 provider from Privy wallet
      const provider = await embeddedWallet.getEthereumProvider();

      // Get the wallet address
      const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in wallet");
      }
      const ownerAddress = accounts[0] as Address;
      console.log("👤 Owner address:", ownerAddress);

      // Create wallet client from provider
      const walletClient = createWalletClient({
        account: ownerAddress,
        chain,
        transport: custom(provider),
      });

      // Create simple smart account
      const account = await toSimpleSmartAccount({
        client: publicClient,
        owner: walletClient,
        entryPoint: {
          address: ENTRYPOINT_ADDRESS_V07,
          version: "0.7"
        },
      });

      console.log("✅ Smart account created:", account.address);

      // Create Pimlico bundler client
      const pimlicoBundlerClient = createPimlicoClient({
        transport: http(bundlerUrl),
        entryPoint: {
          address: ENTRYPOINT_ADDRESS_V07,
          version: "0.7"
        },
      });

      // Create smart account client with Pimlico sponsorship
      const client = createSmartAccountClient({
        account,
        chain,
        bundlerTransport: http(bundlerUrl),
        paymaster: pimlicoBundlerClient,
        userOperation: {
          estimateFeesPerGas: async () => {
            const fees = await publicClient.estimateFeesPerGas();
            return {
              maxFeePerGas: fees.maxFeePerGas || BigInt(0),
              maxPriorityFeePerGas: fees.maxPriorityFeePerGas || BigInt(0),
            };
          },
        },
      });

      // Clear wallet readiness watcher since we successfully initialized
      clearWalletReadinessWatcher();

      setSmartAccountClient(client as SmartAccountClient);
      setSmartAccountAddress(account.address);
      setSmartAccountStatus('ready');

      console.log("✅ Smart account client ready");
      console.log("📍 Smart account address:", account.address);

      return { client: client as SmartAccountClient, address: account.address };
    } catch (err) {
      console.error("❌ Failed to initialize smart account:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize smart account");
      setSmartAccountStatus('error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, user, wallets, smartAccountClient, smartAccountAddress, clearWalletReadinessWatcher]);

  // Retry function for wallet creation timeout
  const retryWalletCreation = useCallback(() => {
    console.log('🔁 Retrying wallet readiness bootstrap...');
    setError(null);
    clearWalletReadinessWatcher();

    const hasPrivyWallet = wallets?.some((wallet) => wallet.walletClientType === 'privy');

    if (hasPrivyWallet) {
      walletReadyResolveRef.current?.();
      clearWalletReadinessWatcher();
      void initSmartAccount();
      return;
    }

    createWalletReadinessWatcher();
    void initSmartAccount();
  }, [wallets, clearWalletReadinessWatcher, createWalletReadinessWatcher, initSmartAccount]);

  // Bootstrap wallet readiness watcher
  useEffect(() => {
    if (!ready || !authenticated) {
      clearWalletReadinessWatcher();
      setSmartAccountStatus('idle');
      return;
    }

    const hasPrivyWallet = wallets?.some((wallet) => wallet.walletClientType === 'privy');

    if (hasPrivyWallet) {
      if (walletReadyResolveRef.current) {
        console.log('✅ Privy wallet is ready');
        walletReadyResolveRef.current();
      }
      clearWalletReadinessWatcher();
      return;
    }

    if (!walletReadyPromiseRef.current) {
      const cleanup = createWalletReadinessWatcher();
      return () => cleanup?.();
    }

    return undefined;
  }, [ready, authenticated, wallets, clearWalletReadinessWatcher, createWalletReadinessWatcher]);

  // Auto-initialize smart account when wallet is ready
  useEffect(() => {
    if (ready && authenticated && wallets && wallets.length > 0 && !smartAccountClient && !isLoading) {
      initSmartAccount();
    }
  }, [ready, authenticated, wallets, smartAccountClient, isLoading, initSmartAccount]);

  return (
    <SmartAccountContext.Provider
      value={{
        smartAccountClient,
        smartAccountAddress,
        isLoading,
        error,
        smartAccountReady: smartAccountStatus === 'ready',
        smartAccountStatus,
        initSmartAccount,
        retryWalletCreation,
      }}
    >
      {children}
    </SmartAccountContext.Provider>
  );
}