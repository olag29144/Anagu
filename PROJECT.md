# Anagu — Land Administration Framework
## Complete Project Reference & Build Guide

> **System:** An integrated Blockchain–GIS–NFT–Community Verification Oracle–MQTT framework
> for land title registration, verification, and lawful revocation.
>
> **Jurisdiction context:** Nigeria — Land Use Act (1978), Section 28 governs statutory revocation.
>
> **Purpose of this document:** A single reference you can always return to. It covers the full
> project vision, architecture, technology stack, component-by-component build instructions,
> testing requirements, and the exact acceptance criteria needed to reach 100% completion.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Development Philosophy](#2-development-philosophy)
3. [Repository Structure](#3-repository-structure)
4. [Technology Stack](#4-technology-stack)
5. [Environment & Infrastructure Setup (Step 0)](#5-environment--infrastructure-setup-step-0)
6. [Component 1 — GIS-Based Spatial Verification](#6-component-1--gis-based-spatial-verification)
7. [Component 2 — Blockchain NFT Tokenisation & Statutory Revocation](#7-component-2--blockchain-nft-tokenisation--statutory-revocation)
8. [Component 3 — Community Verification Oracle & MQTT](#8-component-3--community-verification-oracle--mqtt)
9. [Integration — Unified Registration Workflow](#9-integration--unified-registration-workflow)
10. [Component 4 — Cross-Cutting Evaluation](#10-component-4--cross-cutting-evaluation)
11. [Build Order Summary](#11-build-order-summary)
12. [Role-Based Access Control Matrix](#12-role-based-access-control-matrix)
13. [Expected Results Tables (All Components)](#13-expected-results-tables-all-components)
14. [Definition of Done — 100% Completion Checklist](#14-definition-of-done--100-completion-checklist)

---

## 1. Project Vision

Anagu digitises land title administration using five interlocked technologies:

| Technology | Purpose |
|---|---|
| **GIS / PostGIS** | Validate parcel geometry; detect overlaps before registration proceeds |
| **Hyperledger Besu** | Permissioned blockchain providing deterministic finality for statutory transactions |
| **Solidity ERC-721 NFTs** | Immutable, traceable digital land title tokens |
| **Community Verification Oracle** | Cross-check ownership claims against institutional and community sources |
| **MQTT** | Real-time event broadcasting; offline queue for low-connectivity field conditions |

### Why this combination?

- **Proof-of-Work rejected:** computational overhead and probabilistic finality do not suit a permissioned, institutionally governed context where validator identity is already known.
- **Standard unweighted PoA rejected:** does not support reputation-based, statutory-role differentiation — specifically, restricting the revocation function to one authorised role.
- **PoA-QBFT-DPoS chosen:** QBFT gives deterministic finality suited to statutory transactions; the DPoS component allows validator weighting to reflect institutional role.

---

## 2. Development Philosophy

Four rules govern everything:

1. **One component, one phase, one validation gate.** Do not start building the next component until the current one passes its own isolated test. Never debug a fully-wired system with five unknowns at once.

2. **Every component gets its success criteria defined before it is built.**

3. **The step-by-step procedures in this document are the spec, not a suggestion.** Implement them in the stated order.

4. **Cross-cutting evaluation (security, fraud resistance, storage, latency) happens once, last, across the whole integrated system** — never mixed into an individual component's own test.

---

## 3. Repository Structure

```
monorepo/
├── apps/
│   ├── web/                  # Next.js — citizen-facing portal
│   ├── mobile/               # React Native via Expo — field officers
│   └── backend/              # NestJS — all business logic and APIs
├── contracts/                # Solidity smart contracts (Hardhat project)
├── docker-compose.yml        # All infrastructure services
└── infra/
    └── besu/                 # Hyperledger Besu network config & genesis
```

### Scaffold commands

```bash
# Web
npx create-next-app apps/web

# Mobile
npx expo init apps/mobile

# Backend
npx nest new apps/backend

# Contracts
cd contracts && npx hardhat init
```

---

## 4. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Web frontend | Next.js | Citizen portal, registrar dashboard |
| Mobile frontend | React Native (Expo) | Field officers, low-connectivity use |
| Backend | NestJS (Node.js / TypeScript) | All APIs, services, orchestration |
| Database | PostgreSQL + PostGIS | Spatial data; parcel geometry |
| Blockchain | Hyperledger Besu | Permissioned PoA-QBFT-DPoS network |
| Smart contracts | Solidity | ERC-721 + AccessControl (OpenZeppelin) |
| Contract dev/test | Hardhat or Remix IDE | Local and testnet deployment |
| Messaging | MQTT — EMQX or Eclipse Mosquitto | Real-time events + offline sync |
| Caching / queues | Redis | Session cache, job queues |
| Object storage | MinIO | Land title documents (PDFs, images) |
| Containerisation | Docker Compose | All services in one `docker compose up` |
| Version control | Git | Monorepo |

### Blockchain consensus configuration

```
Consensus:    PoA-QBFT-DPoS (hybrid)
QBFT block period:   1 second
Epoch length:        30,000 blocks
```

Configure in `infra/besu/genesis.json`.

---

## 5. Environment & Infrastructure Setup (Step 0)

**Goal:** A running skeleton with every service reachable, before any business logic exists.

### 5.1 docker-compose.yml — required services

```yaml
services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: anagu
      POSTGRES_USER: anagu
      POSTGRES_PASSWORD: anagu_secret
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin

  mqtt:
    image: emqx/emqx:latest
    ports:
      - "1883:1883"
      - "8083:8083"
      - "18083:18083"

  besu:
    image: hyperledger/besu:latest
    volumes:
      - ./infra/besu:/config
    command: >
      --config-file=/config/config.toml
      --genesis-file=/config/genesis.json
    ports:
      - "8545:8545"
      - "8546:8546"
```

### 5.2 Besu QBFT genesis file

```json
{
  "config": {
    "chainId": 1337,
    "berlinBlock": 0,
    "qbft": {
      "blockperiodseconds": 1,
      "epochlength": 30000,
      "requesttimeoutseconds": 4
    }
  },
  "gasLimit": "0x1fffffffffffff",
  "difficulty": "0x1",
  "alloc": {}
}
```

### 5.3 Validation gate (must pass before Step 1)

```bash
# All containers healthy
docker compose ps

# NestJS connects to Postgres
# Check backend logs: "PostgreSQL connected"

# Deploy trivial contract to local Besu
npx hardhat run scripts/deploy_test.ts --network besu_local

# Confirm transaction hash returned
```

**Gate:** All services show `healthy`. Test transaction returns a transaction hash on the Besu network.
**Do not proceed until this is reliable.**

---

## 6. Component 1 — GIS-Based Spatial Verification

**Objective i**

**What it does:** Validates that a submitted land parcel has correct geometry and does not overlap an already-registered parcel, before the application proceeds any further.

### 6.1 Exact procedure

1. Receive parcel coordinates submitted by the applicant.
2. Convert the coordinates into a GIS polygon.
3. Validate the geometry of the polygon — is it a well-formed, non-self-intersecting shape?
4. Compare the polygon against existing land parcels already in the spatial database.
5. Detect any boundary overlap or topological inconsistency.
6. If the parcel satisfies all spatial validation rules, approve it for the next stage.
7. Otherwise, reject the application and return specific diagnostic feedback to the applicant (which rule failed).

### 6.2 Implementation notes

- Use PostGIS `ST_IsValid()` for step 3.
- Use PostGIS `ST_Intersects()` for steps 4–5.
- Reference coordinates to **WGS 84 (EPSG:4326)**.
- Define an explicit overlap tolerance buffer — real survey boundaries rarely align to the millimetre:

```sql
SELECT ST_Intersects(
  ST_Buffer(new_parcel.geom, 0.5),
  existing.geom
)
FROM parcels existing
WHERE existing.id != new_parcel.id;
```

> `0.5` = half a metre. Adjust to whatever is defensible for your survey data's accuracy class. **Record and report the value you use.**

### 6.3 How to test (isolated — no other component involved)

Construct a test set of parcels by hand:
- Some clean (valid geometry, no overlap)
- Some deliberately self-intersecting
- Some overlapping a seeded existing parcel

Confirm the module classifies every one correctly.

Run the test suite **twice:**
1. On a clean, controlled test set
2. On a deliberately messier set (near-miss boundaries, slivers, slightly rotated overlaps)

### 6.4 Validation gate

All hand-constructed parcels classified correctly in both test runs. Report both tables plus the overlap tolerance value used.

---

## 7. Component 2 — Blockchain NFT Tokenisation & Statutory Revocation

**Objective ii**

**What it does:** Issues approved land titles as immutable, traceable digital tokens, and provides a legally gated mechanism for those titles to be lawfully revoked by an authorised authority — distinguishing lawful, authority-invoked mutability from unauthorised tampering.

### 7.1 Part A — Smart contract execution (issuing/updating records)

**Exact procedure:**

1. Receive the verified transaction request (application that has already passed spatial verification and ownership verification).
2. Validate the transaction against predefined business rules.
3. Execute the corresponding smart contract function.
4. Record the transaction on the permissioned blockchain.
5. Update the ownership records.
6. Generate a transaction confirmation.

### 7.2 Part B — NFT title issuance

**Exact procedure:**

1. Receive the approved land registration record.
2. Generate a unique ERC-721 NFT representing the registered land parcel.
3. Associate the NFT with the verified ownership information.
4. Record the NFT reference on the blockchain.
5. Update the off-chain database with the NFT identifier.
6. Issue the digital land title to the registered owner.

**Implementation notes:**

Build two contracts:

| Contract | Responsibility |
|---|---|
| `LandTitleNFT` | Extends ERC-721; generates unique digital titles |
| `LandRegistry` | Manages issuance and registry-controlled transfers |

**Critical constraint:** Owner-initiated transfer functions must be **disabled**. Land ownership changes only occur through the authorised registry process — never a direct peer-to-peer NFT transfer as in a conventional marketplace.

Each NFT must contain:
- Unique token identifier
- Link to the corresponding land parcel
- Blockchain transaction hash
- Spatial information hash
- Title metadata

### 7.3 Part C — Statutory revocation

**Legal basis:** Nigeria's Land Use Act (1978), Section 28. Revocation is exercised by the Governor on one of two grounds:
- Overriding public interest
- Breach of a statutory condition

> **Important distinction:** A judicial dispute-resolution mechanism (court ruling between two parties) does **not** satisfy this requirement, even if it also results in a title change. This must be a distinct executive act.

**Exact procedure:**

1. Receive the revocation request and verify the requester's authorised governmental role.
2. Validate the revocation grounds (one of the two above).
3. Invoke the smart contract's revocation function against the target NFT.
4. Record the revocation event **immutably on the blockchain, as a distinct event** from the original issuance record — do not just flip an ownership field. The revocation must remain auditable as its own historical event.
5. Update the off-chain database and GIS layer to reflect the parcel's reverted status.
6. Notify the affected titleholder and the relevant registry office.

**Contract code:**

```solidity
// LandTitleNFT.sol
// Requires:
//   import "@openzeppelin/contracts/access/AccessControl.sol";
//   contract LandTitleNFT is ERC721, AccessControl { ... }

bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

enum RevocationGround {
    OverridingPublicInterest,
    BreachOfStatutoryCondition
}

mapping(uint256 => bool) public isRevoked;

event TitleRevoked(
    uint256 indexed tokenId,
    RevocationGround ground,
    address indexed revokedBy,
    uint256 timestamp
);

function revoke(uint256 tokenId, RevocationGround ground)
    external
    onlyRole(GOVERNOR_ROLE)
{
    require(_exists(tokenId), "LandTitleNFT: token does not exist");
    require(!isRevoked[tokenId], "LandTitleNFT: already revoked");
    isRevoked[tokenId] = true;
    emit TitleRevoked(tokenId, ground, msg.sender, block.timestamp);
}

// Block any transfer of a revoked token
// OpenZeppelin v4: _beforeTokenTransfer | OpenZeppelin v5: _update override
function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId,
    uint256 batchSize
) internal override {
    require(!isRevoked[tokenId], "LandTitleNFT: token is revoked");
    super._beforeTokenTransfer(from, to, tokenId, batchSize);
}
```

**Deployment:**

```solidity
// Grant GOVERNOR_ROLE to one designated address
// (use a multisig in production; a single test address is fine for prototype)
_grantRole(GOVERNOR_ROLE, governorAddress);
```

### 7.4 How to test Component 2 (isolated — mock approved data, no GIS or oracle dependency)

```javascript
describe("Statutory revocation", () => {
  it("allows the Governor-role address to revoke a title", async () => {
    // ground 0 = OverridingPublicInterest
    await landTitleNFT.connect(governor).revoke(tokenId, 0);
    expect(await landTitleNFT.isRevoked(tokenId)).to.equal(true);
  });

  it("reverts when a non-Governor address attempts to revoke", async () => {
    await expect(
      landTitleNFT.connect(randomUser).revoke(tokenId, 0)
    ).to.be.reverted;
  });

  it("reverts any transfer attempt on a revoked token", async () => {
    // ground 1 = BreachOfStatutoryCondition
    await landTitleNFT.connect(governor).revoke(tokenId, 1);
    await expect(
      landTitleNFT.connect(owner).transferFrom(
        owner.address, buyer.address, tokenId
      )
    ).to.be.reverted;
  });
});
```

### 7.5 Validation gate

Six-case test suite passes with mock inputs (see Section 13 for result tables).

---

## 8. Component 3 — Community Verification Oracle & MQTT

**Objective iii**

### 8.1 Part A — Ownership verification (the oracle)

**What it does:** Checks submitted ownership information against institutional and community sources before anything reaches the blockchain, reconciling statutory and customary tenure claims.

**Exact procedure:**

1. Receive ownership information submitted during land registration.
2. Forward the information to the verification service.
3. Retrieve ownership records from authorised institutional and community sources.
4. Compare the retrieved information with the submitted records.
5. If the ownership information is successfully verified, approve it for the next stage.
6. Otherwise, reject the request and return the verification result for administrative review.

**Implementation notes:**

- Build this as an intermediary **NestJS service**.
- **Document precisely what counts as a "match" versus a "conflict"** in your comparison logic. This rule is what later gets stress-tested in Component 4's fraud scenarios. Vague matching criteria now becomes an untestable claim later.

**How to test (isolated — GIS and blockchain both mocked out):**

Construct test cases covering all four outcome categories:
- Successfully verified
- Incomplete supporting documents
- Ownership information conflict
- Legal verification pending

### 8.2 Part B — MQTT communication and synchronisation

**What it does:** Publishes real-time notifications across backend, web, and mobile clients whenever a significant workflow event occurs, and supports offline data capture with later synchronisation for low-connectivity conditions.

**Exact procedure:**

1. Receive the validated transaction request.
2. Publish the transaction message to the MQTT broker.
3. Notify all subscribed system components.
4. Synchronise transaction information across the integrated framework.
5. Confirm successful message delivery.
6. Record the communication event for system monitoring and auditing.

**MQTT topic schema (fill in from implementation):**

| Topic | Payload fields | QoS level |
|---|---|---|
| `land/registration/status` | `{applicationId, status, timestamp}` | 1 |
| `land/title/issued` | `{tokenId, owner, parcelId, timestamp}` | 1 |
| `land/title/revoked` | `{tokenId, ground, revokedBy, timestamp}` | 2 |
| `land/verification/result` | `{applicationId, outcome, timestamp}` | 1 |

> Approximate the byte size of a representative payload with `JSON.stringify(payload).length` — this feeds directly into Component 4's storage-overhead calculation.

**Testing under degraded connectivity (required — not optional):**

```bash
# Identify the network interface
ip addr show

# Moderate degradation: 200ms latency, 10% packet loss
sudo tc qdisc add dev eth0 root netem delay 200ms loss 10%
npm run test:mqtt
sudo tc qdisc del dev eth0 root

# Severe degradation: 500ms latency, 25% packet loss
sudo tc qdisc add dev eth0 root netem delay 500ms loss 25%
npm run test:mqtt
sudo tc qdisc del dev eth0 root
```

**Offline queue test:**
1. Disable network on a test device.
2. Submit a registration through the mobile app.
3. Confirm the submission sits in a **local queue** (check local storage directly, not just the UI).
4. Re-enable network.
5. Confirm the queued submission reaches the backend.
6. Log the delay from reconnect to delivery.

> If offline queueing is not actually implemented, build it now — a local buffer that flushes on reconnect.

### 8.3 Validation gate

Verification test passes + normal-condition MQTT test passes.

---

## 9. Integration — Unified Registration Workflow

**Run only after Components 1, 2, and 3 each individually pass their own tests.**

### 9.1 End-to-end pipeline sequence

```
Application submission
  → Spatial verification          (Component 1)
  → Community attestation /
    Ownership verification        (Component 3, Part A)
  → Legal verification
  → Registrar approval
  → Blockchain registration       (Component 2, Part A)
  → NFT title issuance            (Component 2, Part B)
  → MQTT notification             (Component 3, Part B)
```

### 9.2 Integration requirements

- Add **role-based access control** across every stage:

| Role | Capabilities |
|---|---|
| Citizen | Submit applications, view own status |
| Surveyor | Submit parcel coordinates, validate geometry |
| Registrar | Approve/reject applications, trigger blockchain registration |
| Land Administrator | Manage registry, oversee all workflows |
| Governor | Invoke statutory revocation only |

- Log **every state transition** to an immutable audit trail.

### 9.3 Debugging rule

If this integration test fails, the bug is almost certainly in **how two components interact**, not in either component alone. Debug the interface, not the internals.

### 9.4 Validation gate

End-to-end workflow test passes (see Section 13 for result table).

---

## 10. Component 4 — Cross-Cutting Evaluation

**Objective iv — Run only after integration (Step 4) passes.**

**What this evaluates:** The fully integrated system's security, fraud resistance, storage efficiency, and processing speed — all measured the same way across both the proposed system and a defined conventional baseline, so every number has a comparator.

### 10.1 Define the conventional baseline first

Before running any comparison, build a **simplified simulator** representing a manual/paper-based process:
- Checks document **presence** but not authenticity
- Performs **no** automated spatial cross-check
- Performs **no** automated ownership cross-check

It does not need to be sophisticated — it needs to represent what a non-automated process would and would not catch.

### 10.2 Part A — Fraud and tampering scenarios

Four adversary scenarios, each tested **independently** — do not average them into one combined "fraud rate":

| # | Scenario | How to construct the test input | Layer targeted |
|---|---|---|---|
| 1 | Forged or altered supporting document | Submit a registration with a doctored document (edited metadata, mismatched signature) | Application / document layer |
| 2 | Duplicate or overlapping parcel claim | Submit coordinates that intentionally overlap an already-registered parcel | Spatial / GIS layer |
| 3 | Colluding verification informant | Submit ownership info where the community/institutional attestation step is deliberately falsified | Oracle / verification layer |
| 4 | Post-revocation NFT reuse | Revoke a title (Component 2, Part C), then attempt to transact against it | Blockchain / NFT layer |

**Run each scenario at least 20–30 times** against both the proposed system and the baseline simulator.

### 10.3 Part B — Processing latency (5-stage timing)

Instrument each stage of one complete registration transaction:

```javascript
const { performance } = require('perf_hooks');

async function timedRegistration(applicationData) {
  const t0 = performance.now();
  await gisVerify(applicationData.parcel);
  const t_gis = performance.now() - t0;

  const t1 = performance.now();
  await oracleVerify(applicationData.ownership);
  const t_oracle = performance.now() - t1;

  const t2 = performance.now();
  await executeSmartContract(applicationData.transaction);
  const t_contract = performance.now() - t2;

  const t3 = performance.now();
  await issueNFT(applicationData.title);
  const t_nft = performance.now() - t3;

  const t4 = performance.now();
  await publishMQTT(applicationData.event);
  const t_sync = performance.now() - t4;

  const T_total = t_gis + t_oracle + t_contract + t_nft + t_sync;
  return { t_gis, t_oracle, t_contract, t_nft, t_sync, T_total };
}
```

> Run this at least **30 times** on separate transactions. Run the equivalent flow through the baseline simulator for the same transaction type.

> Note: The `t_contract` figure from Component 2's revoke() call confirmation time is reused here in the timing table.

### 10.4 Part C — Storage overhead

Open the actual deployed contract's storage layout and record the real bit length used for each field:

| Field | Variable | What it stores | Typical size |
|---|---|---|---|
| Parcel identity hash | `S_id` | e.g. keccak256 | 256 bits |
| Spatial geometry reference | `S_geom` | hash stored on-chain | ? bits |
| Ownership / NFT-holder reference | `S_owner` | Ethereum address | 160 bits (20 bytes) |
| Oracle payload | `S_oracle` | from MQTT payload schema | ? bits |
| Timestamp | `S_time` | check actual stored type | ? bits |
| Validator / contract signature | `S_sig` | if stored on-chain | ? bits |
| Merkle proof metadata | `S_merkle` | if applicable; 0 if not | ? bits |

**Total per-record size** = sum of all seven fields.

Multiply by the number of registered parcels for network-wide storage.

Compute the same total for the baseline (e.g., a naive design storing full geometry data on-chain instead of a hash) to get a percentage reduction.

---

## 11. Build Order Summary

| Step | Component | Depends on | Must pass before moving on |
|---|---|---|---|
| 0 | Environment setup | — | All services healthy; test transaction confirms on Besu |
| 1 | GIS spatial verification | Step 0 | Hand-constructed test parcels classify correctly |
| 2 | Blockchain / NFT / revocation | Step 0 | Six-case test suite passes with mock inputs |
| 3 | Oracle + MQTT | Step 0 | Verification test + normal-condition MQTT test pass |
| 4 | Integration | Steps 1–3 | End-to-end workflow test passes |
| 5 | Cross-cutting evaluation | Step 4 | All four result tables completed with real data |

Each row's "must pass" column is a **hard gate**. This is the single biggest reason to avoid debugging a fully-integrated system before its individual parts are each proven to work alone.

---

## 12. Role-Based Access Control Matrix

| Action | Citizen | Surveyor | Registrar | Land Admin | Governor |
|---|:---:|:---:|:---:|:---:|:---:|
| Submit land application | ✅ | | | | |
| Submit parcel coordinates | | ✅ | | | |
| View application status (own) | ✅ | | | | |
| Validate geometry | | ✅ | | | |
| Approve / reject application | | | ✅ | | |
| Trigger blockchain registration | | | ✅ | | |
| Issue NFT title | | | ✅ | | |
| Manage registry | | | | ✅ | |
| View all applications | | | ✅ | ✅ | |
| Invoke statutory revocation | | | | | ✅ |
| View audit trail | | | ✅ | ✅ | ✅ |

---

## 13. Expected Results Tables (All Components)

Fill these in with real measured data as each component is completed.

---

### Component 1 — Spatial Verification Test Results

**Run A (clean/controlled test set):**

| Validation Outcome | Frequency | Percentage |
|---|---|---|
| Valid and non-overlapping | [n] | [%] |
| Invalid geometry | [n] | [%] |
| Overlapping existing parcel | [n] | [%] |
| **Total** | **[N]** | **100%** |

**Run B (deliberately messy test set — near-miss boundaries, slivers, rotated overlaps):**

| Validation Outcome | Frequency | Percentage |
|---|---|---|
| Valid and non-overlapping | [n] | [%] |
| Invalid geometry | [n] | [%] |
| Overlapping existing parcel | [n] | [%] |
| **Total** | **[N]** | **100%** |

**Overlap tolerance value used:** `[value]` metres

---

### Component 2A — Smart Contract and NFT Lifecycle Events

| Blockchain Event | Frequency |
|---|---|
| NFT land titles issued | [n] |
| Registry-controlled transfers completed | [n] |
| Owner-initiated transfer attempts rejected | [n] |

### Component 2B — Statutory Revocation Test Results

| Test | Result | Notes |
|---|---|---|
| Governor-role revocation succeeds | [Pass/Fail] | |
| Non-Governor revocation attempt reverts | [Pass/Fail] | |
| Transfer of a revoked token reverts | [Pass/Fail] | |
| Gas cost of `revoke()` call | [n] gas | |
| Confirmation time of `revoke()` call | [n] ms | Also used as T_contract in Component 4 timing |

---

### Component 3A — Ownership Verification Test Results

| Verification Outcome | Frequency | Percentage |
|---|---|---|
| Successfully verified | [n] | [%] |
| Incomplete supporting documents | [n] | [%] |
| Ownership information conflict | [n] | [%] |
| Legal verification pending | [n] | [%] |
| **Total** | **[N]** | **100%** |

### Component 3B — MQTT Delivery Performance by Network Condition

| Condition | Messages Sent | Successfully Delivered | Delivery Rate |
|---|---|---|---|
| Normal connectivity | [N] | [n] | [%] |
| Moderate degradation (200ms / 10% loss) | [N] | [n] | [%] |
| Severe degradation (500ms / 25% loss) | [N] | [n] | [%] |

### Component 3B — Offline Queue Test

| Scenario | Result |
|---|---|
| Submission made while offline is queued locally | [Yes/No] |
| Queued submission is delivered after reconnect | [Yes/No] |
| Time from reconnect to successful delivery | [n] seconds |

---

### Integration — End-to-End Registration Workflow Outcomes

| Application Status | Frequency | Percentage |
|---|---|---|
| Successfully completed (NFT issued) | [n] | [%] |
| Rejected during review | [n] | [%] |
| Cancelled by applicant | [n] | [%] |
| Still under processing | [n] | [%] |
| **Total** | **[N]** | **100%** |

---

### Component 4A — Fraud Scenario Detection and Rejection Rates

| Scenario | Trials | Proposed Framework Outcome | Baseline Outcome |
|---|---|---|---|
| 1. Forged/altered documents | [N] | [n detected / N (%)] | [n detected / N (%)] |
| 2. Duplicate/overlapping parcel | [N] | [n detected / N (%)] | [n detected / N (%)] |
| 3. Colluding verification informant | [N] | [n detected / N (%)] | [n detected / N (%)] |
| 4. Post-revocation NFT reuse | [N] | [n detected / N (%)] | [n detected / N (%)] |

### Component 4B — End-to-End Processing Latency (mean of 30+ runs)

| Stage | Proposed Framework (ms) | Baseline (ms) |
|---|---|---|
| Spatial verification | [mean ± sd] | [mean ± sd] |
| Ownership/oracle verification | [mean ± sd] | [mean ± sd] |
| Smart contract execution | [mean ± sd] | [mean ± sd] |
| NFT issuance | [mean ± sd] | [mean ± sd] |
| MQTT synchronisation | [mean ± sd] | [mean ± sd] |
| **Total** | **[mean ± sd]** | **[mean ± sd]** |
| **Improvement** | | **[% reduction]** |

### Component 4C — Storage Overhead Comparison

| | Proposed Framework | Baseline |
|---|---|---|
| Per-record size (bytes) | [n] | [n] |
| Network storage for [N] parcels | [n] | [n] |
| **Reduction** | | **[% reduction]** |

---

## 14. Definition of Done — 100% Completion Checklist

Use this checklist to track progress to 100%.

### Step 0 — Environment
- [ ] Monorepo scaffolded (Next.js, Expo, NestJS, Hardhat)
- [ ] `docker-compose.yml` brings up all 5 services (Postgres+PostGIS, Redis, MinIO, MQTT, Besu)
- [ ] `docker compose ps` shows all containers healthy
- [ ] NestJS connects to PostgreSQL
- [ ] Trivial Solidity contract deploys to local Besu node
- [ ] Test transaction confirmed on-chain

### Component 1 — GIS
- [ ] PostGIS spatial schema created (parcels table with geometry column)
- [ ] `ST_IsValid()` geometry check implemented
- [ ] `ST_Intersects()` overlap check implemented with buffer tolerance
- [ ] Overlap tolerance value chosen and documented
- [ ] NestJS endpoint wired to spatial validation service
- [ ] Diagnostic error codes returned on rejection (which rule failed)
- [ ] Clean test set — all parcels classified correctly
- [ ] Messy test set — accuracy holds under hard conditions
- [ ] Both result tables filled with real data
- [ ] Overlap tolerance value reported

### Component 2 — Blockchain / NFT / Revocation
- [ ] `LandTitleNFT.sol` contract written (extends ERC-721)
- [ ] `LandRegistry.sol` contract written
- [ ] Owner-initiated transfers disabled
- [ ] Each NFT contains all 5 required fields
- [ ] `GOVERNOR_ROLE` defined and assigned
- [ ] `RevocationGround` enum defined (2 grounds)
- [ ] `revoke()` function implemented with role check
- [ ] `TitleRevoked` event emitted with full fields
- [ ] Revoked token transfer blocked in `_beforeTokenTransfer`
- [ ] Revocation recorded as distinct on-chain event (not an ownership field flip)
- [ ] Off-chain DB + GIS layer updated on revocation
- [ ] Titleholder and registry office notified on revocation
- [ ] All 3 Hardhat test cases pass
- [ ] Gas cost of `revoke()` measured and recorded
- [ ] Confirmation time of `revoke()` measured (used in Component 4)
- [ ] Smart contract and NFT lifecycle event table filled

### Component 3 — Oracle + MQTT
- [ ] NestJS verification service built
- [ ] "Match" vs "conflict" logic precisely documented
- [ ] All 4 verification outcome categories covered
- [ ] Ownership verification test table filled
- [ ] MQTT broker running (EMQX or Mosquitto)
- [ ] All topics and payload schemas documented
- [ ] `JSON.stringify(payload).length` measured for representative payloads
- [ ] Normal connectivity delivery test — table filled
- [ ] Moderate degradation test (200ms / 10% loss) — table filled
- [ ] Severe degradation test (500ms / 25% loss) — table filled
- [ ] Offline queue implemented (local buffer that flushes on reconnect)
- [ ] Offline queue test completed — all 3 scenarios recorded

### Integration
- [ ] All 3 components individually pass isolated tests
- [ ] End-to-end pipeline wired in correct sequence
- [ ] RBAC applied at every stage (5 roles)
- [ ] Every state transition logged to immutable audit trail
- [ ] End-to-end workflow test passes
- [ ] Integration result table filled

### Component 4 — Cross-Cutting Evaluation
- [ ] Conventional baseline simulator built
- [ ] Baseline checks document presence only (no spatial, no ownership checks)
- [ ] Scenario 1 (forged document) run 20–30 times on both systems — table filled
- [ ] Scenario 2 (duplicate parcel) run 20–30 times on both systems — table filled
- [ ] Scenario 3 (colluding informant) run 20–30 times on both systems — table filled
- [ ] Scenario 4 (post-revocation NFT reuse) run 20–30 times on both systems — table filled
- [ ] `timedRegistration()` instrumentation implemented
- [ ] Latency timing run 30+ times — mean ± SD recorded for all 5 stages
- [ ] Baseline latency timing run for same transaction type
- [ ] Latency improvement percentage calculated
- [ ] All 7 on-chain storage fields measured in real bits
- [ ] Per-record byte size calculated
- [ ] Network-wide storage calculated for N parcels
- [ ] Baseline storage calculated
- [ ] Storage reduction percentage calculated
- [ ] All four result tables completed with real data

### Final
- [ ] All result tables in Section 13 filled with real measured data
- [ ] All checklist items above checked off
- [ ] This `PROJECT.md` updated with final values

---

*Document version: 1.0 — Generated from Anagu Complete Build and Test Guide*
*Last updated: September 2026*
