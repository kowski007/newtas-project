const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const CHAIN_ID = '8453'; // Base Mainnet

console.log('🔍 Attempting Sourcify verification (decentralized alternative)...\n');
console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Chain ID:', CHAIN_ID);
console.log('');

// Read contract source
const contractSource = fs.readFileSync(
  path.join(__dirname, 'contracts', 'CoinRegistry.sol'),
  'utf8'
);

// Create metadata JSON
const metadata = {
  compiler: {
    version: '0.8.30+commit.73712a01'
  },
  language: 'Solidity',
  output: {
    abi: [],
    devdoc: {
      kind: 'dev',
      methods: {},
      version: 1
    },
    userdoc: {
      kind: 'user',
      methods: {},
      version: 1
    }
  },
  settings: {
    compilationTarget: {
      'CoinRegistry.sol': 'CoinRegistry'
    },
    evmVersion: 'paris',
    libraries: {},
    metadata: {
      bytecodeHash: 'ipfs'
    },
    optimizer: {
      enabled: true,
      runs: 200
    },
    remappings: []
  },
  sources: {
    'CoinRegistry.sol': {
      keccak256: require('crypto').createHash('sha256').update(contractSource).digest('hex'),
      urls: ['bzz-raw://...', 'dweb:/ipfs/...']
    }
  },
  version: 1
};

const FormData = require('form-data');
const form = new FormData();

form.append('address', CONTRACT_ADDRESS);
form.append('chain', CHAIN_ID);
form.append('files', contractSource, {
  filename: 'CoinRegistry.sol',
  contentType: 'text/plain'
});
form.append('files', JSON.stringify(metadata, null, 2), {
  filename: 'metadata.json',
  contentType: 'application/json'
});

console.log('📤 Submitting to Sourcify...\n');

const options = {
  hostname: 'sourcify.dev',
  port: 443,
  path: '/server/verify',
  method: 'POST',
  headers: form.getHeaders()
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));

      if (response.result && response.result.length > 0) {
        const result = response.result[0];
        if (result.status === 'perfect' || result.status === 'partial') {
          console.log('\n✅ Contract verified on Sourcify!');
          console.log(`Status: ${result.status}`);
          console.log(`\n🔗 View on Sourcify:`);
          console.log(`   https://sourcify.dev/#/lookup/${CONTRACT_ADDRESS}`);
          console.log(`\n🔗 View on BaseScan (syncs from Sourcify):`);
          console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else {
          console.log('\n⚠️ Verification status:', result.status);
        }
      } else if (data.includes('already verified')) {
        console.log('\n✅ Contract already verified on Sourcify!');
        console.log(`\n🔗 View: https://sourcify.dev/#/lookup/${CONTRACT_ADDRESS}`);
      } else {
        console.log('\n❌ Verification response:', data);
      }
    } catch (e) {
      console.log('Response text:', data);
      if (data.includes('Verified') || data.includes('already')) {
        console.log('\n✅ Verification successful!');
      } else {
        console.log('\n❌ Parse error:', e.message);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  console.log('\n💡 Sourcify verification failed. Contract verification alternatives:');
  console.log('   1. Manual verification: https://basescan.org/verifyContract');
  console.log('   2. The contract is deployed and functional even without verification');
});

form.pipe(req);
