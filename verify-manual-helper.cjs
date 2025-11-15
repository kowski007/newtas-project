
const fs = require('fs');

console.log('📋 MANUAL VERIFICATION HELPER\n');
console.log('=' .repeat(70));

const contractSource = fs.readFileSync('./contracts/CoinRegistry.sol', 'utf8');
let flattenedSource = '';
try {
  flattenedSource = fs.readFileSync('./CoinRegistry-flattened.sol', 'utf8');
} catch (e) {
  console.log('⚠️ Flattened source not found (run flatten command first)\n');
}

console.log('\n🔗 VERIFICATION URL:');
console.log('https://basescan.org/verifyContract?a=0x2ea259ccD2e983f9E635f138b28655d62127F6Bb\n');

console.log('📝 SETTINGS TO USE:\n');
console.log('Compiler Type: Solidity (Single file)');
console.log('Compiler Version: v0.8.30+commit.73712a01');
console.log('Open Source License Type: 3) MIT');
console.log('Optimization Enabled: Yes');
console.log('Runs: 200');
console.log('EVM Version: paris\n');

console.log('🔐 CONSTRUCTOR ARGUMENTS (ABI-encoded):');
console.log('000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b\n');

console.log('📄 CONTRACT SOURCE OPTIONS:\n');
console.log('Option 1: Use flattened source (recommended):');
if (flattenedSource) {
  console.log('✅ Flattened source is ready in: CoinRegistry-flattened.sol');
  console.log('   Copy this file content to BaseScan');
} else {
  console.log('❌ Run: npx hardhat flatten contracts/CoinRegistry.sol > CoinRegistry-flattened.sol');
}

console.log('\nOption 2: Use original source:');
console.log('   Copy content from: contracts/CoinRegistry.sol\n');

console.log('⚙️ ADVANCED SETTINGS TO TRY IF VERIFICATION FAILS:\n');
console.log('1. Try "Autodetect Constructor Arguments": YES');
console.log('2. Try different Metadata Settings:');
console.log('   - Metadata Bytecode Hash: ipfs');
console.log('   - Then try: none');
console.log('   - Then try: bzzr1');
console.log('3. Try different EVM versions:');
console.log('   - paris (current)');
console.log('   - shanghai');
console.log('   - default\n');

console.log('=' .repeat(70));
console.log('\n💡 TIP: If verification still fails with bytecode mismatch,');
console.log('the contract may have been compiled with different settings');
console.log('than what we have configured. The contract works perfectly');
console.log('either way - verification is only for transparency.\n');

// Save settings to a file for easy reference
const settings = {
  url: 'https://basescan.org/verifyContract?a=0x2ea259ccD2e983f9E635f138b28655d62127F6Bb',
  compilerType: 'Solidity (Single file)',
  compilerVersion: 'v0.8.30+commit.73712a01',
  license: 'MIT',
  optimization: true,
  runs: 200,
  evmVersion: 'paris',
  constructorArguments: '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b',
  constructorArgumentsDecoded: {
    platformWallet: '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b'
  }
};

fs.writeFileSync('verification-settings.json', JSON.stringify(settings, null, 2));
console.log('✅ Verification settings saved to: verification-settings.json\n');
