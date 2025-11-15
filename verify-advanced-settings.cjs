const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const contractAddress = '0x2ea259ccd2e983f9e635f138b28655d62127f6bb';
const constructorArgs = '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b';
const apiKey = process.env.BASESCAN_API_KEY;
const chainId = '8453';

const contractSource = fs.readFileSync(path.join(__dirname, 'contracts', 'CoinRegistry.sol'), 'utf8');

// Try with optimization disabled completely
const settings = [
  { compiler: 'v0.8.20+commit.a1b79de6', optimization: '0', runs: '', evm: '' },
  { compiler: 'v0.8.19+commit.7dd6d404', optimization: '0', runs: '', evm: '' },
  { compiler: 'v0.8.24+commit.e11b9ed9', optimization: '0', runs: '', evm: '' },
];

function tryVerification(setting, index) {
  const params = {
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: contractSource,
    codeformat: 'solidity-single-file',
    contractname: 'CoinRegistry',
    compilerversion: setting.compiler,
    optimizationUsed: setting.optimization,
    constructorArguements: constructorArgs,
    licenseType: '3'
  };
  
  if (setting.runs) params.runs = setting.runs;
  if (setting.evm) params.evmversion = setting.evm;

  const postData = new URLSearchParams(params).toString();

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

  console.log(`\n[${index + 1}] Compiler: ${setting.compiler.split('+')[0]}, Optimization: ${setting.optimization === '1' ? 'Yes' : 'No'}`);

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.status === '1') {
          console.log(`✅ GUID: ${response.result}`);
        } else {
          console.log(`❌ ${response.result.substring(0, 60)}...`);
        }
      } catch (err) {
        console.error('Error:', err);
      }
    });
  });

  req.on('error', (error) => console.error('Error:', error));
  req.write(postData);
  req.end();
}

console.log('🔍 Trying verification with NO optimization...\n');
settings.forEach((setting, index) => {
  setTimeout(() => tryVerification(setting, index), index * 2000);
});
