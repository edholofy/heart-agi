import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },

  networks: {
    // Humans AI Mainnet
    humans: {
      url: process.env.HUMANS_RPC || "https://jsonrpc.humans.nodestake.top",
      chainId: 1089,
      accounts: [DEPLOYER_KEY],
    },

    // Backup RPC
    humansBackup: {
      url: "https://humans-mainnet-evm.itrocket.net",
      chainId: 1089,
      accounts: [DEPLOYER_KEY],
    },

    // Local hardhat for testing
    hardhat: {
      chainId: 31337,
    },
  },

  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
