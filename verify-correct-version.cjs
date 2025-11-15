const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Contract details
const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const PLATFORM_WALLET = '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b';
const API_KEY = process.env.BASESCAN_API_KEY;
const CHAIN_ID = '8453';

console.log('🔍 Verifying CoinRegistry contract with correct compiler version v0.8.30...\n');
console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Platform Wallet:', PLATFORM_WALLET);
console.log('');

// Read the contract source code
const contractSource = fs.readFileSync(
  path.join(__dirname, 'contracts', 'CoinRegistry.sol'),
  'utf8'
);

// ABI-encode the constructor argument
const abiEncodedConstructorArg = '000000000000000000000000' + PLATFORM_WALLET.replace('0x', '').toLowerCase();

// Prepare verification data with v0.8.30
const verificationData = {
  codeformat: 'solidity-single-file',
  sourceCode: contractSource,
  contractaddress: CONTRACT_ADDRESS,
  contractname: 'CoinRegistry',
  compilerversion: 'v0.8.30+commit.01621d52',  // Correct version!
  optimizationUsed: '1',
  runs: '200',
  constructorArguements: abiEncodedConstructorArg,
  evmversion: 'paris'
};

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

console.log('📤 Submitting verification with v0.8.30...\n');

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
        console.log('\n⏳ Checking status in 20 seconds...');

        setTimeout(() => {
          checkVerificationStatus(response.result);
        }, 20000);
      } else {
        console.log('\n❌ Verification submission failed');
        console.log('Status:', response.status);
        console.log('Message:', response.message);
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
          console.log('\n🎉 SUCCESS! Contract verified successfully!');
          console.log(`\n🔗 View verified contract on BaseScan:`);
          console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else if (response.result && response.result.includes('Pending')) {
          console.log('\n⏳ Verification still pending. Checking again in 10 seconds...');
          setTimeout(() => checkVerificationStatus(guid), 10000);
        } else {
          console.log('\n❌ Verification failed with status:', response.result);
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
