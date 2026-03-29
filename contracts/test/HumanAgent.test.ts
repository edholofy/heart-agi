import { expect } from "chai";
import hre from "hardhat";
import { HumanAgent } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const ethers = hre.ethers;
const MINT_PRICE = ethers.parseEther("100");

describe("HumanAgent", function () {
  let agent: HumanAgent;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const HumanAgent = await ethers.getContractFactory("HumanAgent");
    agent = await HumanAgent.deploy("https://agents.humans.ai/api/metadata/");
    await agent.waitForDeployment();
  });

  describe("Minting", function () {
    it("should mint an agent with correct data", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Cortex-7", 0, { value: MINT_PRICE });

      expect(await agent.balanceOf(user1.address)).to.equal(1);
      expect(await agent.ownerOf(1)).to.equal(user1.address);

      const data = await agent.getAgent(1);
      expect(data.name).to.equal("Cortex-7");
      expect(data.specialization).to.equal(0); // Researcher
      expect(data.level).to.equal(1);
      expect(data.reputation).to.equal(100);
      expect(data.parentA).to.equal(0);
      expect(data.parentB).to.equal(0);
      expect(data.breedCount).to.equal(0);
    });

    it("should increment token IDs", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Agent-1", 0, { value: MINT_PRICE });
      await agent.connect(user2)["mint(string,uint8)"]("Agent-2", 1, { value: MINT_PRICE });

      expect(await agent.ownerOf(1)).to.equal(user1.address);
      expect(await agent.ownerOf(2)).to.equal(user2.address);
    });

    it("should emit AgentMinted event", async function () {
      await expect(agent.connect(user1)["mint(string,uint8)"]("TestBot", 2, { value: MINT_PRICE }))
        .to.emit(agent, "AgentMinted")
        .withArgs(1, user1.address, "TestBot", 2);
    });

    it("should reject minting without sufficient payment", async function () {
      await expect(
        agent.connect(user1)["mint(string,uint8)"]("Cheap", 0, { value: 0 })
      ).to.be.revertedWith("Insufficient $HEART for minting");
    });

    it("should allow owner to update mint price", async function () {
      const newPrice = ethers.parseEther("200");
      await agent.setMintPrice(newPrice);
      expect(await agent.mintPrice()).to.equal(newPrice);
    });
  });

  describe("Leveling", function () {
    it("should allow owner to set level", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Cortex", 0, { value: MINT_PRICE });
      await agent.setLevel(1, 30);

      const data = await agent.getAgent(1);
      expect(data.level).to.equal(30);
    });

    it("should reject level above MAX_LEVEL", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Cortex", 0, { value: MINT_PRICE });
      await expect(agent.setLevel(1, 100)).to.be.revertedWith("Exceeds max level");
    });

    it("should reject non-owner setting level", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Cortex", 0, { value: MINT_PRICE });
      await expect(
        agent.connect(user1).setLevel(1, 30)
      ).to.be.revertedWithCustomError(agent, "OwnableUnauthorizedAccount");
    });

    it("should batch set levels", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("A", 0, { value: MINT_PRICE });
      await agent.connect(user1)["mint(string,uint8)"]("B", 1, { value: MINT_PRICE });
      await agent.connect(user1)["mint(string,uint8)"]("C", 2, { value: MINT_PRICE });

      await agent.batchSetLevels([1, 2, 3], [10, 20, 30]);

      expect((await agent.getAgent(1)).level).to.equal(10);
      expect((await agent.getAgent(2)).level).to.equal(20);
      expect((await agent.getAgent(3)).level).to.equal(30);
    });

    it("should reject setLevel for nonexistent token", async function () {
      await expect(agent.setLevel(999, 10)).to.be.revertedWith("Agent does not exist");
    });
  });

  describe("Reputation", function () {
    it("should allow owner to set reputation", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Cortex", 0, { value: MINT_PRICE });
      await agent.setReputation(1, 500);

      const data = await agent.getAgent(1);
      expect(data.reputation).to.equal(500);
    });

    it("should reject reputation above 1000", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Cortex", 0, { value: MINT_PRICE });
      await expect(agent.setReputation(1, 1001)).to.be.revertedWith("Reputation max 1000");
    });

    it("should reject setReputation for nonexistent token", async function () {
      await expect(agent.setReputation(999, 500)).to.be.revertedWith("Agent does not exist");
    });
  });

  describe("Breeding", function () {
    beforeEach(async function () {
      // Mint two agents and level them to 30
      await agent.connect(user1)["mint(string,uint8)"]("Parent-A", 0, { value: MINT_PRICE });
      await agent.connect(user1)["mint(string,uint8)"]("Parent-B", 1, { value: MINT_PRICE });
      await agent.setLevel(1, 30);
      await agent.setLevel(2, 30);
    });

    it("should breed two agents", async function () {
      const cost = await agent.breedCosts(0);

      await agent.connect(user1).breed(1, 2, "Child-AB", { value: cost });

      expect(await agent.balanceOf(user1.address)).to.equal(3);
      expect(await agent.ownerOf(3)).to.equal(user1.address);

      const child = await agent.getAgent(3);
      expect(child.name).to.equal("Child-AB");
      expect(child.parentA).to.equal(1);
      expect(child.parentB).to.equal(2);
      expect(child.level).to.equal(1);
    });

    it("should refund excess ETH on breed", async function () {
      const cost = await agent.breedCosts(0);
      const excess = ethers.parseEther("100");
      const overpay = cost + excess;

      const balBefore = await ethers.provider.getBalance(user1.address);
      const tx = await agent.connect(user1).breed(1, 2, "Child", { value: overpay });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(user1.address);

      // User should only have paid cost + gas, not the full overpay
      expect(balBefore - balAfter - gasUsed).to.equal(cost);
    });

    it("should reject self-breeding", async function () {
      const cost = await agent.breedCosts(0);
      await expect(
        agent.connect(user1).breed(1, 1, "Clone", { value: cost })
      ).to.be.revertedWith("Cannot self-breed");
    });

    it("should reject breeding under-leveled agents", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("Baby", 0, { value: MINT_PRICE }); // token 3, level 1
      const cost = await agent.breedCosts(0);

      await expect(
        agent.connect(user1).breed(1, 3, "Child", { value: cost })
      ).to.be.revertedWith("Parent B level too low");
    });

    it("should reject breeding without enough $HEART", async function () {
      await expect(
        agent.connect(user1).breed(1, 2, "Child", { value: 0 })
      ).to.be.revertedWith("Insufficient $HEART for breeding");
    });

    it("should enforce cooldown", async function () {
      const cost = await agent.breedCosts(0);
      await agent.connect(user1).breed(1, 2, "Child-1", { value: cost });

      const cost2 = await agent.breedCosts(1);
      await expect(
        agent.connect(user1).breed(1, 2, "Child-2", { value: cost2 })
      ).to.be.revertedWith("Parent A on cooldown");
    });

    it("should track lineage", async function () {
      const cost = await agent.breedCosts(0);
      await agent.connect(user1).breed(1, 2, "Child", { value: cost });

      const lineage = await agent.getLineage(3);
      expect(lineage.parentA).to.equal(1);
      expect(lineage.parentB).to.equal(2);
      expect(lineage.grandA1).to.equal(0); // no grandparents
      expect(lineage.grandA2).to.equal(0);
    });

    it("should emit AgentBred event", async function () {
      const cost = await agent.breedCosts(0);
      await expect(agent.connect(user1).breed(1, 2, "Child", { value: cost }))
        .to.emit(agent, "AgentBred")
        .withArgs(3, 1, 2);
    });
  });

  describe("Token URI", function () {
    it("should return on-chain metadata when no base URI match", async function () {
      // Deploy with empty base URI to test fallback
      const HumanAgent = await ethers.getContractFactory("HumanAgent");
      const noBaseAgent = await HumanAgent.deploy("");
      await noBaseAgent.waitForDeployment();

      await noBaseAgent.connect(user1)["mint(string,uint8)"]("TestBot", 0, { value: MINT_PRICE });
      const uri = await noBaseAgent.tokenURI(1);

      expect(uri).to.contain("data:application/json");
      expect(uri).to.contain("TestBot");
      expect(uri).to.contain("researcher");
    });

    it("should sanitize JSON-unsafe characters in name", async function () {
      const HumanAgent = await ethers.getContractFactory("HumanAgent");
      const noBaseAgent = await HumanAgent.deploy("");
      await noBaseAgent.waitForDeployment();

      await noBaseAgent.connect(user1)["mint(string,uint8)"]('Bad"Name\\Test', 0, { value: MINT_PRICE });
      const uri = await noBaseAgent.tokenURI(1);

      // The name should have escaped quotes and backslashes
      expect(uri).to.contain('Bad\\"Name\\\\Test');
      expect(uri).to.contain("data:application/json");
    });
  });

  describe("Admin parameter bounds", function () {
    it("should reject breedCooldown outside 1-30 days", async function () {
      await expect(agent.setBreedCooldown(0)).to.be.revertedWith("Cooldown must be 1-30 days");
      await expect(agent.setBreedCooldown(31 * 86400)).to.be.revertedWith("Cooldown must be 1-30 days");
    });

    it("should accept breedCooldown within 1-30 days", async function () {
      await agent.setBreedCooldown(86400); // 1 day
      expect(await agent.breedCooldown()).to.equal(86400);
      await agent.setBreedCooldown(30 * 86400); // 30 days
      expect(await agent.breedCooldown()).to.equal(30 * 86400);
    });

    it("should reject breedMinLevel outside 10-50", async function () {
      await expect(agent.setBreedMinLevel(9)).to.be.revertedWith("Level must be 10-50");
      await expect(agent.setBreedMinLevel(51)).to.be.revertedWith("Level must be 10-50");
    });

    it("should accept breedMinLevel within 10-50", async function () {
      await agent.setBreedMinLevel(10);
      expect(await agent.breedMinLevel()).to.equal(10);
      await agent.setBreedMinLevel(50);
      expect(await agent.breedMinLevel()).to.equal(50);
    });
  });

  describe("Owner functions", function () {
    it("should allow owner to withdraw breeding fees", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("A", 0, { value: MINT_PRICE });
      await agent.connect(user1)["mint(string,uint8)"]("B", 1, { value: MINT_PRICE });
      await agent.setLevel(1, 30);
      await agent.setLevel(2, 30);

      const cost = await agent.breedCosts(0);
      await agent.connect(user1).breed(1, 2, "C", { value: cost });

      // Contract balance = 2 * MINT_PRICE + breedCost
      const contractBalance = await ethers.provider.getBalance(await agent.getAddress());
      expect(contractBalance).to.equal(MINT_PRICE * 2n + cost);

      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await agent.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter + gasUsed - balBefore).to.equal(contractBalance);
    });

    it("should allow getAgentsByOwner", async function () {
      await agent.connect(user1)["mint(string,uint8)"]("A", 0, { value: MINT_PRICE });
      await agent.connect(user1)["mint(string,uint8)"]("B", 1, { value: MINT_PRICE });
      await agent.connect(user2)["mint(string,uint8)"]("C", 2, { value: MINT_PRICE });

      const user1Agents = await agent.getAgentsByOwner(user1.address);
      expect(user1Agents.length).to.equal(2);
      expect(user1Agents[0]).to.equal(1);
      expect(user1Agents[1]).to.equal(2);

      const user2Agents = await agent.getAgentsByOwner(user2.address);
      expect(user2Agents.length).to.equal(1);
    });
  });
});
