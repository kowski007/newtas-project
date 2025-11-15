const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Contract details
const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const CONSTRUCTOR_ARG = '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b';
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;

console.log('🔍 Verifying CoinRegistry contract on Base Mainnet...\n');
console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Constructor Arg:', CONSTRUCTOR_ARG);
console.log('');

// Read the contract source code
const contractSource = fs.readFileSync(
  path.join(__dirname, 'contracts', 'CoinRegistry.sol'),
  'utf8'
);

// Prepare verification data
const verificationData = {
  chainid: '8453',
  codeformat: 'solidity-single-file',
  sourceCode: contractSource,
  contractaddress: CONTRACT_ADDRESS,
  contractname: 'CoinRegistry',
  compilerversion: 'v0.8.20+commit.a1b79de6',
  optimizationUsed: '1',
  runs: '200',
  constructorArguements: CONSTRUCTOR_ARG.replace('0x', ''),
  evmversion: 'paris',
  licenseType: '3', // MIT
  apikey: BASESCAN_API_KEY,
  module: 'contract',
  action: 'verifysourcecode'
};

// Convert to URL encoded format
const formData = Object.entries(verificationData)
  .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  .join('&');

// Submit verification
const options = {
  hostname: 'api.basescan.org',
  path: '/api',
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
    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));

      if (response.status === '1') {
        console.log('\n✅ Verification submitted successfully!');
        console.log('GUID:', response.result);
        console.log('\n⏳ Checking status in 15 seconds...');

        // Wait and check status
        setTimeout(() => {
          checkVerificationStatus(response.result);
        }, 15000);
      } else {
        console.log('\n❌ Verification failed:', response.message);
        console.log('Result:', response.result);
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      console.error('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(formData);
req.end();

function checkVerificationStatus(guid) {
  const statusUrl = `https://api.basescan.org/api?chainid=8453&module=contract&action=checkverifystatus&guid=${guid}&apikey=${BASESCAN_API_KEY}`;

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

        if (response.status === '1') {
          console.log('\n✅ Contract verified successfully!');
          console.log(`\n🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else if (response.result && response.result.includes('Pending')) {
          console.log('\n⏳ Verification still pending. Check manually at:');
          console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else {
          console.log('\n❌ Verification may have failed. Check at:');
          console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        }
      } catch (e) {
        console.error('❌ Error parsing status response:', e.message);
        console.error('Raw response:', data);
      }
    });
  }).on('error', (e) => {
    console.error('❌ Status check error:', e.message);
  });
}
