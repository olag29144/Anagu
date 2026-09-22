import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

// Load env vars from workspace root .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const REGISTRAR_PRIVATE_KEY = process.env["REGISTRAR_PRIVATE_KEY"] ?? "";
const GOVERNOR_PRIVATE_KEY = process.env["GOVERNOR_PRIVATE_KEY"] ?? "";

// Provide a dummy account list when keys are not set (compile-only / CI environments)
const besuAccounts =
  REGISTRAR_PRIVATE_KEY && GOVERNOR_PRIVATE_KEY
    ? [REGISTRAR_PRIVATE_KEY, GOVERNOR_PRIVATE_KEY]
    : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    besu_local: {
      url: "http://localhost:8545",
      chainId: 1337,
      accounts: besuAccounts,
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
