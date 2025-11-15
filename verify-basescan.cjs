
const { ethers } = require("ethers");
const fetch = require("node-fetch-native");
require("dotenv").config();

async function verifyContract() {
  // Base Mainnet contract address from transaction 0x59d549b9cbf3b7b9e80077dd2c43f896fae3000c49a962e092c0433704869551
  const contractAddress = "0x2ea259ccD2e983f9E635f138b28655d62127F6Bb";
  const constructorArgs = "0xd657131ed517c53eabaeb2f0ee66de91c40ed74b";
  const apiKey = process.env.BASESCAN_API_KEY;

  if (!apiKey) {
    console.error("❌ BASESCAN_API_KEY not found in .env");
    process.exit(1);
  }

  console.log("🔍 Verifying contract on Base Mainnet BaseScan...");
  console.log("Contract:", contractAddress);
  console.log("Constructor args:", constructorArgs);

  // Read the contract source
  const fs = require("fs");
  const path = require("path");
  const sourcePath = path.join(__dirname, "contracts/CoinRegistry.sol");
  const sourceCode = fs.readFileSync(sourcePath, "utf8");

  // Prepare verification request for V1 API (standard format)
  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: contractAddress,
    sourceCode: sourceCode,
    codeformat: "solidity-single-file",
    contractname: "CoinRegistry",
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: constructorArgs.replace("0x", ""),
    evmversion: "paris",
    licenseType: "3", // MIT License
  });

  try {
    const response = await fetch(
      "https://api.basescan.org/api",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const responseText = await response.text();
    console.log("\n📥 Raw response:", responseText.substring(0, 200));

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ Failed to parse response as JSON");
      console.error("Response was:", responseText.substring(0, 500));
      return;
    }

    console.log("\n✅ Verification submitted!");
    console.log("Result:", result);
    
    if (result.status === "1" || result.message === "OK") {
      console.log("\n🎉 Contract verification successful!");
      console.log("View on BaseScan: https://basescan.org/address/" + contractAddress);
      if (result.result) {
        console.log("GUID:", result.result);
      }
    } else {
      console.log("\n⏳ Verification pending or failed. Check status at:");
      console.log("https://basescan.org/address/" + contractAddress);
    }
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }
}

verifyContract();
