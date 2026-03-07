# Alto: Architecture & Codebase Reference

## Table of Contents

- [What Is Alto?](#what-is-alto)
- [Architecture Overview](#architecture-overview)
- [The 8 Crates](#the-8-crates)
  - [alto-types — Shared Type Definitions](#1-alto-types--shared-type-definitions)
  - [alto-chain — Core Blockchain Engine](#2-alto-chain--core-blockchain-engine)
  - [alto-validator — Validator Node Binary](#3-alto-validator--validator-node-binary)
  - [alto-deploy — Configuration Generator](#4-alto-deploy--configuration-generator)
  - [alto-indexer — Activity Serving Service](#5-alto-indexer--activity-serving-service)
  - [alto-client — Indexer Client SDK](#6-alto-client--indexer-client-sdk)
  - [alto-follower — Full Node (Non-Voting)](#7-alto-follower--full-node-non-voting)
  - [alto-inspector — CLI Debugging Tool](#8-alto-inspector--cli-debugging-tool)
- [Complete Data Flow](#how-they-all-interact--the-complete-data-flow)
- [Cryptography Summary](#cryptography-summary)
- [Build & CI](#build--ci)
- [Key Design Decisions](#key-design-decisions)
- [Commonware Modules Reference](#commonware-modules-reference)

---

## What Is Alto?

Alto is a **minimal, high-performance blockchain** built entirely on the [Commonware Library](https://github.com/commonwarexyz/monorepo). It implements **Simplex BFT consensus** with BLS12-381 threshold signatures for finality and ED25519 for validator identity. It is designed for adversarial environments with a security-first approach, dual-licensed under MIT/Apache-2.0.

The project version is **0.0.19**, pinned to a single Commonware monorepo commit (`16e98b5`).

---

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │         alto-deploy              │
                    │  Generates keys, configs, and    │
                    │  deployment manifests (local/AWS) │
                    └──────────────┬──────────────────┘
                                   │ produces config YAML files
                    ┌──────────────▼──────────────────┐
                    │         alto-validator           │
                    │  Consensus participant node      │
                    │  - Proposes & votes on blocks    │
                    │  - P2P authenticated networking  │
                    │  - Persists finalized chain      │
                    │  - Pushes to indexer (optional)  │
                    └──────┬───────────────┬──────────┘
                           │ P2P           │ HTTP POST
                           │               ▼
                    ┌──────▼──────┐  ┌─────────────────┐
                    │  Other      │  │   alto-indexer   │
                    │  Validators │  │  In-memory store │
                    │  (N total)  │  │  REST + WebSocket│
                    └─────────────┘  └───┬─────────┬───┘
                                         │ HTTP    │ WS
                              ┌──────────▼──┐  ┌──▼──────────┐
                              │alto-inspector│  │alto-follower│
                              │  CLI debug   │  │  Full node  │
                              │  tool        │  │  (no voting)│
                              └──────────────┘  └─────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │    alto-client       │
                              │  HTTP/WS SDK for     │
                              │  querying indexer     │
                              └──────────────────────┘

                    ┌─────────────────────────────────┐
                    │         alto-types               │
                    │  Shared types used by everything │
                    │  Also compiles to WASM (cdylib)  │
                    └─────────────────────────────────┘
```

---

## The 8 Crates

---

### 1. `alto-types` — Shared Type Definitions

**Purpose:** The foundational library every other crate depends on. Defines all consensus types and block structures. Also compiles to WebAssembly for browser-based verification.

**Crate type:** `rlib` (Rust library) + `cdylib` (WASM target)

#### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `NAMESPACE` | `b"_ALTO"` | Signing domain separator — prevents cross-protocol signature replay |
| `EPOCH` | `Epoch::zero()` | Hardcoded to 0 — Alto has no validator reconfiguration |
| `EPOCH_LENGTH` | `NZU64!(u64::MAX)` | Stays in epoch 0 forever |

#### Core Types

**`Block`** — The fundamental chain unit:
```rust
pub struct Block {
    pub context: Context,    // Round info (epoch, view), leader pubkey, parent view+digest
    pub parent: Digest,      // SHA256 digest of parent block
    pub height: Height,      // Monotonically increasing block number
    pub timestamp: u64,      // Milliseconds since Unix epoch
    digest: Digest,          // Pre-computed SHA256(context | parent | height_be | timestamp_be)
}
```

**`Notarized`** — A block with a quorum notarization proof:
```rust
pub struct Notarized {
    pub proof: Notarization,  // BLS threshold signature from 2f+1 validators
    pub block: Block,
}
```
On decode, validates `proof.proposal.payload == block.digest()`.

**`Finalized`** — A block with a finalization proof (same structure as Notarized but with stronger guarantee):
```rust
pub struct Finalized {
    pub proof: Finalization,  // BLS threshold finalization signature
    pub block: Block,
}
```

**`Kind`** — Message type discriminator (used in WebSocket protocol):
```rust
#[repr(u8)]
pub enum Kind {
    Seed = 0,
    Notarization = 1,
    Finalization = 2,
}
```

#### Consensus Type Aliases

These wire Alto's generic types to concrete cryptographic schemes:

| Alias | Resolves To | Meaning |
|-------|------------|---------|
| `Scheme` | `vrf::Scheme<PublicKey, MinSig>` | BLS12-381 threshold VRF for leader election |
| `Seed` | `vrf::Seed<MinSig>` | Verifiable random function output per view |
| `Notarization` | `CNotarization<Scheme, Digest>` | Threshold-signed notarization certificate |
| `Finalization` | `CFinalization<Scheme, Digest>` | Threshold-signed finalization certificate |
| `Activity` | `CActivity<Scheme, Digest>` | Union of Notarization/Finalization events |
| `Context` | `CContext<Digest, PublicKey>` | Block proposal context (round, leader, parent) |
| `PublicKey` | `ed25519::PublicKey` | Validator P2P identity |
| `Identity` | `<MinSig as Variant>::Public` | BLS12-381 threshold public key (shared) |
| `Signature` | `<MinSig as Variant>::Signature` | BLS12-381 threshold signature |

#### WASM Exports

Five `#[wasm_bindgen]` functions for browser-based parsing and verification:
- `parse_seed(identity, bytes)` — Decode + verify a seed, return JS object
- `parse_notarized(identity, bytes)` — Decode + verify a notarization
- `parse_finalized(identity, bytes)` — Decode + verify a finalization
- `parse_block(bytes)` — Decode a block (no signature to verify)
- `leader_index(seed, participants)` — Compute which validator leads a given view

All return `JsValue::NULL` on verification failure.

#### Encoding

All types use `commonware-codec` binary encoding:
- Block: `[Context][Parent: 32 bytes][Height: varint][Timestamp: varint]`
- Notarized/Finalized: `[Proof][Block]` with integrity check on decode

---

### 2. `alto-chain` — Core Blockchain Engine

**Purpose:** The consensus engine library. Implements block proposal, validation, notarization, finalization, and persistent storage. This is the heart of the system.

#### Genesis

```rust
const GENESIS: &[u8] = b"commonware is neat";
// Genesis block:
//   Round: (EPOCH, View(0))
//   Leader: ed25519::PrivateKey::from_seed(0).public_key()
//   Parent: SHA256(GENESIS)
//   Height: 0
//   Timestamp: 0
```

Every node deterministically computes the same genesis block.

#### Config

```rust
pub struct Config {
    pub private_key: String,        // ED25519 hex
    pub share: String,              // BLS12-381 threshold share hex
    pub polynomial: String,         // BLS12-381 polynomial hex
    pub port: u16,                  // P2P port
    pub metrics_port: u16,          // Prometheus metrics port
    pub directory: String,          // Storage path
    pub worker_threads: usize,
    pub log_level: String,
    pub local: bool,                // Local vs. remote networking mode
    pub allowed_peers: Vec<String>, // All validator pubkeys
    pub bootstrappers: Vec<String>, // Initial peer discovery
    pub message_backlog: usize,     // P2P message queue depth
    pub mailbox_size: usize,        // Internal channel capacity
    pub deque_size: usize,          // Consensus deque size
    pub signature_threads: usize,   // Parallel sig verification threads
    pub indexer: Option<String>,    // Optional indexer URL
}
```

#### Engine Architecture

The engine orchestrates **three concurrent actors**:

```
                    ┌──────────────────────────┐
                    │   buffered::Engine        │
   Broadcast ──────►  (transaction buffer)     │
   Channel         │  Buffers out-of-order     │
                    │  messages with priority   │
                    └───────────┬──────────────┘
                                │ buffer_mailbox
                    ┌───────────▼──────────────┐
                    │   marshal::Actor          │
                    │  - Manages finalization   │
   Marshal ────────►  - Stores certificates    │
   Channel         │  - Subscribes blocks      │
                    │  - Archives finalized     │
                    └───────────┬──────────────┘
                                │ marshaled (Application wrapper)
                    ┌───────────▼──────────────┐
   Pending ────────►                           │
   Channel         │   simplex::Engine         │
                    │  (Simplex BFT consensus)  │
   Recovered ──────►  - Leader election (VRF)  │
   Channel         │  - Block proposal         │
                    │  - Notarization voting    │
   Resolver ───────►  - Finalization voting    │
   Channel         │  - View advancement       │
                    └──────────────────────────┘
```

**Five P2P Channels** (each with independent rate limits):

| Channel ID | Name | Rate Limit | Purpose |
|-----------|------|-----------|---------|
| 0 | Pending | 128/sec | Raw consensus messages |
| 1 | Recovered | 128/sec | Error-corrected messages |
| 2 | Resolver | 128/sec | Block fetch request/response |
| 3 | Broadcast | 8/sec | Transaction broadcast |
| 4 | Marshal | 8/sec | Certificate marshaling |

#### Application Trait

Implements `commonware_consensus::Application`:

**`propose(context, ancestry)`:**
1. Get parent block from ancestry stream
2. Compute timestamp: `max(now_millis, parent.timestamp + 1)` (strictly monotonic)
3. Return `Block::new(context, parent.digest, parent.height + 1, timestamp)`

**`verify(context, ancestry)`:**
1. Get block and parent from ancestry
2. Check `block.timestamp > parent.timestamp` (monotonicity)
3. Check `block.timestamp <= now + 500ms` (synchrony bound)

#### Storage

Two **immutable archives** using `commonware-storage`:

| Archive | Key | Value | Purpose |
|---------|-----|-------|---------|
| `finalizations-by-height` | Height | Finalization certificate | Lookup finalization proof by block height |
| `finalized-blocks` | Digest | Block | Lookup block data by SHA256 digest |

Storage constants:
- Page cache: 4KB pages, 32MB capacity (8192 pages)
- Freezer table initial size: 64KB, resizes in 64KB chunks
- Journal target: 1GB per journal file
- Compression: zstd level 3 on journal data
- Items per section: 262,144 (immutable), 4,096 (prunable)

Consensus engine state stored in a separate `{prefix}-consensus` partition.

#### Indexer Integration

The `Pusher` reporter bridges consensus activity to the indexer. On each notarization/finalization:
1. Spawn task to upload the seed immediately
2. Subscribe to marshal for the block payload
3. Once block arrives, upload `Notarized` or `Finalized` to indexer via HTTP POST

#### Testing

Integration tests use `commonware-runtime`'s **deterministic runtime** — a fully simulated execution environment with:
- Seeded RNG for reproducibility
- Simulated P2P network with configurable latency, jitter, and packet loss
- Checkpoint/restore for crash recovery testing
- Metrics polling for progress assertions

Tests include:
- **`test_good_links`**: 5 validators, 10ms latency, 100% delivery — reach height 25
- **`test_bad_links`**: 5 validators, 200ms latency, 75% delivery — still reach height 25
- **`test_1k`**: 10 validators, 1000 blocks stress test
- **`test_backfill`**: Validator joins late, syncs via backfill
- **`test_unclean_shutdown`**: Random crashes with checkpoint recovery
- **`test_indexer`**: Verifies indexer receives seeds, notarizations, and finalizations

Same seed always produces same final state (determinism guarantee).

---

### 3. `alto-validator` — Validator Node Binary

**Purpose:** The main consensus-participating binary. Loads config, initializes P2P networking, and runs the chain engine.

#### CLI

```
validator --config <path> [--hosts <path> | --peers <path>]
```
- `--config`: YAML config file (required)
- `--hosts`: AWS deployer host file (maps pubkey to IP)
- `--peers`: Local peers file (maps pubkey to socket address)

One of `--hosts` or `--peers` is required.

#### Timeouts

| Constant | Value | Purpose |
|----------|-------|---------|
| `LEADER_TIMEOUT` | 1s | Time to propose a block before view advances |
| `NOTARIZATION_TIMEOUT` | 2s | Time to collect notarization votes |
| `NULLIFY_RETRY` | 10s | Retry interval for nullification attempts |
| `ACTIVITY_TIMEOUT` | 256 views | Inactivity threshold before validator is flagged |
| `SKIP_TIMEOUT` | 32 views | Views behind before skipping ahead |
| `FETCH_TIMEOUT` | 2s | Block fetch request timeout |
| `FETCH_CONCURRENT` | 4 | Max parallel fetch requests |
| `MAX_MESSAGE_SIZE` | 1MB | P2P message size limit |
| `MAX_FETCH_COUNT` | 16 | Max blocks per fetch request |
| `MAX_FETCH_SIZE` | 512KB | Max bytes per fetch response |

#### Startup Flow

1. Parse CLI args and load YAML config
2. Decode ED25519 private key, derive public key
3. Decode BLS12-381 share and polynomial, derive threshold identity
4. Build participant set (sorted by public key)
5. Initialize tokio runtime with configured worker threads, TCP_NODELAY
6. Initialize telemetry (structured logging + Prometheus metrics endpoint)
7. Create P2P manager with authenticated discovery
8. Register 5 channels with rate limits on the P2P network
9. Optionally create indexer client
10. Build `engine::Config` and create engine
11. Configure marshal resolver (P2P-based block fetching)
12. Start engine — launches buffer, marshal, and consensus actors
13. Start P2P network
14. Wait for completion (or failure)

#### Network Configuration

- **Local mode**: `authenticated::Config::local(...)` — for testing
- **Remote mode**: `authenticated::Config::recommended(...)` — production hardened
- Binds on `0.0.0.0:{port}`, advertises detected external IP
- Bootstrappers selected from peer list for initial discovery

---

### 4. `alto-deploy` — Configuration Generator

**Purpose:** Generates all cryptographic materials and configuration files for a deployment. Supports both local development and AWS cloud deployments.

#### CLI

```
deploy generate --peers N --bootstrappers M --worker-threads T ... local --start-port P
deploy generate --peers N --bootstrappers M --worker-threads T ... remote --regions us-west-2,eu-west-1 ...
deploy explorer --dir PATH --backend-url URL local|remote
```

#### Key Generation

1. **ED25519 keys**: `PrivateKey::random(&mut OsRng)` for each peer, sorted by public key
2. **BLS12-381 threshold shares**: `bls12381_threshold::fixture::<MinSig, _>(&mut OsRng, NAMESPACE, N)` — generates N shares of a threshold scheme where any 2f+1 can sign
3. **Bootstrappers**: Randomly selected subset of peers

#### Local Output

```
output/
├── peers.yaml           # { "addresses": { "pubkey_hex": "127.0.0.1:port" } }
├── <pubkey1>.yaml       # Validator config with private_key, share, polynomial
├── <pubkey2>.yaml
├── storage/
│   ├── <pubkey1>/       # Empty storage directory
│   └── <pubkey2>/
```

Ports assigned sequentially: peer 0 gets `start_port` (P2P) and `start_port+1` (metrics), peer 1 gets `start_port+2` and `start_port+3`, etc.

#### Remote (AWS) Output

Generates `commonware-deployer` compatible configs with:
- UUID deployment tag
- Round-robin region assignment
- Graviton4-optimized Docker builds (`RUSTFLAGS="-C target-cpu=neoverse-v2"`)
- Instance configs, monitoring config, port rules
- GPS coordinates per region for the explorer map

#### Explorer Config

Generates a `config.ts` TypeScript file for the React explorer app:
```typescript
export const BACKEND_URL = "https://...";
export const PUBLIC_KEY_HEX = "<threshold-identity-hex>";
export const LOCATIONS: [[number, number], string][] = [...];
```

---

### 5. `alto-indexer` — Activity Serving Service

**Purpose:** An **in-memory** HTTP/WebSocket server that receives consensus activity from validators and serves it to clients. It is **stateless** — data lives only in RAM.

#### Data Store

```rust
pub struct State {
    seeds: BTreeMap<View, Seed>,
    notarizations: BTreeMap<View, Notarized>,
    finalizations: BTreeMap<View, Finalized>,
    finalized_height_to_view: BTreeMap<u64, View>,  // height -> view mapping
    blocks_by_digest: BTreeMap<Digest, Block>,
}
```

All data stored as ordered BTrees for efficient range queries and "latest" lookups.

#### HTTP API

| Method | Path | Request Body | Response | Purpose |
|--------|------|-------------|----------|---------|
| GET | `/health` | — | `"ok"` | Health check |
| POST | `/seed` | Binary Seed | 200/400/401 | Submit seed (verifies signature) |
| GET | `/seed/{query}` | — | Binary Seed / 404 | Get seed by "latest" or hex view |
| POST | `/notarization` | Binary Notarized | 200/400/401 | Submit notarization (verifies sig) |
| GET | `/notarization/{query}` | — | Binary Notarized / 404 | Get notarization |
| POST | `/finalization` | Binary Finalized | 200/400/401 | Submit finalization (verifies sig) |
| GET | `/finalization/{query}` | — | Binary Finalized / 404 | Get finalization |
| GET | `/block/{query}` | — | Binary Block or Finalized / 404 | Get block by "latest", hex height, or hex digest |

Query parameter formats:
- `"latest"` — most recent entry
- 8-byte big-endian hex (e.g., `0000000000000064`) — view or height index
- 32-byte hex — block digest (for `/block/` only)

#### WebSocket Protocol

**Endpoint:** `GET /consensus/ws` (upgrade to WebSocket)

**Message format:** Binary frames
```
[Byte 0: Kind (u8)]  [Bytes 1+: Encoded payload]
   0 = Seed
   1 = Notarization
   2 = Finalization
```

Broadcast channel buffer: 1024 messages. Every `submit_*` call broadcasts to all connected WebSocket clients.

#### CLI

```
indexer --port 8080 --identity <hex-bls12381-pubkey>
```

Uses `Sequential` parallelization strategy (single-threaded signature verification).

---

### 6. `alto-client` — Indexer Client SDK

**Purpose:** Rust library for querying an indexer. Used by validators (to push data), followers (to sync), and the inspector (to query).

#### Query Types

```rust
pub enum Query {
    Latest,           // Most recent
    Index(u64),       // By block height
    Digest(Digest),   // By SHA256 digest
}

pub enum IndexQuery {
    Latest,           // Most recent
    Index(u64),       // By view number
}
```

#### Client Builder

```rust
Client::builder("http://localhost:8080", identity, strategy)
    .with_verification_disabled()   // Optional: skip sig checks
    .with_tls_cert(der_bytes)       // Optional: custom CA cert
    .build()
```

HTTP/2 client with:
- TCP_NODELAY, adaptive window
- 5s connect timeout, 10s request timeout
- Keep-alive: 10s interval, 5s timeout, active while idle
- TLS via rustls with aws_lc_rs backend

#### Methods

All return `Result<T, Error>`:
- `seed_upload(seed)` / `seed_get(query)` -> `Seed`
- `notarized_upload(notarized)` / `notarized_get(query)` -> `Notarized`
- `finalized_upload(finalized)` / `finalized_get(query)` -> `Finalized`
- `block_get(query)` -> `Payload::Block(Block)` or `Payload::Finalized(Finalized)`
- `health()` -> `()`
- `listen()` -> `Stream<Item = Result<Message, Error>>` (WebSocket)

Client-side verification: when enabled, every response has its signature checked and its index/digest validated against the query.

---

### 7. `alto-follower` — Full Node (Non-Voting)

**Purpose:** Syncs and stores the finalized chain without participating in consensus. Fetches data from an indexer via HTTP/WebSocket rather than P2P.

#### Config

```yaml
source: "http://localhost:8080"        # Indexer URL
identity: "0x..."                      # BLS12-381 threshold pubkey
directory: "/data/follower"            # Storage path
worker_threads: 8
signature_threads: 4
log_level: "info"
metrics_port: 9090
mailbox_size: 1024
max_repair: 256                        # Max concurrent backfill requests
tip: true                              # Skip to latest on first run
pruning_depth: null                    # null = immutable archive, number = prune
```

#### Three-Actor Architecture

```
  WebSocket Stream              HTTP Backfill
       │                             │
 ┌─────▼─────┐               ┌──────▼──────┐
 │  Feeder   │               │  Resolver   │
 │ - Connect │               │ - Fetch by  │
 │ - Parse   │               │   height,   │
 │ - Verify  │               │   view, or  │
 │   sigs    │               │   digest    │
 │ - Report  │               │ - Dedup     │
 │   to      │               │   in-flight │
 │   marshal │               │ - Deliver   │
 └─────┬─────┘               │   to marshal│
       │                     └──────┬──────┘
       │    report Activity         │ deliver blocks
       └──────────┬─────────────────┘
           ┌──────▼──────┐
           │   Engine    │
           │ - Buffer    │
           │ - Marshal   │
           │ - Archive   │
           │ - App       │
           └─────────────┘
```

**Feeder**: Connects to indexer WebSocket, receives `Message::Notarization` and `Message::Finalization`, verifies signatures (panics on failure — fail-fast), caches blocks in marshal, reports proofs.

**Resolver**: Replaces the validator's P2P-based resolver with HTTP fetching. Maintains in-flight deduplication. Fetches blocks by digest, finalizations by height, notarizations by round.

**Engine**: Runs buffer (with noop P2P adapters), marshal, and application actors. The Application actor tracks throughput (30-second sliding window), logs sync progress with ETA, and triggers pruning every 10,000 blocks.

**Noop P2P Adapters**: `NoopSender` (all sends fail immediately), `NoopReceiver` (blocks forever) — the follower never sends or receives P2P messages.

#### Storage Modes

| Mode | `pruning_depth` | Archive Type | Use Case |
|------|-----------------|-------------|----------|
| Immutable | `null` | `immutable::Archive` | Archival node, keeps everything |
| Prunable | e.g., `100000` | `prunable::Archive` | Light node, keeps last N blocks |

Both modes store finalizations-by-height and finalized-blocks, with zstd level 3 compression.

#### Tip Skipping

When `tip: true` and storage is empty:
1. Fetch latest finalized block from indexer
2. Verify signature explicitly
3. Set marshal floor to that height
4. Begin syncing from near the tip instead of genesis

---

### 8. `alto-inspector` — CLI Debugging Tool

**Purpose:** Command-line tool for querying and monitoring chain state. Connects to an indexer.

#### CLI

```
inspector [--verbose] listen --indexer URL --identity HEX
inspector [--verbose] get <type> <query> [--indexer URL] [--identity HEX] [--prepare]
```

**Types:** `seed`, `notarization`, `finalization`, `block`

**Query formats:**
- `latest` — most recent
- `100` — by index
- `100..110` — range query (inclusive start, exclusive end)
- `0x65016f...` — by digest (block only)

**`--prepare`**: Calls `health()` before the actual request to warm up the connection for accurate latency measurement.

**`listen`**: Connects to WebSocket and logs every incoming event continuously.

Default indexer: `https://global.alto.exoware.xyz`

---

## How They All Interact — The Complete Data Flow

### Phase 1: Deployment

```
deploy generate --peers 5 --bootstrappers 2 ... local --start-port 3000
```

1. Generate 5 ED25519 keypairs (sorted by pubkey)
2. Generate BLS12-381 threshold scheme — 5 shares of one polynomial
3. Randomly select 2 bootstrappers
4. Write 5 YAML configs (one per validator) + peers.yaml
5. Create storage directories

### Phase 2: Validator Startup

Each validator binary:
1. Loads its config, decodes private key, BLS share, polynomial
2. Builds participant set from `allowed_peers`
3. Starts tokio runtime with metrics endpoint
4. Creates P2P manager, registers 5 channels
5. Creates chain engine with two storage archives
6. Starts 3 actors: buffer -> marshal -> consensus
7. Starts P2P network, connects to bootstrappers

### Phase 3: Consensus (Steady State)

Per view (round of consensus):

1. **Leader Election**: VRF seed from previous view determines leader index
2. **Block Proposal**: Leader runs `Application::propose()` — creates block with `height = parent.height + 1`, monotonic timestamp
3. **Broadcast**: Proposal sent via broadcast channel to all validators
4. **Verification**: Each validator runs `Application::verify()` — checks timestamp bounds
5. **Notarization**: Validators vote with BLS threshold shares; when 2f+1 votes collected, a Notarization certificate is formed
6. **Finalization**: Second round of voting produces Finalization certificate
7. **Storage**: Marshal archives finalization certificate (by height) and block (by digest) to immutable storage
8. **Indexer Push**: If configured, Pusher uploads seed + Notarized/Finalized to indexer via HTTP POST

Messages flow through the buffer engine (handles out-of-order delivery), to the marshal (manages certificate lifecycle), to the consensus engine (drives the protocol).

### Phase 4: Indexer Serving

The indexer receives POST requests from validators, verifies all signatures, stores in BTreeMaps, and broadcasts to WebSocket subscribers. It serves:
- HTTP GET queries for seeds, notarizations, finalizations, blocks
- WebSocket streaming of all consensus events in real-time

### Phase 5: Follower Syncing

The follower:
1. Connects to indexer WebSocket (via feeder)
2. Receives certificates in real-time, verifies signatures, feeds to marshal
3. When blocks are missing, resolver fetches them via HTTP from the indexer
4. Marshal archives finalized blocks to local storage
5. Application actor logs throughput and prunes old data if configured
6. On first start with `tip: true`, skips to latest finalized block

### Phase 6: Client Queries

The inspector or any alto-client user:
- Queries indexer REST API for specific blocks, certificates, seeds
- Connects to WebSocket for live monitoring
- Client optionally verifies all signatures locally

---

## Cryptography Summary

| Algorithm | Purpose | Where |
|-----------|---------|-------|
| **ED25519** | Validator identity, P2P authentication | Key generation in deploy, P2P auth in validator |
| **BLS12-381 MinSig** | Threshold signatures for consensus | Notarization/finalization certificates, VRF seeds |
| **SHA256** | Block content hashing | Block digest computation, block identity |
| **VRF (on BLS12-381)** | Verifiable random leader election | Consensus leader selection per view |

Threshold scheme: N validators each hold a BLS share. Any 2f+1 shares combine into a valid threshold signature (notarization or finalization). The shared polynomial's public key is the **Identity** — used by anyone to verify certificates without needing individual validator keys.

---

## Build & CI

- **Profiles**: All profiles (dev, test, bench, release) have `overflow-checks = true`. Release additionally has `lto = true` and `codegen-units = 1`.
- **Docker**: ARM64 Ubuntu 24.04 base, targets AWS Graviton4 (`neoverse-v2`)
- **CI**: Clippy, rustfmt, doc generation, full test suite, WASM build, coverage (Codecov), auto-publish to crates.io
- **Explorer**: React 19 app with Leaflet maps, uses WASM-compiled alto-types for in-browser certificate verification

---

## Key Design Decisions

1. **No reconfiguration**: `EPOCH=0`, `EPOCH_LENGTH=u64::MAX`. The validator set is fixed at deployment time. This massively simplifies the protocol.

2. **Deterministic testing**: The entire consensus stack can run in a simulated environment with seeded RNG, simulated network, and checkpoint/restore — same seed always produces same state.

3. **Separation of concerns**: Validators do consensus; indexers serve data; followers sync without voting. The indexer is stateless (in-memory only) — it can be restarted and repopulated from validators.

4. **HTTP-based follower**: Instead of a full P2P stack, the follower uses HTTP/WebSocket to sync from a trusted indexer, dramatically reducing complexity.

5. **Fail-fast signature verification**: The follower panics on invalid signatures rather than silently dropping — ensures immediate detection of data integrity issues.

6. **WASM support**: Types crate compiles to WebAssembly, enabling browser-based block explorers to independently verify all consensus proofs.

---

## Commonware Modules Reference

Alto uses **13 of 14** declared commonware crates from the [Commonware monorepo](https://github.com/commonwarexyz/monorepo), all pinned to commit `16e98b5`. Below is every module ranked by importance, with details on where and how each is used.

---

### 1. `commonware-consensus` — The Core Protocol

**What it does:** Provides the Simplex BFT consensus engine with BLS12-381 threshold VRF-based leader election.

**Where used:** `alto-chain`, `alto-types`, `alto-validator`, `alto-follower`, `alto-indexer`, `alto-client`, `alto-deploy`, `alto-inspector`

**Key components:**
- `simplex::Engine` — the actual consensus state machine (used in `chain/src/engine.rs`)
- `marshal::Actor` — marshals certificates (notarizations/finalizations) and applies them to the application (used in `chain/src/engine.rs`, `follower/src/engine.rs`)
- `Application` / `VerifyingApplication` traits — implemented by `chain/src/application.rs` to define block validation logic
- `Reporter` trait — implemented to receive finalization callbacks
- Types: `Height`, `View`, `Round`, `Epoch`, `ViewDelta`, `CertifiableBlock`, `Heightable`, `Viewable`
- `simplex::scheme::bls12381_threshold::vrf` — the specific consensus scheme used (defined in `types/src/consensus.rs`)

**Interactions:** This is the beating heart. It drives `commonware-broadcast` for message dissemination, calls into `commonware-cryptography` for signature verification, and relies on `commonware-runtime` for async execution.

---

### 2. `commonware-cryptography` — Identity & Signatures

**What it does:** Provides all cryptographic primitives — hashing, signing, verification.

**Where used:** Every crate in the workspace.

**Key components:**
- `ed25519` — validator identity keys (used in `validator/src/main.rs` for P2P authentication)
- `bls12381::MinSig` — threshold signatures for consensus (notarizations/finalizations)
- `sha256` — block content hashing (`Digest` type used everywhere as block identifier)
- `Digestible` / `Committable` traits — implemented by `Block` in `types/src/block.rs`
- `Signer` trait — used by validators to sign consensus messages

**Interactions:** Feeds into `commonware-consensus` for vote signing/verification. Used by `commonware-p2p` for authenticated connections. `commonware-math` generates the polynomial shares for BLS threshold setup.

---

### 3. `commonware-codec` — Serialization

**What it does:** Binary encoding/decoding for all wire and storage formats.

**Where used:** Every crate (67+ usages — the most used module).

**Key components:**
- Traits: `Encode`, `Read`, `Write`, `EncodeSize`, `DecodeExt`, `FixedSize`
- Varint encoding for compact representation

**Interactions:** Every type that crosses a network or storage boundary uses this. `Block`, `Seed`, `Notarization`, `Finalization` all implement codec traits. Used by `commonware-storage` for persistence and `commonware-p2p` for network messages.

---

### 4. `commonware-runtime` — Async Execution Layer

**What it does:** Abstracts the async runtime, providing both a real (tokio) and deterministic runtime.

**Where used:** `alto-chain`, `alto-validator`, `alto-follower`

**Key components:**
- `tokio::Context` / `Runner` — production runtime in validator and follower binaries
- `deterministic::Context` — used in `chain/src/lib.rs` tests for reproducible, simulated consensus runs
- Traits: `Clock`, `Spawner`, `Metrics`, `Storage`, `ThreadPooler`, `BufferPooler`
- `ContextCell` / `spawn_cell!` — managed async task handles
- `buffer::paged::CacheRef` — page cache for storage (used in `follower/src/archive.rs`)

**Interactions:** Everything async runs on this. The consensus engine, broadcast engine, P2P manager, and storage all depend on runtime traits. The deterministic variant enables full-stack integration tests without real networking.

---

### 5. `commonware-p2p` — Networking

**What it does:** Peer-to-peer authenticated networking with discovery.

**Where used:** `alto-chain`, `alto-validator`, `alto-follower`

**Key components:**
- `Manager` — the P2P network manager (initialized in `validator/src/main.rs`)
- `Sender` / `Receiver` / `Blocker` traits — message passing interfaces
- `Recipients` — target addressing for broadcasts
- `simulated::Network` / `Oracle` / `Link` — simulated network for testing (used in `chain/src/lib.rs`)
- `Ingress` — inbound message handling

**Interactions:** Carries consensus messages between validators. The `commonware-broadcast` buffered engine wraps P2P sender/receiver for reliable delivery. The follower implements `NoopSender`/`LimitedSender` adapters since it doesn't participate in consensus voting.

---

### 6. `commonware-storage` — Persistent Storage

**What it does:** Immutable archive storage for finalized blockchain data.

**Where used:** `alto-chain`, `alto-follower`

**Key components:**
- `archive::immutable::Archive` — the main storage primitive
  - In `chain/src/engine.rs`: two archives — one for blocks, one for finalization certificates
  - In `follower/src/archive.rs`: same pattern for the follower's local store
- `archive::prunable::Archive` — prunable variant used by follower when `pruning_depth` is set
- Freezer tables with ordinal indices

**Interactions:** Called by the `Reporter` implementation when blocks are finalized. Uses `commonware-runtime` for async I/O and buffer management. Data written here is what the indexer eventually serves.

---

### 7. `commonware-broadcast` — Message Buffering

**What it does:** Buffers and manages consensus message delivery.

**Where used:** `alto-chain`, `alto-follower`

**Key components:**
- `buffered::Engine` — buffers messages that arrive out-of-order or before the node is ready
- `buffered::Mailbox` — message inbox
- `buffered::Config` — buffer sizing configuration

**Interactions:** Sits between `commonware-p2p` (raw message transport) and `commonware-consensus` (protocol engine). Ensures messages aren't dropped if they arrive before the consensus engine is ready to process them.

---

### 8. `commonware-parallel` — Parallelization Strategy

**What it does:** Abstracts parallel vs sequential execution for crypto operations.

**Where used:** `alto-types`, `alto-chain`, `alto-client`, `alto-follower`, `alto-indexer`, `alto-inspector`

**Key components:**
- `Strategy` trait — generic parameter threaded through consensus and crypto
- `Sequential` — single-threaded strategy (used in CLI tools like inspector/indexer)
- Thread pool strategies for validators

**Interactions:** Parameterizes `commonware-consensus` and `commonware-cryptography` operations. Validators use thread pools for parallel signature verification; CLI tools use `Sequential` for simplicity.

---

### 9. `commonware-resolver` — Certificate Backfill

**What it does:** Resolves missing certificates and blocks when a node falls behind.

**Where used:** `alto-chain`, `alto-follower`

**Key components:**
- `Consumer` trait — implemented by `follower/src/resolver.rs` to fetch missing data
- Backfill logic for syncing to chain tip

**Interactions:** Works with `commonware-storage` to identify gaps and `commonware-p2p` (or HTTP via alto-client in follower) to fetch missing data.

---

### 10. `commonware-utils` — Utility Belt

**What it does:** Common utilities used across the stack.

**Where used:** Most crates.

**Key components:**
- `channel::mpsc` / `channel::oneshot` — async channels
- `Set` / `ordered::Set` — set data structures
- `NZU32`, `NZU64`, `NZUsize` — non-zero number types for compile-time safety
- `hex` / `from_hex` / `from_hex_formatted` — hex encoding for CLI and config
- `SystemTimeExt` — time utilities

---

### 11. `commonware-macros` — Convenience Macros

**What it does:** Procedural macros for async patterns and testing.

**Where used:** `alto-chain`, `alto-follower`, `alto-deploy`

**Key macros:**
- `select!` — labeled async select (like `tokio::select!` but with tracing labels)
- `select_loop!` — looping variant
- `test_traced!` — test harness with tracing enabled

---

### 12. `commonware-math` — Threshold Crypto Setup

**What it does:** Polynomial math for BLS threshold key generation.

**Where used:** `alto-deploy`, `alto-follower`

**Key component:** `algebra::Random` — generates random polynomials and computes shares for BLS12-381 threshold signature schemes.

**Interactions:** Used at deployment time (`deploy/src/main.rs`) to generate validator key shares. The resulting shares are consumed by `commonware-consensus` at runtime.

---

### 13. `commonware-deployer` — Deployment Tooling

**What it does:** AWS deployment configuration.

**Where used:** `alto-deploy`, `alto-validator`

**Key components:**
- `aws::Hosts` — host configuration management
- `aws::METRICS_PORT` — metrics port constant
- Authenticated P2P discovery from AWS metadata

---

### 14. `commonware-stream` — Unused

Declared in workspace dependencies but not imported by any Alto crate.

---

### Module Interaction Diagram

```
Deploy generates keys (math + cryptography)
         │
         ▼
   Validator starts
         │
    ┌────┴─────┐
    │ runtime  │  <-- async execution layer
    │ p2p      │  <-- authenticated networking
    │ broadcast│  <-- message buffering over p2p
    │ consensus│  <-- simplex BFT engine, uses broadcast + crypto
    │ storage  │  <-- archives finalized blocks
    │ resolver │  <-- backfills gaps
    └────┬─────┘
         │ finalized blocks
         ▼
   Indexer serves via HTTP/WS (codec for serialization)
         │
         ▼
   Client/Inspector queries (codec + crypto for verification)
```

The follower mirrors the validator's storage stack but replaces P2P consensus participation with HTTP-based syncing from an indexer, using the same `marshal`, `broadcast`, `resolver`, and `storage` primitives.

### Usage Statistics

| Module | Import Count | Most Used In |
|--------|-------------|-------------|
| `commonware-codec` | 67+ | Every crate (serialization boundary) |
| `commonware-consensus` | 43+ | chain, types, validator |
| `commonware-cryptography` | 38+ | types, chain, validator |
| `commonware-parallel` | 24+ | types, chain, client, follower |
| `commonware-runtime` | 22+ | chain, validator, follower |
| `commonware-utils` | 19+ | chain, validator, follower |
| `commonware-p2p` | 13+ | chain, validator |
| `commonware-macros` | 9+ | chain, follower |
| `commonware-storage` | 6+ | chain, follower |
| `commonware-broadcast` | 4+ | chain, follower |
| `commonware-resolver` | 3+ | chain, follower |
| `commonware-math` | 2+ | deploy, follower |
| `commonware-deployer` | 2+ | deploy, validator |
| `commonware-stream` | 0 | (unused) |
