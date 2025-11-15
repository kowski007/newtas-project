const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const contractAddress = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const constructorArgs = '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b';
const apiKey = process.env.BASESCAN_API_KEY;
const chainId = '8453';

const contractSource = fs.readFileSync(path.join(__dirname, 'contracts', 'CoinRegistry.sol'), 'utf8');

// Try different common settings
const settingsToTry = [
  { optimization: '1', runs: '200', evmVersion: '' },
  { optimization: '1', runs: '200', evmVersion: 'paris' },
  { optimization: '1', runs: '200', evmVersion: 'shanghai' },
  { optimization: '1', runs: '1', evmVersion: '' },
  { optimization: '1', runs: '999999', evmVersion: '' },
];

let currentIndex = 0;

function tryVerification(settings) {
  const postData = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: contractSource,
    codeformat: 'solidity-single-file',
    contractname: 'CoinRegistry',
    compilerversion: 'v0.8.20+commit.a1b79de6',
    optimizationUsed: settings.optimization,
    runs: settings.runs,
    constructorArguements: constructorArgs,
    licenseType: '3',
    ...(settings.evmVersion && { evmversion: settings.evmVersion })
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

  console.log(`\nTrying: Optimization=${settings.optimization}, Runs=${settings.runs}, EVM=${settings.evmVersion || 'default'}...`);

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.status === '1') {
          console.log('✅ Submitted! GUID:', response.result);
          console.log(`\n🎉 SUCCESS! Contract verification may have succeeded with these settings:`);
          console.log(`   Optimization: ${settings.optimization === '1' ? 'Yes' : 'No'}`);
          console.log(`   Runs: ${settings.runs}`);
          console.log(`   EVM Version: ${settings.evmVersion || 'default'}`);
          console.log(`\nView at: https://basescan.org/address/${contractAddress}#code`);
        } else {
          console.log('❌', response.result);
        }
      } catch (err) {
        console.error('Parse error:', err);
      }
    });
  });

  req.on('error', (error) => console.error('Error:', error));
  req.write(postData);
  req.end();
}

console.log('🔍 Trying different compilation settings to find the right match...\n');
settingsToTry.forEach((settings, index) => {
  setTimeout(() => tryVerification(settings), index * 2000); // 2 second delay between attempts
});
