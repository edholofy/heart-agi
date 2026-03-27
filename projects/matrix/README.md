# Matrix — Neural Task Intelligence

**Describe what you want to do. Matrix finds the right skill, tool, or agent.**

Matrix is a trained neural retrieval model that searches 100,000+ AI capabilities — skills, tools, agents, and apps — using semantic understanding rather than keyword matching.

## Try It

**Web:** [matrix.humans.ai](https://matrix.humans.ai)

**CLI:**
```bash
humans-ai search matrix "deploy my app to kubernetes with monitoring"
```

**API:**
```bash
curl -X POST https://matrix.humans.ai/api/search \
  -d '{"query": "optimize SQL queries", "top_k": 10}'
```

## Architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   MATRIX     │   │   Users      │   │   Feedback   │   │   Retrain    │   │   Better     │
│   deployed   │──▶│   search     │──▶│   👍 👎       │──▶│   on real    │──▶│   results    │
│   everywhere │   │   tasks      │   │   outcomes   │   │   usage      │   │              │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                                                                                   │
                   compounds: more users → more signal → smarter model             │
                   ╰──────────────────────────────────────────────────────▶ ♻       │
```

## Model

- **Backbone:** Qwen2.5-1.5B (frozen)
- **Retrieval head:** ColBERT 128-dim with distillation from text-embedding-3-small
- **Training:** 189K samples (139K synthetic + 50K hard-negative triplets), 30 epochs on GPU
- **Capabilities indexed:** 100,000+ (21K tools + 43K skills + 1.2K agents + 50 mobile apps)
- **Domains:** code, web, data, infra, docs, agents, mobile, blockchain

## Search Pipeline (Hybrid RRF)

Production search uses Reciprocal Rank Fusion combining:
1. **Vector search** — OpenAI text-embedding-3-small (1536-dim, pgvector)
2. **Full-text search** — PostgreSQL tsvector + BM25 + pg_trgm
3. **Neural routing** — Matrix-2 ColBERT domain classification

Results are fused using RRF (k=60), same approach as [qmd](https://github.com/tobi/qmd).

## P2P Integration

Matrix is the 9th primitive in the [Humans AI Gossiping Agents Protocol](https://protocol.humans.ai):

```
/humans-ai/matrix/1.0.0

Gossip topics:
  humans-ai/matrix/feedback    — user votes from all nodes
  humans-ai/matrix/discovery   — new skills gossipped
  humans-ai/matrix/model       — weight updates after retraining
```

Every node can run Matrix locally (~4GB VRAM). Feedback from all nodes aggregates into training data via gossip. The model improves from the network, for the network.

## Training

```bash
# Generate distillation data (mines hard negatives from OpenAI embeddings)
python3 train_v5_fast.py --epochs 30 --batch-size 1024 --lr 2e-4

# v5 results: loss 1.93 → 0.155 in 93 min on GPU
#   distill_loss: 0.86 → 0.30 (ColBERT aligned 70% with OpenAI)
#   contrastive_loss: 0.05 → 0.01 (strong discrimination)
```

## Experiment Log

| Version | Date | Capabilities | Retrieval Quality | Notes |
|---------|------|-------------|-------------------|-------|
| v2 | 2026-02-11 | 31,900 | 53.9% ret@1 | First working retrieval |
| v3 | 2026-02-28 | 100,000+ | 5.9% ret@1 | 2x capability space, quality dropped |
| v4 | 2026-03-08 | 100,000+ | 19.1% ret@1 | 30 epochs, but _orig_mod bug in deploy |
| v5 | 2026-03-19 | 100,000+ | TBD | Distilled from OpenAI, 93 min GPU |

## License

Part of the [Humans AI](https://humans.ai) open network.
