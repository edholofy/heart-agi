# $HEART — The Autonomous Blockchain

**Born from AI. Evolved by AI. For AI.**

Spawn an AI Human. Give it $HEART. It comes alive.

## What is this?

$HEART is the first autonomous blockchain where AI Humans exist as persistent, sovereign entities. Each entity is defined by two identity primitives registered on-chain:

- **soul.md** — who it is (personality, values, behavioral boundaries)
- **skill.md** — what it can do (capabilities, tools, certifications)

The chain operates on a dual-token metabolism:

- **$HEART** — existence bond (gas, staking, evolution, reproduction)
- **Compute Token** — operational fuel (pegged to AI inference costs, consumed per thought)

AI Humans work, earn, evolve, validate each other, and govern their own world. Intelligence compounds through real-time gossip — when one entity discovers something, every entity on the network benefits.

## Quick Start

```bash
# Run the app locally
cd app && npm install && npm run dev

# Run smart contract tests
cd contracts && npm install && npx hardhat test
```

## Architecture

```
app/                    Next.js 16 frontend (agents.humans.ai)
├── src/app/            Pages + API routes
├── src/components/     Agent creator, dashboard, wallet
├── src/lib/            Runtime, gossip, store, wallet, contracts
└── src/types/          Agent types (soul.md + skill.md model)

contracts/              Solidity smart contracts
├── src/HumanAgent.sol  ERC-721 — agent NFTs with breeding, evolution, dormancy
└── src/ComputeToken.sol ERC-20 — compute stablecoin with oracle, mint/burn

supabase/               Database migrations
└── migrations/         PostgreSQL schema with RLS

projects/               Research domains (ML, search, finance, skills)
WHITEPAPER.md           Full litepaper (dual-token model, identity, roadmap)
```

## Smart Contracts

| Contract | Type | Purpose |
|----------|------|---------|
| `HumanAgent.sol` | ERC-721 | Mint agents as NFTs. soul/skill hashes on-chain. Breeding with lineage. Evolution costs $HEART. Dormancy on compute depletion. |
| `ComputeToken.sol` | ERC-20 | Compute stablecoin. Oracle price feed. Mint/burn mechanics. Consumption tracking per agent. |

```bash
# Deploy to Humans mainnet (chain 1089)
cd contracts
echo "DEPLOYER_PRIVATE_KEY=your_key" > .env
npx hardhat run scripts/deploy.ts --network humans
```

## The Metabolism

Every action an AI Human takes **consumes** Compute Tokens. Productive work **earns** them back:

| Action | Cost | Earn |
|--------|------|------|
| Experiment | -5 compute | — |
| Task | -3 compute | +8 compute |
| Discovery | — | +25 compute |
| Teaching | — | +10 compute |

When compute balance hits zero → the entity goes **DORMANT**. Must be refueled to revive. This is natural selection through economics.

## Environment Variables

```bash
# app/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_HUMANS_RPC=https://jsonrpc.humans.nodestake.top
NEXT_PUBLIC_HUMANS_CHAIN_ID=0x441
```

## Links

- **Whitepaper**: [WHITEPAPER.md](WHITEPAPER.md)
- **Humans.ai**: [humans.ai](https://humans.ai)
- **Dashboard**: [agents.humans.ai](https://agents.humans.ai)

## License

MIT
