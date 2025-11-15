const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const contractAddress = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const constructorArgs = '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b';
const apiKey = process.env.BASESCAN_API_KEY;
const chainId = '8453';

const contractSource = fs.readFileSync(path.join(__dirname, 'contracts', 'CoinRegistry.sol'), 'utf8');

const postData = new URLSearchParams({
  module: 'contract',
  action: 'verifysourcecode',
  contractaddress: contractAddress,
  sourceCode: contractSource,
  codeformat: 'solidity-single-file',
  contractname: 'CoinRegistry',
  compilerversion: 'v0.8.20+commit.a1b79de6',
  optimizationUsed: '1',
  runs: '200',
  constructorArguements: constructorArgs,
  licenseType: '3'
}).toString();

const options = {
  hostname: 'api.etherscan.io',
  port: 443,
  path: `/v2/api?chainid=${chainId}&apikey=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
    'Accept': 'application/json'
  }
};

console.log('🚀 Verifying CoinRegistry contract...');
console.log('Contract:', contractAddress);
console.log('API Endpoint:', `https://${options.hostname}${options.path}`);
console.log();

const req = https.request(options, (res) => {
  let data = '';
  
  console.log('Response Status:', res.statusCode);
  console.log('Response Headers:', res.headers);
  console.log();
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Raw Response (first 500 chars):');
    console.log(data.substring(0, 500));
    console.log('...\n');
    
    // Check if response is HTML
    if (data.trim().startsWith('<')) {
      console.log('❌ ERROR: Received HTML instead of JSON');
      console.log('This usually means:');
      console.log('  1. Rate limit exceeded (too many requests)');
      console.log('  2. API endpoint issue');
      console.log('  3. Invalid API key');
      console.log('\nFull HTML response:');
      console.log(data);
      return;
    }
    
    try {
      const response = JSON.parse(data);
      console.log('Parsed JSON Response:', JSON.stringify(response, null, 2));
      
      if (response.status === '1') {
        console.log('\n✅ Verification submitted successfully!');
        console.log('GUID:', response.result);
        console.log('\nView at: https://basescan.org/address/' + contractAddress + '#code');
      } else {
        console.log('\n❌ Verification failed:', response.result);
      }
    } catch (err) {
      console.error('❌ JSON Parse Error:', err.message);
      console.log('\nThis means the API returned invalid JSON or HTML.');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error);
});

req.write(postData);
req.end();
