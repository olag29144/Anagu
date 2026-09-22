# Hyperledger Besu — QBFT Configuration

## Consensus: PoA-QBFT-DPoS hybrid

**Why QBFT?**
- Standard Proof-of-Work rejected: computational overhead and probabilistic finality don't suit a permissioned, institutionally governed context where validator identity is already known.
- Standard unweighted PoA rejected: doesn't support the reputation-based, statutory-role differentiation needed (specifically, restricting revocation to one authorised role).
- QBFT gives deterministic finality suited to statutory transactions; the DPoS component allows validator weighting to reflect institutional role.

## Configuration parameters

| Parameter | Value | Reason |
|---|---|---|
| `blockperiodseconds` | 1 | Fast finality for interactive workflows |
| `epochlength` | 30,000 | Long enough for stable validator sets |
| `requesttimeoutseconds` | 4 | Network round-trip budget for consensus |
| `chainId` | 1337 | Standard dev chain ID |
| `min-gas-price` | 0 | Permissioned network — no gas cost |

## Starting the node

```bash
docker compose up besu
```

## Health check

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  http://localhost:8545
```
