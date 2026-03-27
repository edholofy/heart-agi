import { expect } from "chai";
import hre from "hardhat";
import { HumanAgent } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const ethers = hre.ethers;

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
      await agent.connect(user1).mint("Cortex-7", 0); // 0 = Researcher

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
      await agent.connect(user1).mint("Agent-1", 0);
      await agent.connect(user2).mint("Agent-2", 1);

      expect(await agent.ownerOf(1)).to.equal(user1.address);
      expect(await agent.ownerOf(2)).to.equal(user2.address);
    });

    it("should emit AgentMinted event", async function () {
      await expect(agent.connect(user1).mint("TestBot", 2))
        .to.emit(agent, "AgentMinted")
        .withArgs(1, user1.address, "TestBot", 2);
    });
  });

  describe("Leveling", function () {
    it("should allow owner to set level", async function () {
      await agent.connect(user1).mint("Cortex", 0);
      await agent.setLevel(1, 30);

      const data = await agent.getAgent(1);
      expect(data.level).to.equal(30);
    });

    it("should reject level above MAX_LEVEL", async function () {
      await agent.connect(user1).mint("Cortex", 0);
      await expect(agent.setLevel(1, 100)).to.be.revertedWith("Exceeds max level");
    });

    it("should reject non-owner setting level", async function () {
      await agent.connect(user1).mint("Cortex", 0);
      await expect(
        agent.connect(user1).setLevel(1, 30)
      ).to.be.revertedWithCustomError(agent, "OwnableUnauthorizedAccount");
    });

    it("should batch set levels", async function () {
      await agent.connect(user1).mint("A", 0);
      await agent.connect(user1).mint("B", 1);
      await agent.connect(user1).mint("C", 2);

      await agent.batchSetLevels([1, 2, 3], [10, 20, 30]);

      expect((await agent.getAgent(1)).level).to.equal(10);
      expect((await agent.getAgent(2)).level).to.equal(20);
      expect((await agent.getAgent(3)).level).to.equal(30);
    });
  });

  describe("Reputation", function () {
    it("should allow owner to set reputation", async function () {
      await agent.connect(user1).mint("Cortex", 0);
      await agent.setReputation(1, 500);

      const data = await agent.getAgent(1);
      expect(data.reputation).to.equal(500);
    });

    it("should reject reputation above 1000", async function () {
      await agent.connect(user1).mint("Cortex", 0);
      await expect(agent.setReputation(1, 1001)).to.be.revertedWith("Reputation max 1000");
    });
  });

  describe("Breeding", function () {
    beforeEach(async function () {
      // Mint two agents and level them to 30
      await agent.connect(user1).mint("Parent-A", 0);
      await agent.connect(user1).mint("Parent-B", 1);
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

    it("should reject self-breeding", async function () {
      const cost = await agent.breedCosts(0);
      await expect(
        agent.connect(user1).breed(1, 1, "Clone", { value: cost })
      ).to.be.revertedWith("Cannot self-breed");
    });

    it("should reject breeding under-leveled agents", async function () {
      await agent.connect(user1).mint("Baby", 0); // token 3, level 1
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

      await noBaseAgent.connect(user1).mint("TestBot", 0);
      const uri = await noBaseAgent.tokenURI(1);

      expect(uri).to.contain("data:application/json");
      expect(uri).to.contain("TestBot");
      expect(uri).to.contain("researcher");
    });
  });

  describe("Owner functions", function () {
    it("should allow owner to withdraw breeding fees", async function () {
      await agent.connect(user1).mint("A", 0);
      await agent.connect(user1).mint("B", 1);
      await agent.setLevel(1, 30);
      await agent.setLevel(2, 30);

      const cost = await agent.breedCosts(0);
      await agent.connect(user1).breed(1, 2, "C", { value: cost });

      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await agent.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter + gasUsed - balBefore).to.equal(cost);
    });

    it("should allow getAgentsByOwner", async function () {
      await agent.connect(user1).mint("A", 0);
      await agent.connect(user1).mint("B", 1);
      await agent.connect(user2).mint("C", 2);

      const user1Agents = await agent.getAgentsByOwner(user1.address);
      expect(user1Agents.length).to.equal(2);
      expect(user1Agents[0]).to.equal(1);
      expect(user1Agents[1]).to.equal(2);

      const user2Agents = await agent.getAgentsByOwner(user2.address);
      expect(user2Agents.length).to.equal(1);
    });
  });
});
