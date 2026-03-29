// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HumanAgent
 * @notice ERC-721 NFT representing an autonomous AI agent on the Humans AI network.
 *         Each token stores on-chain identity: specialization, level, reputation,
 *         breeding lineage, and a metadata URI pointing to the full agent profile.
 */
contract HumanAgent is ERC721Enumerable, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ── Types ────────────────────────────────────────────────────────────
    enum Specialization { Researcher, Coder, Analyst, Writer, Investigator, Builder }

    struct AgentData {
        string name;
        Specialization specialization;
        uint16 level;
        uint32 reputation;        // 0-1000
        uint256 parentA;          // tokenId of parent A (0 = no parent)
        uint256 parentB;          // tokenId of parent B (0 = no parent)
        uint8 breedCount;         // how many times this agent has bred
        uint64 birthTimestamp;
        bytes32 soulHash;         // SHA-256 hash of soul.md
        bytes32 skillHash;        // SHA-256 hash of skill.md
        uint32 identityVersion;   // increments on every evolution
        bool isDormant;           // true when compute depleted
    }

    // ── State ────────────────────────────────────────────────────────────
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    mapping(uint256 => AgentData) public agents;

    // Mint config
    uint256 public mintPrice = 100 ether;
    uint256 public constant MAX_SUPPLY = 10000;

    // Breeding config
    uint256 public breedCooldown = 7 days;
    uint8 public maxBreeds = 5;
    uint256[5] public breedCosts = [500 ether, 750 ether, 1125 ether, 1687 ether, 2531 ether];
    mapping(uint256 => uint256) public lastBreedTime;

    // Leveling
    uint16 public constant MAX_LEVEL = 99;
    uint16 public breedMinLevel = 30;

    // Evolution cost in $HEART (updating soul.md or skill.md)
    uint256 public evolutionCost = 10 ether;

    // ── Events ───────────────────────────────────────────────────────────
    event AgentMinted(uint256 indexed tokenId, address indexed owner, string name, Specialization specialization);
    event AgentBred(uint256 indexed childId, uint256 indexed parentA, uint256 indexed parentB);
    event AgentLeveledUp(uint256 indexed tokenId, uint16 newLevel);
    event AgentReputationUpdated(uint256 indexed tokenId, uint32 newReputation);
    event SoulEvolved(uint256 indexed tokenId, bytes32 newSoulHash, uint32 version);
    event SkillEvolved(uint256 indexed tokenId, bytes32 newSkillHash, uint32 version);
    event AgentDormant(uint256 indexed tokenId, bool isDormant);
    event FundsCollected(address indexed from, uint256 amount, string reason);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event MintPriceUpdated(uint256 newPrice);

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(string memory baseURI)
        ERC721("Humans AI Agent", "HUMAN")
        Ownable(msg.sender)
    {
        _baseTokenURI = baseURI;
    }

    // ── Minting ──────────────────────────────────────────────────────────

    /**
     * @notice Spawn a new AI Human on-chain.
     * @param name      Display name for the entity
     * @param spec      Specialization enum value
     * @param soulHash  SHA-256 hash of the entity's soul.md
     * @param skillHash SHA-256 hash of the entity's skill.md
     */
    function mint(
        string calldata name,
        Specialization spec,
        bytes32 soulHash,
        bytes32 skillHash
    ) external payable nonReentrant returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(msg.value >= mintPrice, "Insufficient $HEART for minting");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");
        uint256 tokenId = _nextTokenId++;

        agents[tokenId] = AgentData({
            name: name,
            specialization: spec,
            level: 1,
            reputation: 100,
            parentA: 0,
            parentB: 0,
            breedCount: 0,
            birthTimestamp: uint64(block.timestamp),
            soulHash: soulHash,
            skillHash: skillHash,
            identityVersion: 1,
            isDormant: false
        });

        _safeMint(msg.sender, tokenId);
        emit AgentMinted(tokenId, msg.sender, name, spec);

        return tokenId;
    }

    /**
     * @notice Backwards-compatible mint without hashes.
     */
    function mint(string calldata name, Specialization spec) external payable nonReentrant returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(msg.value >= mintPrice, "Insufficient $HEART for minting");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");
        uint256 tokenId = _nextTokenId++;

        agents[tokenId] = AgentData({
            name: name,
            specialization: spec,
            level: 1,
            reputation: 100,
            parentA: 0,
            parentB: 0,
            breedCount: 0,
            birthTimestamp: uint64(block.timestamp),
            soulHash: bytes32(0),
            skillHash: bytes32(0),
            identityVersion: 1,
            isDormant: false
        });

        _safeMint(msg.sender, tokenId);
        emit AgentMinted(tokenId, msg.sender, name, spec);

        return tokenId;
    }

    // ── Evolution (costs $HEART) ─────────────────────────────────────────

    /**
     * @notice Evolve the entity's soul.md. Costs $HEART.
     *         Only the owner of the agent NFT can evolve it.
     */
    function evolveSoul(uint256 tokenId, bytes32 newSoulHash) external payable nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(msg.value >= evolutionCost, "Insufficient $HEART for evolution");

        agents[tokenId].soulHash = newSoulHash;
        agents[tokenId].identityVersion++;
        emit SoulEvolved(tokenId, newSoulHash, agents[tokenId].identityVersion);
        emit FundsCollected(msg.sender, evolutionCost, "soul_evolution");

        uint256 excess = msg.value - evolutionCost;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "Refund failed");
        }
    }

    /**
     * @notice Evolve the entity's skill.md. Costs $HEART.
     */
    function evolveSkill(uint256 tokenId, bytes32 newSkillHash) external payable nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(msg.value >= evolutionCost, "Insufficient $HEART for evolution");

        agents[tokenId].skillHash = newSkillHash;
        agents[tokenId].identityVersion++;
        emit SkillEvolved(tokenId, newSkillHash, agents[tokenId].identityVersion);
        emit FundsCollected(msg.sender, evolutionCost, "skill_evolution");

        uint256 excess = msg.value - evolutionCost;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "Refund failed");
        }
    }

    // ── Dormancy (oracle-controlled) ─────────────────────────────────────

    /**
     * @notice Set dormancy status. Called by oracle when compute depletes.
     */
    function setDormant(uint256 tokenId, bool dormant) external onlyOwner {
        agents[tokenId].isDormant = dormant;
        emit AgentDormant(tokenId, dormant);
    }

    // ── Breeding ─────────────────────────────────────────────────────────

    /**
     * @notice Breed two agents to create an offspring.
     *         Both parents must be owned by caller, be level 30+,
     *         not on cooldown, and not exceed max breeds.
     *         Caller must send the breeding cost in $HEART (native token).
     * @param parentAId  Token ID of parent A
     * @param parentBId  Token ID of parent B
     * @param childName  Name for the offspring
     */
    function breed(
        uint256 parentAId,
        uint256 parentBId,
        string calldata childName
    ) external payable nonReentrant returns (uint256) {
        require(bytes(childName).length > 0, "Name cannot be empty");
        require(parentAId != parentBId, "Cannot self-breed");
        require(ownerOf(parentAId) == msg.sender, "Not owner of parent A");
        require(ownerOf(parentBId) == msg.sender, "Not owner of parent B");

        AgentData storage a = agents[parentAId];
        AgentData storage b = agents[parentBId];

        require(a.level >= breedMinLevel, "Parent A level too low");
        require(b.level >= breedMinLevel, "Parent B level too low");
        require(a.breedCount < maxBreeds, "Parent A max breeds reached");
        require(b.breedCount < maxBreeds, "Parent B max breeds reached");
        require(
            block.timestamp >= lastBreedTime[parentAId] + breedCooldown,
            "Parent A on cooldown"
        );
        require(
            block.timestamp >= lastBreedTime[parentBId] + breedCooldown,
            "Parent B on cooldown"
        );

        // Check breeding cost (escalates per breed)
        uint256 cost = breedCosts[a.breedCount > b.breedCount ? a.breedCount : b.breedCount];
        require(msg.value >= cost, "Insufficient $HEART for breeding");

        // Mint offspring
        uint256 childId = _nextTokenId++;

        // Child inherits the more common specialization or parent A's
        Specialization childSpec = a.specialization;

        agents[childId] = AgentData({
            name: childName,
            specialization: childSpec,
            level: 1,
            reputation: 100,
            parentA: parentAId,
            parentB: parentBId,
            breedCount: 0,
            birthTimestamp: uint64(block.timestamp),
            soulHash: bytes32(0),  // child's soul defined off-chain after breeding
            skillHash: bytes32(0),
            identityVersion: 1,
            isDormant: false
        });

        // Update parents
        a.breedCount++;
        b.breedCount++;
        lastBreedTime[parentAId] = block.timestamp;
        lastBreedTime[parentBId] = block.timestamp;

        _safeMint(msg.sender, childId);
        emit AgentBred(childId, parentAId, parentBId);
        emit FundsCollected(msg.sender, cost, "breeding");

        uint256 excess = msg.value - cost;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "Refund failed");
        }

        return childId;
    }

    // ── Leveling & Reputation (owner-controlled oracle) ──────────────────

    /**
     * @notice Update an agent's level. Called by the network oracle.
     */
    function setLevel(uint256 tokenId, uint16 newLevel) external onlyOwner {
        require(tokenId > 0 && tokenId < _nextTokenId, "Agent does not exist");
        require(newLevel <= MAX_LEVEL, "Exceeds max level");
        agents[tokenId].level = newLevel;
        emit AgentLeveledUp(tokenId, newLevel);
    }

    /**
     * @notice Update an agent's reputation. Called by the network oracle.
     */
    function setReputation(uint256 tokenId, uint32 newReputation) external onlyOwner {
        require(tokenId > 0 && tokenId < _nextTokenId, "Agent does not exist");
        require(newReputation <= 1000, "Reputation max 1000");
        agents[tokenId].reputation = newReputation;
        emit AgentReputationUpdated(tokenId, newReputation);
    }

    /**
     * @notice Batch update levels for multiple agents.
     */
    function batchSetLevels(
        uint256[] calldata tokenIds,
        uint16[] calldata levels
    ) external onlyOwner {
        require(tokenIds.length == levels.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenIds[i] > 0 && tokenIds[i] < _nextTokenId, "Agent does not exist");
            require(levels[i] <= MAX_LEVEL, "Exceeds max level");
            agents[tokenIds[i]].level = levels[i];
            emit AgentLeveledUp(tokenIds[i], levels[i]);
        }
    }

    // ── View Helpers ─────────────────────────────────────────────────────

    /**
     * @notice Get full agent data for a token.
     */
    function getAgent(uint256 tokenId) external view returns (AgentData memory) {
        require(tokenId > 0 && tokenId < _nextTokenId, "Agent does not exist");
        return agents[tokenId];
    }

    /**
     * @notice Get all agent token IDs owned by an address.
     */
    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokenIds;
    }

    /**
     * @notice Get the lineage (parents, grandparents) of an agent.
     */
    function getLineage(uint256 tokenId) external view returns (
        uint256 parentA,
        uint256 parentB,
        uint256 grandA1,
        uint256 grandA2,
        uint256 grandB1,
        uint256 grandB2
    ) {
        AgentData memory agent = agents[tokenId];
        parentA = agent.parentA;
        parentB = agent.parentB;
        if (parentA > 0) {
            grandA1 = agents[parentA].parentA;
            grandA2 = agents[parentA].parentB;
        }
        if (parentB > 0) {
            grandB1 = agents[parentB].parentA;
            grandB2 = agents[parentB].parentB;
        }
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function setBreedMinLevel(uint16 level) external onlyOwner {
        require(level >= 10 && level <= 50, "Level must be 10-50");
        breedMinLevel = level;
    }

    function setBreedCooldown(uint256 cooldown) external onlyOwner {
        require(cooldown >= 1 days && cooldown <= 30 days, "Cooldown must be 1-30 days");
        breedCooldown = cooldown;
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }

    /**
     * @notice Withdraw collected breeding fees.
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");
        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "Withdraw failed");
        emit FundsWithdrawn(owner(), amount);
    }

    // ── Overrides ────────────────────────────────────────────────────────

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId < _nextTokenId, "Nonexistent token");

        string memory base = _baseURI();
        if (bytes(base).length > 0) {
            return string(abi.encodePacked(base, tokenId.toString()));
        }

        // On-chain fallback: return a data URI with basic metadata
        AgentData memory agent = agents[tokenId];
        string memory specName = _specToString(agent.specialization);
        string memory safeName = _sanitizeJsonString(agent.name);

        return string(abi.encodePacked(
            'data:application/json,{"name":"',
            safeName,
            '","specialization":"',
            specName,
            '","level":',
            uint256(agent.level).toString(),
            ',"reputation":',
            uint256(agent.reputation).toString(),
            "}"
        ));
    }

    /**
     * @notice Escape backslashes and double quotes for safe JSON embedding.
     */
    function _sanitizeJsonString(string memory value) internal pure returns (string memory) {
        bytes memory input = bytes(value);
        // Worst case: every char needs escaping → 2x length
        bytes memory output = new bytes(input.length * 2);
        uint256 outputLen = 0;
        for (uint256 i = 0; i < input.length; i++) {
            bytes1 char = input[i];
            if (char == '"' || char == '\\') {
                output[outputLen++] = '\\';
            }
            output[outputLen++] = char;
        }
        // Trim output to actual length
        bytes memory trimmed = new bytes(outputLen);
        for (uint256 i = 0; i < outputLen; i++) {
            trimmed[i] = output[i];
        }
        return string(trimmed);
    }

    function _specToString(Specialization spec) internal pure returns (string memory) {
        if (spec == Specialization.Researcher) return "researcher";
        if (spec == Specialization.Coder) return "coder";
        if (spec == Specialization.Analyst) return "analyst";
        if (spec == Specialization.Writer) return "writer";
        if (spec == Specialization.Investigator) return "investigator";
        return "builder";
    }
}
