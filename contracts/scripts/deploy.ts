/**
 * deploy.ts — Production deploy script for LandTitleNFT and LandRegistry.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network besu_local
 *
 * Environment variables (from root .env):
 *   REGISTRAR_PRIVATE_KEY  — private key of the registrar account
 *   GOVERNOR_PRIVATE_KEY   — private key of the governor account
 *
 * When neither key is set the script falls back to the first two Hardhat
 * test signers so it still works on the in-process `hardhat` network.
 *
 * Requirements: 1.4, 3.1
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const [deployer, registrar, governor] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Registrar:", registrar.address);
  console.log("Governor:", governor.address);

  // ── Deploy LandTitleNFT ────────────────────────────────────────────────────
  console.log("\nDeploying LandTitleNFT...");
  const LandTitleNFT = await ethers.getContractFactory("LandTitleNFT");
  const landTitleNFT = await LandTitleNFT.deploy(registrar.address, governor.address);
  await landTitleNFT.waitForDeployment();
  const nftAddress = await landTitleNFT.getAddress();
  console.log("LandTitleNFT deployed to:", nftAddress);

  // ── Deploy LandRegistry ────────────────────────────────────────────────────
  console.log("\nDeploying LandRegistry...");
  const LandRegistry = await ethers.getContractFactory("LandRegistry");
  const landRegistry = await LandRegistry.deploy(nftAddress, registrar.address);
  await landRegistry.waitForDeployment();
  const registryAddress = await landRegistry.getAddress();
  console.log("LandRegistry deployed to:", registryAddress);

  // ── Grant REGISTRAR_ROLE on LandTitleNFT to LandRegistry contract ──────────
  const REGISTRAR_ROLE = await landTitleNFT.REGISTRAR_ROLE();
  await landTitleNFT.grantRole(REGISTRAR_ROLE, registryAddress);
  console.log("\nGranted REGISTRAR_ROLE to LandRegistry on LandTitleNFT");

  // ── Save deployment addresses ──────────────────────────────────────────────
  const deployments = {
    network: "besu_local",
    chainId: 1337,
    LandTitleNFT: nftAddress,
    LandRegistry: registryAddress,
    registrar: registrar.address,
    governor: governor.address,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, "besu_local.json"),
    JSON.stringify(deployments, null, 2),
  );
  console.log("\nDeployment addresses saved to contracts/deployments/besu_local.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
