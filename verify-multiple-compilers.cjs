const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const contractAddress = '0x2ea259ccd2e983f9e635f138b28655d62127f6bb';
const constructorArgs = '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b';
const apiKey = process.env.BASESCAN_API_KEY;
const chainId = '8453';

const contractSource = fs.readFileSync(path.join(__dirname, 'contracts', 'CoinRegistry.sol'), 'utf8');

// Try different compiler versions around 0.8.20
const compilerVersions = [
  'v0.8.19+commit.7dd6d404',
  'v0.8.20+commit.a1b79de6',
  'v0.8.21+commit.d9974bed',
  'v0.8.22+commit.4fc1097e',
  'v0.8.23+commit.f704f362',
  'v0.8.24+commit.e11b9ed9',
  'v0.8.25+commit.b61c2a91',
];

function tryVerification(compilerVersion, index) {
  const postData = new URLSearchParams({
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: contractSource,
    codeformat: 'solidity-single-file',
    contractname: 'CoinRegistry',
    compilerversion: compilerVersion,
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

  console.log(`\n[${index + 1}/${compilerVersions.length}] Trying compiler: ${compilerVersion}...`);

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.status === '1') {
          console.log(`✅ Submitted! GUID: ${response.result}`);
        } else {
          console.log(`❌ ${response.result.substring(0, 80)}...`);
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

console.log('🔍 Trying different Solidity compiler versions...\n');
compilerVersions.forEach((version, index) => {
  setTimeout(() => tryVerification(version, index), index * 2000);
});
