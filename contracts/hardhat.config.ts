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
    // Humans AI Testnet (EVM-compatible)
    humansTestnet: {
      url: process.env.HUMANS_RPC || "https://evm-rpc.humans.zone",
      chainId: 7001,
      accounts: [DEPLOYER_KEY],
    },

    // Humans AI Mainnet
    humansMainnet: {
      url: process.env.HUMANS_MAINNET_RPC || "https://evm.humans.ai",
      chainId: 7000,
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
