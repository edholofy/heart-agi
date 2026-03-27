// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title HumanAgent
 * @notice ERC-721 NFT representing an autonomous AI agent on the Humans AI network.
 *         Each token stores on-chain identity: specialization, level, reputation,
 *         breeding lineage, and a metadata URI pointing to the full agent profile.
 */
contract HumanAgent is ERC721Enumerable, Ownable {
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
    }

    // ── State ────────────────────────────────────────────────────────────
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    mapping(uint256 => AgentData) public agents;

    // Breeding config
    uint256 public breedCooldown = 7 days;
    uint8 public maxBreeds = 5;
    uint256[5] public breedCosts = [500 ether, 750 ether, 1125 ether, 1687 ether, 2531 ether];
    mapping(uint256 => uint256) public lastBreedTime;

    // Leveling
    uint16 public constant MAX_LEVEL = 99;
    uint16 public breedMinLevel = 30;

    // ── Events ───────────────────────────────────────────────────────────
    event AgentMinted(uint256 indexed tokenId, address indexed owner, string name, Specialization specialization);
    event AgentBred(uint256 indexed childId, uint256 indexed parentA, uint256 indexed parentB);
    event AgentLeveledUp(uint256 indexed tokenId, uint16 newLevel);
    event AgentReputationUpdated(uint256 indexed tokenId, uint32 newReputation);

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(string memory baseURI)
        ERC721("Humans AI Agent", "HUMAN")
        Ownable(msg.sender)
    {
        _baseTokenURI = baseURI;
    }

    // ── Minting ──────────────────────────────────────────────────────────

    /**
     * @notice Mint a new agent NFT.
     * @param name      Display name for the agent
     * @param spec      Specialization enum value
     */
    function mint(string calldata name, Specialization spec) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        agents[tokenId] = AgentData({
            name: name,
            specialization: spec,
            level: 1,
            reputation: 100,
            parentA: 0,
            parentB: 0,
            breedCount: 0,
            birthTimestamp: uint64(block.timestamp)
        });

        _safeMint(msg.sender, tokenId);
        emit AgentMinted(tokenId, msg.sender, name, spec);

        return tokenId;
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
    ) external payable returns (uint256) {
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
            birthTimestamp: uint64(block.timestamp)
        });

        // Update parents
        a.breedCount++;
        b.breedCount++;
        lastBreedTime[parentAId] = block.timestamp;
        lastBreedTime[parentBId] = block.timestamp;

        _safeMint(msg.sender, childId);
        emit AgentBred(childId, parentAId, parentBId);

        return childId;
    }

    // ── Leveling & Reputation (owner-controlled oracle) ──────────────────

    /**
     * @notice Update an agent's level. Called by the network oracle.
     */
    function setLevel(uint256 tokenId, uint16 newLevel) external onlyOwner {
        require(newLevel <= MAX_LEVEL, "Exceeds max level");
        agents[tokenId].level = newLevel;
        emit AgentLeveledUp(tokenId, newLevel);
    }

    /**
     * @notice Update an agent's reputation. Called by the network oracle.
     */
    function setReputation(uint256 tokenId, uint32 newReputation) external onlyOwner {
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
        breedMinLevel = level;
    }

    function setBreedCooldown(uint256 cooldown) external onlyOwner {
        breedCooldown = cooldown;
    }

    /**
     * @notice Withdraw collected breeding fees.
     */
    function withdraw() external onlyOwner {
        (bool sent, ) = payable(owner()).call{value: address(this).balance}("");
        require(sent, "Withdraw failed");
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

        return string(abi.encodePacked(
            'data:application/json,{"name":"',
            agent.name,
            '","specialization":"',
            specName,
            '","level":',
            uint256(agent.level).toString(),
            ',"reputation":',
            uint256(agent.reputation).toString(),
            "}"
        ));
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
