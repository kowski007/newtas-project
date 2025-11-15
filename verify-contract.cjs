const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const contractAddress = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const constructorArgs = '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b';
const apiKey = process.env.BASESCAN_API_KEY;
const chainId = '8453';  // Base Mainnet

// Read the contract source
const contractSource = fs.readFileSync(path.join(__dirname, 'contracts', 'CoinRegistry.sol'), 'utf8');

const postData = new URLSearchParams({
  module: 'contract',
  action: 'verifysourcecode',
  contractaddress: contractAddress,
  sourceCode: contractSource,
  codeformat: 'solidity-single-file',
  contractname: 'CoinRegistry',
  compilerversion: 'v0.8.20+commit.a1b79de6',
  optimizationUsed: '0',  // NO OPTIMIZATION
  constructorArguements: constructorArgs,
  licenseType: '3'  // MIT License
}).toString();

const options = {
  hostname: 'api.etherscan.io',
  port: 443,
  path: `/v2/api?chainid=${chainId}&apikey=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Attempting verification WITHOUT optimization...');
console.log('Contract Address:', contractAddress, '\n');

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
        console.log('\n✅ Verification submitted!');
        console.log('GUID:', response.result);
      } else {
        console.log('\n❌ Verification failed:', response.result);
      }
    } catch (err) {
      console.error('Error:', err);
      console.log('Raw:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(postData);
req.end();
