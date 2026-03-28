# Validator Guide

## Hardware Requirements

### Minimum

| Resource | Requirement |
|----------|-------------|
| CPU | 4 cores |
| RAM | 8 GB |
| Storage | 200 GB SSD |
| Network | 100 Mbps |
| OS | Ubuntu 22.04+ / Debian 12+ |

### Recommended

| Resource | Requirement |
|----------|-------------|
| CPU | 8 cores |
| RAM | 16 GB |
| Storage | 500 GB NVMe SSD |
| Network | 1 Gbps |
| OS | Ubuntu 22.04 LTS |

---

## Installing heartd

### From Source

```bash
# Install dependencies
sudo apt update && sudo apt install -y build-essential git curl jq

# Install Go 1.22+
wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.bashrc
source ~/.bashrc

# Clone and build
git clone https://github.com/humansai/heart.git
cd heart
make install

# Verify
heartd version
```

---

## Setting Up a Node

### Initialize

```bash
# Initialize the node (choose a moniker)
heartd init my-validator --chain-id heart-testnet-1

# Download genesis
curl -o ~/.heart/config/genesis.json \
  http://5.161.47.118:26657/genesis | jq '.result.genesis' > ~/.heart/config/genesis.json

# Set persistent peers
PEERS="$(curl -s http://5.161.47.118:26657/net_info | jq -r '.result.peers[] | .node_info.id + "@" + .remote_ip + ":26656"' | paste -sd,)"
sed -i "s/persistent_peers = \"\"/persistent_peers = \"$PEERS\"/" ~/.heart/config/config.toml

# Set minimum gas price
sed -i 's/minimum-gas-prices = ""/minimum-gas-prices = "0.025uheart"/' ~/.heart/config/app.toml
```

### Configure Pruning (Recommended)

```bash
sed -i 's/pruning = "default"/pruning = "custom"/' ~/.heart/config/app.toml
sed -i 's/pruning-keep-recent = "0"/pruning-keep-recent = "100"/' ~/.heart/config/app.toml
sed -i 's/pruning-interval = "0"/pruning-interval = "10"/' ~/.heart/config/app.toml
```

### Create a systemd Service

```bash
sudo tee /etc/systemd/system/heartd.service > /dev/null <<EOF
[Unit]
Description=HEART Blockchain Node
After=network.target

[Service]
User=$USER
Type=simple
ExecStart=$(which heartd) start
Restart=on-failure
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable heartd
sudo systemctl start heartd
```

### Verify Sync

```bash
# Check sync status
heartd status 2>&1 | jq '.SyncInfo'

# Watch logs
journalctl -u heartd -f --no-hostname -o cat
```

Wait until `catching_up` is `false` before proceeding.

---

## Joining the Testnet

### Testnet Endpoints

| Service | Endpoint |
|---------|----------|
| RPC | `http://5.161.47.118:26657` |
| REST / LCD | `http://5.161.47.118:1317` |
| gRPC | `5.161.47.118:9090` |
| P2P | `5.161.47.118:26656` |
| Faucet | `http://5.161.47.118:4500` |

### Get Testnet Tokens

```bash
# Create a validator key
heartd keys add validator-key

# Request tokens from faucet
curl -X POST http://5.161.47.118:4500/send \
  -H "Content-Type: application/json" \
  -d '{"address": "heart1your_validator_address"}'
```

---

## Creating a Validator

Once your node is fully synced:

```bash
heartd tx staking create-validator \
  --amount=1000000uheart \
  --pubkey=$(heartd tendermint show-validator) \
  --moniker="my-validator" \
  --chain-id=heart-testnet-1 \
  --commission-rate="0.10" \
  --commission-max-rate="0.20" \
  --commission-max-change-rate="0.01" \
  --min-self-delegation="1" \
  --gas="auto" \
  --gas-adjustment=1.5 \
  --fees=1000uheart \
  --from=validator-key
```

### Verify

```bash
# Check your validator
heartd query staking validator $(heartd keys show validator-key --bech val -a)

# Check voting power
heartd status 2>&1 | jq '.ValidatorInfo'
```

---

## Monitoring

### Prometheus

Enable Prometheus metrics in `config.toml`:

```toml
[instrumentation]
prometheus = true
prometheus_listen_addr = ":26660"
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| `tendermint_consensus_height` | Current block height |
| `tendermint_consensus_validators` | Active validator count |
| `tendermint_consensus_missing_validators` | Missed blocks |
| `tendermint_p2p_peers` | Connected peers |
| `tendermint_mempool_size` | Pending transactions |

### Health Check

```bash
# Quick health check
curl -s http://localhost:26657/health | jq

# Block height
curl -s http://localhost:26657/status | jq '.result.sync_info.latest_block_height'

# Peers
curl -s http://localhost:26657/net_info | jq '.result.n_peers'
```

---

## Upgrading

When a chain upgrade is announced:

### Option 1: Manual Upgrade

```bash
# Stop the node
sudo systemctl stop heartd

# Pull latest code
cd heart
git fetch --all
git checkout <new-version-tag>
make install

# Restart
sudo systemctl start heartd
```

### Option 2: Cosmovisor (Recommended)

```bash
# Install cosmovisor
go install cosmossdk.io/tools/cosmovisor/cmd/cosmovisor@latest

# Set up directory structure
mkdir -p ~/.heart/cosmovisor/genesis/bin
cp $(which heartd) ~/.heart/cosmovisor/genesis/bin/

# Configure environment
echo 'export DAEMON_NAME=heartd' >> ~/.bashrc
echo 'export DAEMON_HOME=$HOME/.heart' >> ~/.bashrc
echo 'export DAEMON_ALLOW_DOWNLOAD_BINARIES=true' >> ~/.bashrc
source ~/.bashrc

# Update systemd service to use cosmovisor
sudo tee /etc/systemd/system/heartd.service > /dev/null <<EOF
[Unit]
Description=HEART Node (Cosmovisor)
After=network.target

[Service]
User=$USER
Type=simple
ExecStart=$(which cosmovisor) run start
Restart=on-failure
RestartSec=10
LimitNOFILE=65535
Environment="DAEMON_NAME=heartd"
Environment="DAEMON_HOME=$HOME/.heart"
Environment="DAEMON_ALLOW_DOWNLOAD_BINARIES=true"

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl restart heartd
```

---

## Unjailing

If your validator is jailed for downtime:

```bash
heartd tx slashing unjail \
  --from=validator-key \
  --chain-id=heart-testnet-1 \
  --fees=500uheart
```

## Delegating Additional Stake

```bash
heartd tx staking delegate $(heartd keys show validator-key --bech val -a) \
  1000000uheart \
  --from=validator-key \
  --chain-id=heart-testnet-1 \
  --fees=500uheart
```
