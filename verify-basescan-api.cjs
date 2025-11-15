
const https = require('https');
const fs = require('fs');

const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || '';

if (!BASESCAN_API_KEY) {
  console.error('❌ BASESCAN_API_KEY not found in environment variables');
  console.log('💡 Add your BaseScan API key to .env file:');
  console.log('   BASESCAN_API_KEY=your_api_key_here');
  console.log('   Get one at: https://basescan.org/myapikey');
  process.exit(1);
}

// Read the contract source
const contractSource = fs.readFileSync('./contracts/CoinRegistry.sol', 'utf8');

// Prepare form data for standard Etherscan API
const params = new URLSearchParams({
  module: 'contract',
  action: 'verifysourcecode',
  contractaddress: CONTRACT_ADDRESS,
  sourceCode: contractSource,
  codeformat: 'solidity-single-file',
  contractname: 'CoinRegistry',
  compilerversion: 'v0.8.30+commit.73712a01',
  optimizationUsed: '1',
  runs: '200',
  constructorArguements: '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b',
  evmversion: 'paris',
  licenseType: '3',
  apikey: BASESCAN_API_KEY
});

console.log('🔍 Submitting verification to BaseScan API...\n');
console.log('Contract:', CONTRACT_ADDRESS);
console.log('Network: Base Mainnet\n');

const options = {
  hostname: 'api.basescan.org',
  path: '/api',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(params.toString())
  }
};

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
      if (response.status === '1') {
        console.log('\n✅ Verification submitted successfully!');
        console.log('📋 GUID:', response.result);
        console.log('\n⏳ Checking verification status in 15 seconds...');
        setTimeout(() => checkStatus(response.result), 15000);
      } else {
        console.log('\n❌ Verification submission failed');
        console.log('Message:', response.result);
        
        if (response.result && response.result.includes('already verified')) {
          console.log('\n✅ Contract is already verified!');
          console.log(`🔗 View at: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        }
      }
    } catch (e) {
      console.log('\n⚠️ Could not parse response:', e.message);
      console.log('\n💡 Try manual verification at:');
      console.log(`   https://basescan.org/verifyContract?a=${CONTRACT_ADDRESS}`);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(params.toString());
req.end();

function checkStatus(guid) {
  const statusParams = new URLSearchParams({
    module: 'contract',
    action: 'checkverifystatus',
    guid: guid,
    apikey: BASESCAN_API_KEY
  });

  const statusOptions = {
    hostname: 'api.basescan.org',
    path: `/api?${statusParams.toString()}`,
    method: 'GET'
  };

  const statusReq = https.request(statusOptions, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('\n📊 Verification Status:', response.result);
        
        if (response.status === '1') {
          console.log('\n✅ Contract verified successfully!');
          console.log(`🔗 View at: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else if (response.result && response.result.includes('Pending')) {
          console.log('⏳ Still processing... Check status at:');
          console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else {
          console.log('\n❌ Verification failed');
          console.log('💡 Try manual verification at:');
          console.log(`   https://basescan.org/verifyContract?a=${CONTRACT_ADDRESS}`);
        }
      } catch (e) {
        console.log('⚠️ Could not parse status response');
      }
    });
  });

  statusReq.on('error', (error) => {
    console.error('❌ Status check error:', error.message);
  });

  statusReq.end();
}
