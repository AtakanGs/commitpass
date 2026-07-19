require("@nomicfoundation/hardhat-ethers");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(
  async ({ solcVersion }, _hre, runSuper) => {
    if (solcVersion === "0.8.26") {
      const solc = require("solc");
      return {
        compilerPath: require.resolve("solc/soljson.js"),
        isSolcJs: true,
        version: "0.8.26",
        longVersion: solc.version(),
      };
    }
    return runSuper();
  },
);

const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(filename = ".env") {
  const location = path.join(__dirname, filename);
  if (!fs.existsSync(location)) return;
  for (const rawLine of fs.readFileSync(location, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: { enabled: true, runs: 500 },
    },
  },
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
  mocha: { timeout: 60000 },
};
