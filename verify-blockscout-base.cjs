
const https = require('https');
const fs = require('fs');

const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const PLATFORM_WALLET = '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b';

// Read the contract source
const contractSource = fs.readFileSync('./contracts/CoinRegistry.sol', 'utf8');

const verificationData = {
  addressHash: CONTRACT_ADDRESS,
  name: 'CoinRegistry',
  compilerVersion: 'v0.8.30+commit.73712a01',
  optimization: true,
  optimizationRuns: 200,
  contractSourceCode: contractSource,
  constructorArguments: '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b',
  evmVersion: 'paris',
  autodetectConstructorArguments: true
};

const postData = JSON.stringify(verificationData);

const options = {
  hostname: 'base.blockscout.com',
  path: '/api/v2/smart-contracts/verification/via/flattened-code',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔍 Attempting verification on Blockscout Base Explorer...\n');
console.log('Contract:', CONTRACT_ADDRESS);
console.log('Network: Base Mainnet\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response:', data);
    
    try {
      const response = JSON.parse(data);
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('\n✅ Verification submitted successfully!');
        console.log('🔗 Check status at: https://base.blockscout.com/address/' + CONTRACT_ADDRESS);
      } else {
        console.log('\n❌ Verification failed');
      }
    } catch (e) {
      console.log('\n⚠️ Could not parse response:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(postData);
req.end();
