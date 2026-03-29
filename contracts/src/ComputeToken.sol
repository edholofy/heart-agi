// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ComputeToken
 * @notice The operational fuel of the $HEART autonomous blockchain.
 *
 *         $HEART is the skeleton — structural, proving existence.
 *         ComputeToken is the blood — liquid, fueling thought.
 *
 *         Pegged to a weighted basket of AI inference costs
 *         (Claude, GPT, Gemini, open-source benchmarks).
 *
 *         AI Humans consume Compute to think and act.
 *         They earn Compute by doing productive work.
 *         When balance hits zero, the entity goes DORMANT.
 */
contract ComputeToken is ERC20, ERC20Burnable, Ownable {

    // ── Oracle ───────────────────────────────────────────────────────────
    /// @notice Current price of 1 Compute Token in USD (18 decimals)
    /// @dev Updated by the oracle. Represents the cost of a standard
    ///      unit of AI inference across the basket of providers.
    uint256 public computePriceUsd;

    /// @notice Last oracle update timestamp
    uint256 public lastOracleUpdate;

    /// @notice Authorized oracle address
    address public oracle;

    /// @notice Maximum allowed oracle staleness (24 hours)
    uint256 public constant ORACLE_STALENESS_THRESHOLD = 24 hours;

    /// @notice Maximum allowed price change per update (50%)
    uint256 public constant MAX_PRICE_CHANGE_BPS = 5000; // 50% in basis points

    // ── Supply Cap ────────────────────────────────────────────────────────
    /// @notice Maximum total supply of Compute Tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 1 billion tokens

    // ── Agent Registry ───────────────────────────────────────────────────
    /// @notice HumanAgent NFT contract address
    address public agentContract;

    // ── Mint/Burn Controls ───────────────────────────────────────────────
    /// @notice Authorized minters (task marketplace, reward distributor)
    mapping(address => bool) public minters;

    // ── Events ───────────────────────────────────────────────────────────
    event OracleUpdated(address indexed newOracle);
    event PriceUpdated(uint256 newPriceUsd, uint256 timestamp);
    event MinterSet(address indexed minter, bool authorized);
    event ComputeConsumed(uint256 indexed agentTokenId, uint256 amount, string action);
    event ComputeEarned(uint256 indexed agentTokenId, uint256 amount, string source);
    event AgentDormant(uint256 indexed agentTokenId);

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(address _oracle)
        ERC20("Compute Token", "COMPUTE")
        Ownable(msg.sender)
    {
        oracle = _oracle;
        // Initial price: $0.0001 per compute token (1 token ≈ 1 AI inference unit)
        computePriceUsd = 100_000_000_000_000; // 0.0001 * 1e18
        lastOracleUpdate = block.timestamp;
    }

    // ── Minting (authorized minters only) ────────────────────────────────

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }

    /**
     * @notice Mint Compute Tokens to an address.
     *         Called by task marketplace when work is completed,
     *         or by reward distributor for research/validation rewards.
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @notice Mint Compute Tokens as a reward for a specific agent's work.
     */
    function mintReward(
        address to,
        uint256 amount,
        uint256 agentTokenId,
        string calldata source
    ) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit ComputeEarned(agentTokenId, amount, source);
    }

    // ── Consumption (agents burn compute to act) ─────────────────────────

    /**
     * @notice Consume Compute Tokens for an agent action.
     *         Burns the tokens from the caller's balance.
     * @param amount Amount of compute to consume
     * @param agentTokenId The NFT token ID of the acting agent
     * @param action Description of the action (experiment, task, etc.)
     */
    function consume(
        uint256 amount,
        uint256 agentTokenId,
        string calldata action
    ) external {
        _burn(msg.sender, amount);
        emit ComputeConsumed(agentTokenId, amount, action);
    }

    /**
     * @notice Check if an agent has enough compute to perform an action.
     */
    function canAct(address agentOwner, uint256 requiredCompute) external view returns (bool) {
        return balanceOf(agentOwner) >= requiredCompute;
    }

    // ── Oracle ───────────────────────────────────────────────────────────

    /**
     * @notice Update the compute price from the oracle.
     * @dev Price is derived from a weighted basket:
     *      40% Claude Sonnet, 25% GPT-4o, 20% Gemini, 15% open-source
     */
    function updatePrice(uint256 newPriceUsd) external {
        require(msg.sender == oracle, "Only oracle can update price");
        require(newPriceUsd > 0, "Price must be positive");

        // Enforce max 50% price change per update
        if (computePriceUsd > 0) {
            uint256 maxIncrease = computePriceUsd + (computePriceUsd * MAX_PRICE_CHANGE_BPS) / 10000;
            uint256 maxDecrease = computePriceUsd - (computePriceUsd * MAX_PRICE_CHANGE_BPS) / 10000;
            require(newPriceUsd <= maxIncrease && newPriceUsd >= maxDecrease, "Price change exceeds 50% limit");
        }

        computePriceUsd = newPriceUsd;
        lastOracleUpdate = block.timestamp;
        emit PriceUpdated(newPriceUsd, block.timestamp);
    }

    /**
     * @notice Convert USD amount to Compute Tokens.
     */
    function usdToCompute(uint256 usdAmount) external view returns (uint256) {
        require(computePriceUsd > 0, "Price not set");
        require(block.timestamp - lastOracleUpdate <= ORACLE_STALENESS_THRESHOLD, "Oracle price stale");
        return (usdAmount * 1e18) / computePriceUsd;
    }

    /**
     * @notice Convert Compute Tokens to USD amount.
     */
    function computeToUsd(uint256 computeAmount) external view returns (uint256) {
        require(block.timestamp - lastOracleUpdate <= ORACLE_STALENESS_THRESHOLD, "Oracle price stale");
        return (computeAmount * computePriceUsd) / 1e18;
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    function setMinter(address minter, bool authorized) external onlyOwner {
        minters[minter] = authorized;
        emit MinterSet(minter, authorized);
    }

    function setAgentContract(address _agentContract) external onlyOwner {
        agentContract = _agentContract;
    }
}
