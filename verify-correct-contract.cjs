const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const contractAddress = '0x87D5F90C8a95af80c4cfAa2a7ca5C7Ee72F6A0E9';
const constructorArgs = '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b';
const apiKey = process.env.BASESCAN_API_KEY;
const chainId = '8453';  // Base Mainnet

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
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Verifying CoinRegistry contract on BaseScan...');
console.log('Contract Address:', contractAddress);
console.log('Constructor Arg (Platform Wallet): 0xd657131ed517c53eabaeb2f0ee66de91c40ed74b\n');

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
        console.log('\nView your contract at:');
        console.log(`https://basescan.org/address/${contractAddress}#code`);
      } else {
        console.log('\n❌ Verification failed:', response.result);
      }
    } catch (err) {
      console.error('Error parsing response:', err);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(postData);
req.end();
