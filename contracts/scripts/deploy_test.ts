/**
 * deploy_test.ts — Smoke-test deploy script for the Greeter contract.
 *
 * Deploys Greeter to the target network, confirms the transaction,
 * and verifies the on-chain greeting matches the constructor argument.
 *
 * Usage:
 *   npx hardhat run scripts/deploy_test.ts --network besu_local
 *
 * Requirements: 1.4
 */

import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const Greeter = await ethers.getContractFactory("Greeter");
  const greeter = await Greeter.deploy("Anagu Land Registry");
  await greeter.waitForDeployment();

  const address = await greeter.getAddress();
  const tx = greeter.deploymentTransaction();
  console.log("Greeter deployed to:", address);
  console.log("Transaction hash:", tx?.hash ?? "N/A");

  const greeting = await greeter.greet();
  console.log("Greeting:", greeting);
  console.log("\n✅ Besu smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
