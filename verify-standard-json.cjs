const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const PLATFORM_WALLET = '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b';
const API_KEY = process.env.BASESCAN_API_KEY;
const CHAIN_ID = '8453';

console.log('🔍 Verifying with Standard JSON Input (supports metadata settings)...\n');
console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Platform Wallet:', PLATFORM_WALLET);
console.log('');

// Read contract source
const contractSource = fs.readFileSync(
  path.join(__dirname, 'contracts', 'CoinRegistry.sol'),
  'utf8'
);

// ABI-encode constructor argument
const abiEncodedConstructorArg = '000000000000000000000000' + PLATFORM_WALLET.replace('0x', '').toLowerCase();

// Standard JSON Input with different metadata options
const metadataOptions = ['none', 'ipfs', 'bzzr1'];

let currentAttempt = 0;

function tryVerification(bytecodeHash) {
  console.log(`${'='.repeat(70)}`);
  console.log(`Attempt ${currentAttempt + 1}/${metadataOptions.length}: bytecodeHash = "${bytecodeHash}"`);
  console.log(`${'='.repeat(70)}\n`);

  const standardJsonInput = {
    language: 'Solidity',
    sources: {
      'CoinRegistry.sol': {
        content: contractSource
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'paris',
      metadata: {
        bytecodeHash: bytecodeHash
      },
      outputSelection: {
        '*': {
          '*': ['evm.bytecode', 'evm.deployedBytecode', 'abi']
        }
      }
    }
  };

  const verificationData = {
    codeformat: 'solidity-standard-json-input',
    sourceCode: JSON.stringify(standardJsonInput),
    contractaddress: CONTRACT_ADDRESS,
    contractname: 'CoinRegistry.sol:CoinRegistry',
    compilerversion: 'v0.8.30+commit.73712a01',
    constructorArguements: abiEncodedConstructorArg
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
          console.log('⏳ Checking status in 20 seconds...\n');

          setTimeout(() => {
            checkVerificationStatus(response.result, bytecodeHash);
          }, 20000);
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

function checkVerificationStatus(guid, bytecodeHash) {
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
          console.log(`\n🎉 SUCCESS! Contract verified with bytecodeHash="${bytecodeHash}"`);
          console.log(`\n🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
          process.exit(0);
        } else if (response.result && response.result.includes('Pending')) {
          console.log('⏳ Still pending, checking again in 10 seconds...');
          setTimeout(() => checkVerificationStatus(guid, bytecodeHash), 10000);
        } else {
          console.log('❌ Verification failed with this metadata setting');
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
  if (currentAttempt < metadataOptions.length) {
    setTimeout(() => tryVerification(metadataOptions[currentAttempt]), 2000);
  } else {
    console.log('\n❌ All Standard JSON attempts failed.');
    console.log('\n💡 The bytecode mismatch may be due to:');
    console.log('   - Different Solidity compiler build');
    console.log('   - Different optimization settings during deployment');
    console.log('   - The contract was deployed with custom metadata settings');
    console.log('\n📋 Manual verification recommended at:');
    console.log(`   https://basescan.org/verifyContract?a=${CONTRACT_ADDRESS}`);
    console.log('\n✅ Your contract is deployed and functional at:');
    console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}`);
  }
}

console.log('🚀 Starting Standard JSON verification attempts...');
console.log(`Trying ${metadataOptions.length} different metadata configurations...\n`);

// Start with first configuration
tryVerification(metadataOptions[currentAttempt]);
