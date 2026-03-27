import hre from "hardhat";
const ethers = hre.ethers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HumanAgent with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HEART");

  // Base URI for token metadata — points to our API
  const baseURI = process.env.METADATA_BASE_URI || "https://app-muafjw2w2-eduard-holofyios-projects.vercel.app/api/agents/metadata/";

  const HumanAgent = await ethers.getContractFactory("HumanAgent");
  const agent = await HumanAgent.deploy(baseURI);

  await agent.waitForDeployment();
  const address = await agent.getAddress();

  console.log("HumanAgent deployed to:", address);
  console.log("");
  console.log("Add this to your app/.env.local:");
  console.log(`NEXT_PUBLIC_HUMAN_AGENT_CONTRACT=${address}`);
  console.log("");
  console.log("Verify on explorer:");
  console.log(`https://explorer.nodestake.top/humans/account/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
