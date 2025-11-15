
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Contract details
const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const PLATFORM_WALLET = '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b';
const API_KEY = process.env.BASESCAN_API_KEY;
const CHAIN_ID = '8453';  // Base Mainnet

if (!API_KEY) {
  console.error('❌ BASESCAN_API_KEY not found in .env');
  process.exit(1);
}

console.log('🔍 Verifying CoinRegistry contract on Base Mainnet...\n');
console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Platform Wallet (constructor arg):', PLATFORM_WALLET);
console.log('Chain ID:', CHAIN_ID);
console.log('');

// Read the contract source code
const contractSource = fs.readFileSync(
  path.join(__dirname, 'contracts', 'CoinRegistry.sol'),
  'utf8'
);

// ABI-encode the constructor argument (address)
// An address needs to be padded to 32 bytes (64 hex characters)
const abiEncodedConstructorArg = '000000000000000000000000' + PLATFORM_WALLET.replace('0x', '').toLowerCase();

console.log('ABI-encoded constructor arg:', abiEncodedConstructorArg);
console.log('');

// Prepare verification data - trying multiple compiler versions
const verificationData = {
  codeformat: 'solidity-single-file',
  sourceCode: contractSource,
  contractaddress: CONTRACT_ADDRESS,
  contractname: 'CoinRegistry',
  compilerversion: 'v0.8.20+commit.a1b79de6',
  optimizationUsed: '0',  // Try without optimization first
  runs: '200',
  constructorArguements: abiEncodedConstructorArg,
  evmversion: 'shanghai',  // Try shanghai instead of paris
  licenseType: '3'
};

// Convert to URL encoded format
const formData = Object.entries(verificationData)
  .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  .join('&');

// Submit verification - chainid must be in query string (lowercase)
const options = {
  hostname: 'api.etherscan.io',
  path: `/v2/api?chainid=${CHAIN_ID}&module=contract&action=verifysourcecode&apikey=${API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData)
  }
};

console.log('📤 Submitting verification request...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    // Check if response is HTML (rate limit or error)
    if (data.trim().startsWith('<')) {
      console.error('❌ API returned HTML instead of JSON');
      console.error('This usually means rate limit exceeded or API issue');
      console.error('\nPlease wait 5 seconds and try again, or verify manually at:');
      console.error(`https://basescan.org/verifyContract?a=${CONTRACT_ADDRESS}`);
      return;
    }

    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));

      if (response.status === '1') {
        console.log('\n✅ Verification submitted successfully!');
        console.log('GUID:', response.result);
        console.log('\n⏳ Checking status in 20 seconds...');

        setTimeout(() => {
          checkVerificationStatus(response.result);
        }, 20000);
      } else {
        console.log('\n❌ Verification submission failed');
        console.log('Status:', response.status);
        console.log('Message:', response.message);
        console.log('Result:', response.result);
        
        if (response.result && (response.result.includes('already verified') || response.result.includes('Already Verified'))) {
          console.log('\n✅ Contract appears to be already verified!');
        }
        
        console.log('\n🔍 Checking current verification status...');
        setTimeout(() => checkIfAlreadyVerified(), 2000);
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      console.error('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(formData);
req.end();

function checkVerificationStatus(guid) {
  const statusUrl = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${API_KEY}`;

  https.get(statusUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('\n📋 Verification Status:');
        console.log(JSON.stringify(response, null, 2));

        if (response.status === '1' && response.result && response.result.includes('Pass')) {
          console.log('\n✅ Contract verified successfully!');
          console.log(`\n🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else if (response.result && response.result.includes('Pending')) {
          console.log('\n⏳ Verification still pending. Check in a few minutes at:');
          console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else {
          console.log('\n⚠️  Verification status unclear. Check manually at:');
          console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        }
      } catch (e) {
        console.error('❌ Error parsing status response:', e.message);
        console.error('Raw response:', data.substring(0, 500));
      }
    });
  }).on('error', (e) => {
    console.error('❌ Status check error:', e.message);
  });
}

function checkIfAlreadyVerified() {
  const checkUrl = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=getsourcecode&address=${CONTRACT_ADDRESS}&apikey=${API_KEY}`;

  https.get(checkUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.status === '1' && response.result && response.result[0]) {
          const result = response.result[0];
          if (result.SourceCode && result.SourceCode !== '') {
            console.log('\n✅ Contract is already verified on BaseScan!');
            console.log('Contract Name:', result.ContractName);
            console.log('Compiler Version:', result.CompilerVersion);
            console.log('Optimization:', result.OptimizationUsed === '1' ? 'Enabled' : 'Disabled');
            console.log('Runs:', result.Runs);
            console.log(`\n🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
          } else {
            console.log('\n❌ Contract is not verified yet.');
            console.log(`\n💡 Manual verification: https://basescan.org/verifyContract?a=${CONTRACT_ADDRESS}`);
          }
        } else {
          console.log('\n⚠️  Could not check verification status.');
          console.log('   Check manually at: https://basescan.org/address/' + CONTRACT_ADDRESS + '#code');
        }
      } catch (e) {
        console.error('❌ Error checking verification status:', e.message);
        console.error('Raw response:', data.substring(0, 500));
      }
    });
  }).on('error', (e) => {
    console.error('❌ Check error:', e.message);
  });
}
