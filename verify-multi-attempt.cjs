const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Contract details
const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const PLATFORM_WALLET = '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b';
const API_KEY = process.env.BASESCAN_API_KEY;
const CHAIN_ID = '8453';

// ABI-encode the constructor argument
const abiEncodedConstructorArg = '000000000000000000000000' + PLATFORM_WALLET.replace('0x', '').toLowerCase();

// Read the contract source code
const contractSource = fs.readFileSync(
  path.join(__dirname, 'contracts', 'CoinRegistry.sol'),
  'utf8'
);

// Try different compiler versions and settings
const configurations = [
  // Try without evmversion
  {
    compilerversion: 'v0.8.20+commit.a1b79de6',
    evmversion: '',
    description: 'v0.8.20 with default EVM version'
  },
  // Try shanghai
  {
    compilerversion: 'v0.8.20+commit.a1b79de6',
    evmversion: 'shanghai',
    description: 'v0.8.20 with shanghai EVM version'
  },
  // Try london
  {
    compilerversion: 'v0.8.20+commit.a1b79de6',
    evmversion: 'london',
    description: 'v0.8.20 with london EVM version'
  },
  // Try v0.8.21
  {
    compilerversion: 'v0.8.21+commit.d9974bed',
    evmversion: 'paris',
    description: 'v0.8.21 with paris EVM version'
  },
  // Try v0.8.19
  {
    compilerversion: 'v0.8.19+commit.7dd6d404',
    evmversion: 'paris',
    description: 'v0.8.19 with paris EVM version'
  }
];

let currentAttempt = 0;

function tryVerification(config) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Attempt ${currentAttempt + 1}/${configurations.length}: ${config.description}`);
  console.log(`${'='.repeat(70)}\n`);

  const verificationData = {
    codeformat: 'solidity-single-file',
    sourceCode: contractSource,
    contractaddress: CONTRACT_ADDRESS,
    contractname: 'CoinRegistry',
    compilerversion: config.compilerversion,
    optimizationUsed: '1',
    runs: '200',
    constructorArguements: abiEncodedConstructorArg
  };

  if (config.evmversion) {
    verificationData.evmversion = config.evmversion;
  }

  const formData = Object.entries(verificationData)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const options = {
    hostname: 'api.etherscan.io',
    path: `/v2/api?chainid=${CHAIN_ID}&module=contract&action=verifysourcecode&apikey=${API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        if (response.status === '1') {
          console.log('✅ Verification submitted!');
          console.log('GUID:', response.result);
          console.log('⏳ Waiting 15 seconds before checking status...\n');

          setTimeout(() => {
            checkVerificationStatus(response.result, config);
          }, 15000);
        } else {
          console.log('❌ Submission failed:', response.result);
          tryNextConfig();
        }
      } catch (e) {
        console.error('❌ Error parsing response:', e.message);
        tryNextConfig();
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request error:', e.message);
    tryNextConfig();
  });

  req.write(formData);
  req.end();
}

function checkVerificationStatus(guid, config) {
  const statusUrl = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${API_KEY}`;

  https.get(statusUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('Status:', response.result);

        if (response.status === '1' && response.result && response.result.includes('Pass')) {
          console.log('\n🎉 SUCCESS! Contract verified with:', config.description);
          console.log(`\n🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
          process.exit(0);
        } else if (response.result && response.result.includes('Pending')) {
          console.log('⏳ Still pending, checking again in 10 seconds...');
          setTimeout(() => checkVerificationStatus(guid, config), 10000);
        } else {
          console.log('❌ Verification failed');
          tryNextConfig();
        }
      } catch (e) {
        console.error('❌ Error parsing status:', e.message);
        tryNextConfig();
      }
    });
  }).on('error', (e) => {
    console.error('❌ Status check error:', e.message);
    tryNextConfig();
  });
}

function tryNextConfig() {
  currentAttempt++;
  if (currentAttempt < configurations.length) {
    setTimeout(() => tryVerification(configurations[currentAttempt]), 2000);
  } else {
    console.log('\n❌ All attempts failed.');
    console.log('\n💡 The contract may need manual verification at:');
    console.log('   https://basescan.org/verifyContract');
    console.log('\nOr try viewing the unverified contract at:');
    console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
  }
}

console.log('🔍 Starting multi-configuration verification...');
console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Platform Wallet:', PLATFORM_WALLET);
console.log(`Trying ${configurations.length} different configurations...\n`);

// Start with first configuration
tryVerification(configurations[currentAttempt]);
