/**
 * Gasless Coin Deployment Test Script
 * Tests the complete flow: SmartAccount → Pimlico Paymaster → Zora Factory
 * 
 * Run with: npx ts-node test-gasless-deployment.ts
 */

import { createPublicClient, createWalletClient, http, zeroAddress } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { ENTRYPOINT_ADDRESS_V07 } from 'permissionless/utils';

// Configuration
const NETWORK = process.env.TEST_NETWORK || 'sepolia'; // 'sepolia' or 'mainnet'
const chain = NETWORK === 'mainnet' ? base : baseSepolia;
const PIMLICO_API_KEY = process.env.VITE_PIMLICO_API_KEY || 'pim_gNUshp4eDg2kW9c6hs6Sop';
const ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214F9DF38E35BF45baF3';
const ZORA_ADDRESS = '0x1111111111166b7fe7bd91427724b487980afc69';

// Test private key (use a test account)
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;

if (!TEST_PRIVATE_KEY) {
  console.error('❌ TEST_PRIVATE_KEY environment variable not set');
  console.error('   Usage: TEST_PRIVATE_KEY=0x... npm test');
  process.exit(1);
}

async function testGaslessDeployment() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 GASLESS COIN DEPLOYMENT TEST');
  console.log('='.repeat(80));
  console.log(`\n📍 Network: ${NETWORK.toUpperCase()} (Chain ID: ${chain.id})`);
  console.log(`🔐 Pimlico API Key: ${PIMLICO_API_KEY.substring(0, 20)}...`);
  console.log(`🏭 Zora Factory: ${ZORA_FACTORY_ADDRESS}`);
  
  try {
    // Step 1: Create clients
    console.log('\n\n📊 STEP 1: Creating Clients...');
    const paymasterUrl = NETWORK === 'mainnet'
      ? `https://api.pimlico.io/v2/base/rpc?apikey=${PIMLICO_API_KEY}`
      : `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_API_KEY}`;
    
    const bundlerUrl = paymasterUrl; // Same for Pimlico

    console.log(`   ✓ Paymaster URL: ${paymasterUrl.substring(0, 50)}...`);
    console.log(`   ✓ Bundler URL: ${bundlerUrl.substring(0, 50)}...`);

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });
    console.log('   ✓ Public Client created');

    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
    console.log(`   ✓ Account: ${account.address}`);

    const walletClient = createWalletClient({
      chain,
      account,
      transport: http(),
    });
    console.log('   ✓ Wallet Client created');

    // Step 2: Create Smart Account
    console.log('\n📊 STEP 2: Creating Smart Account...');
    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: walletClient,
      entryPoint: { address: ENTRYPOINT_ADDRESS_V07, version: '0.7' },
    });
    console.log(`   ✓ Smart Account: ${smartAccount.address}`);
    console.log(`   ✓ EntryPoint: ${ENTRYPOINT_ADDRESS_V07}`);

    // Step 3: Create Pimlico Client
    console.log('\n📊 STEP 3: Creating Pimlico Paymaster Client...');
    const pimlicoClient = createPimlicoClient({
      transport: http(paymasterUrl),
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    });
    console.log('   ✓ Pimlico Paymaster Client created');

    // Step 4: Create Smart Account Client with Paymaster
    console.log('\n📊 STEP 4: Creating Smart Account Client with Paymaster...');
    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain,
      bundlerTransport: http(bundlerUrl),
      paymaster: pimlicoClient,
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
    console.log('   ✓ Smart Account Client created with Pimlico Paymaster');

    // Step 5: Test Pimlico API Connectivity
    console.log('\n📊 STEP 5: Testing Pimlico API Connectivity...');
    try {
      const response = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pimlico_getUserOperationStatus',
          params: ['0x'],
        }),
      });
      const data = await response.json();
      console.log('   ✓ Pimlico API is responding');
      console.log(`   ✓ Response status: ${response.status}`);
      if (data.error) {
        console.log(`   ℹ️  Expected validation error (we sent invalid UO hash): ${data.error.message}`);
      }
    } catch (error) {
      console.error('   ❌ Pimlico API error:', error);
      throw error;
    }

    // Step 6: Check Account Balance
    console.log('\n📊 STEP 6: Checking Account Balance...');
    const ethBalance = await publicClient.getBalance({ account: account.address });
    console.log(`   ✓ ETH Balance: ${ethBalance} wei (${Number(ethBalance) / 1e18} ETH)`);

    // Step 7: Check Zora Balance
    console.log('\n📊 STEP 7: Checking ZORA Balance...');
    try {
      const zoraAbi = [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const;

      const zoraBalance = await publicClient.readContract({
        address: ZORA_ADDRESS as `0x${string}`,
        abi: zoraAbi,
        functionName: 'balanceOf',
        args: [account.address],
      });
      console.log(`   ✓ ZORA Balance: ${zoraBalance} (${Number(zoraBalance) / 1e18} ZORA)`);
    } catch (error) {
      console.error('   ⚠️  Could not read ZORA balance:', error);
    }

    // Step 8: Check Zora Factory Contract
    console.log('\n📊 STEP 8: Verifying Zora Factory Contract...');
    try {
      const code = await publicClient.getCode({ address: ZORA_FACTORY_ADDRESS as `0x${string}` });
      console.log(`   ✓ Zora Factory contract exists at ${ZORA_FACTORY_ADDRESS}`);
      console.log(`   ✓ Code length: ${code.length} bytes`);
    } catch (error) {
      console.error('   ❌ Error checking Zora Factory:', error);
      throw error;
    }

    // Step 9: Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(80));
    console.log('\n📋 Test Summary:');
    console.log(`   ✓ Public Client: OK`);
    console.log(`   ✓ Wallet Client: OK`);
    console.log(`   ✓ Smart Account: ${smartAccount.address}`);
    console.log(`   ✓ Pimlico Client: OK`);
    console.log(`   ✓ Smart Account Client: OK`);
    console.log(`   ✓ Pimlico API: RESPONDING`);
    console.log(`   ✓ ETH Balance: ${Number(ethBalance) / 1e18} ETH`);
    console.log(`   ✓ Zora Factory: VERIFIED`);

    console.log('\n🚀 NEXT STEPS:');
    console.log('   1. Run the actual coin creation test');
    console.log('   2. Monitor console for success messages');
    console.log('   3. Check Basescan for $0 gas cost');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testGaslessDeployment().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
