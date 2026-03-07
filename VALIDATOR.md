# Validator Report

## Scope

This document describes the validator implemented by `alto-validator` and the chain engine it launches. It is based on the code in `validator/src/main.rs`, `chain/src/engine.rs`, `chain/src/application.rs`, `chain/src/indexer.rs`, `chain/src/lib.rs`, `types/src/lib.rs`, `types/src/consensus.rs`, `types/src/block.rs`, and the deployment generator in `deploy/src/main.rs`.

In Alto, a validator is the full consensus-participating node. It is responsible for:

1. Holding a validator identity key and a threshold-signing share.
2. Establishing authenticated peer-to-peer connectivity to the validator set.
3. Proposing, validating, notarizing, and finalizing blocks under Simplex BFT.
4. Persisting finalized blocks and finalization certificates.
5. Repairing missing history and helping peers recover missing blocks.
6. Optionally exporting consensus activity to an indexer for observability.

Alto currently assumes a static validator set. `types/src/lib.rs` fixes `EPOCH` to `0` and `EPOCH_LENGTH` to `u64::MAX`, so a validator never rotates into a new epoch and the threshold identity is effectively stable for the lifetime of the network.

## What the Validator Does

At a high level, an Alto validator is a networked state machine that turns authenticated peer messages into finalized blocks.

Its job is not just "sign blocks." It has several tightly coupled responsibilities:

| Responsibility | What it means in Alto |
| --- | --- |
| Node identity | Decode an ED25519 private key, derive the validator's public identity, and use it to authenticate P2P sessions. |
| Consensus identity | Decode a BLS12-381 threshold share plus the network polynomial, then derive the shared network identity used by Simplex certificates. |
| Membership | Construct the participant set from the supplied `--hosts` or `--peers` file and track that set in the P2P oracle. |
| Networking | Start authenticated discovery, register rate-limited channels, and keep direct connections to other validators. |
| Consensus | Run the Simplex engine, react to leader timeouts and notarization timeouts, and advance views without relying on synchronized clocks. |
| Block production | When selected leader, propose the next block from the parent block and the current time. |
| Block validation | Reject blocks whose timestamps do not strictly increase or that exceed the synchrony bound. |
| Persistence | Restore archives at startup and append finalized blocks plus finalization certificates as consensus progresses. |
| Recovery | Fetch missing blocks on demand through marshal's P2P resolver and retain enough history to help lagging peers catch up. |
| Observability | Export logs and Prometheus metrics, and optionally push seeds/notarizations/finalizations to an indexer. |

## Startup Path

The validator binary is deliberately thin. `validator/src/main.rs` handles environment setup and delegates most protocol work to `alto-chain`.

The startup flow is:

1. Parse `--config` plus either `--hosts` or `--peers`.
2. Load the YAML config and decode the validator's ED25519 private key.
3. Build a Commonware Tokio runtime with configured worker threads, storage directory, and `TCP_NODELAY`.
4. Initialize telemetry and bind a Prometheus metrics endpoint on `metrics_port`.
5. Load the validator topology from either:
   - `commonware_deployer::aws::Hosts` for deployed nodes, or
   - `alto_chain::Peers` for local development.
6. Decode the validator's BLS share and the shared polynomial, then derive the threshold public identity from the polynomial.
7. Configure authenticated discovery networking in either local mode or recommended production mode.
8. Authorize the participant set with `oracle.track(EPOCH.get(), participants.clone())`.
9. Register five P2P channels with quotas and backlog limits.
10. Create a signature verification strategy with `signature_threads`.
11. Optionally create an `alto_client::Client` if `config.indexer` is set.
12. Build `engine::Config` and construct the chain engine.
13. Create a P2P marshal resolver for block fetch and recovery.
14. Start both the P2P network and the engine, then wait for either task to fail.

The important architectural point is that `alto-validator` is mostly a composition root. The actual validator behavior lives in the engine actors it starts.

## Core Validator Components

The validator is composed of four major subsystems:

| Component | Source | Function |
| --- | --- | --- |
| Binary entrypoint | `validator/src/main.rs` | Loads config, runtime, topology, network, and engine. |
| Chain engine | `chain/src/engine.rs` | Wires together buffer, marshal, application adapter, reporter, and consensus engine. |
| Application | `chain/src/application.rs` | Defines genesis, block proposal, block verification, and finalized-block reporting behavior. |
| Optional indexer pusher | `chain/src/indexer.rs` | Uploads seeds, notarizations, and finalizations to an external indexer. |

### 1. Binary Entrypoint

The validator binary does these things directly:

- Decodes the ED25519 signer from `config.private_key`.
- Loads peer addresses and bootstrapper addresses.
- Decodes the threshold share from `config.share`.
- Decodes the threshold polynomial from `config.polynomial`.
- Creates authenticated P2P networking using `commonware_p2p::authenticated::discovery`.
- Registers rate-limited channels.
- Creates the chain engine and P2P-backed marshal resolver.

It does not implement consensus logic itself.

### 2. Chain Engine

`chain/src/engine.rs` turns the validator into a set of cooperating actors:

| Actor / object | Purpose |
| --- | --- |
| `buffered::Engine` | Disseminates blocks to peers with a mailbox-backed buffer. |
| `marshal::Actor` | Stores blocks and finalizations, exposes block subscriptions, repairs missing data, and serves fetches. |
| `Marshaled` application adapter | Bridges the Alto application into Commonware consensus. |
| `simplex::Engine` | Runs the actual BFT protocol. |
| `Reporters<...>` | Fan out activity to marshal and optionally to the indexer pusher. |

The validator only becomes "alive" once these actors are started together.

### 3. Application Logic

The Alto application is intentionally minimal:

- Genesis is a fixed synthetic block derived from the hardcoded string `b"commonware is neat"`.
- `propose` takes the parent block, increments height, and ensures the new timestamp is strictly larger than the parent's timestamp.
- `verify` checks that:
  - the block exists,
  - the parent exists,
  - the timestamp is strictly increasing, and
  - the timestamp is not more than 500 ms in the future.
- Finalized blocks are logged and acknowledged.

This means the validator is mostly a consensus and replication machine around a very small application state transition rule.

## What a Validator Communicates With

An Alto validator communicates with five distinct counterparties.

### 1. Other Validators

This is the validator's main communication surface.

It communicates directly with every authorized validator in the participant set. The explorer documentation in this repository also describes the intended topology: validators send consensus messages directly to every other validator rather than through a relay or gossip overlay.

The validator exchanges:

- consensus traffic used by the Simplex engine,
- block broadcast traffic,
- block recovery / fetch traffic,
- membership and connectivity state through the P2P oracle.

### 2. Bootstrappers

Bootstrappers are not a different protocol role in consensus. They are a subset of validators used to seed discovery.

At startup, the validator resolves bootstrapper public keys from config into socket addresses and passes them into authenticated discovery. After discovery succeeds, the validator still participates as a full peer in the same flat validator network.

### 3. Lagging or Recovering Peers

The validator communicates with peers that are behind tip through marshal's P2P resolver path.

This matters because the validator is not only a producer of new consensus messages. It is also a recovery source:

- it stores finalized blocks and finalization certificates,
- it serves fetch and repair traffic,
- it keeps view retention longer than the consensus activity timeout by multiplying it by `10` for the syncer path.

That retention multiplier is a concrete signal that serving lagging peers is part of the validator's intended role, not an afterthought.

### 4. Optional Indexer

If `config.indexer` is present, the validator also communicates with an external indexer over HTTP/WebSocket through `alto_client::Client`.

The indexer path is not in the safety-critical consensus loop. It is best understood as an asynchronous reporting sidecar:

- on notarization, upload the seed immediately and upload the notarized block once marshal can supply the block body;
- on finalization, upload the seed immediately and upload the finalized block once marshal can supply the block body.

Deployment code makes this optional and selective:

- in local generation, only the first validator is configured to push to the local indexer;
- in remote generation, a configured subset of validators is assigned indexer upload duties round-robin across regions.

### 5. Operator and Monitoring Stack

The validator communicates with operators indirectly through:

- logs,
- a metrics HTTP endpoint,
- the storage directory on disk.

This is how operators observe view progression, processed height, blocked peers, and node health.

## Core Functionality in Detail

### Identity and Trust Model

The validator carries two different cryptographic identities:

| Identity | Scheme | Used for |
| --- | --- | --- |
| Validator identity | ED25519 | P2P authentication and peer identity. |
| Network identity | BLS12-381 threshold scheme (`MinSig`) | Threshold notarizations, finalizations, and seed-related consensus artifacts. |

This split is fundamental to Alto's design:

- the ED25519 key identifies a specific machine / validator operator in the network;
- the BLS threshold scheme lets any quorum of validators produce a shared certificate on behalf of the network.

The validator loads a private share and the full public polynomial. From that, it can participate in threshold signing while also deriving the shared network identity exposed to clients and the explorer.

### Membership and Static Epochs

Alto currently does not implement reconfiguration. The validator therefore assumes:

- a single epoch (`EPOCH = 0`),
- an effectively infinite epoch length,
- a fixed participant set supplied at startup.

That makes validator membership a boot-time concern rather than a consensus-time concern.

One subtle implementation detail is worth documenting: the config struct includes `allowed_peers`, and deployment fills it with all validator public keys, but the live validator path authorizes peers from the `--hosts` or `--peers` topology file by building `participants` from that input and passing it into `oracle.track`. In other words, `allowed_peers` is present in generated config, but the running validator's effective peer authorization is driven by the loaded topology map.

### Consensus Participation

Once started, the validator delegates consensus execution to `commonware_consensus::simplex::Engine`.

The validator contributes to consensus in several ways:

| Function | How Alto implements it |
| --- | --- |
| Leader selection | Uses `simplex::elector::Random`. |
| Proposal creation | Uses Alto's `Application::propose`. |
| Proposal verification | Uses Alto's `Application::verify`. |
| Certificate generation | Uses the threshold signing `Scheme` created from participants, polynomial, and share. |
| View advancement | Governed by leader, notarization, activity, nullify, and skip timeouts. |
| Catch-up | Uses fetch / repair paths and retained marshal history. |

The configured constants in the validator binary define the validator's timing behavior:

| Constant | Value | Effect |
| --- | --- | --- |
| `LEADER_TIMEOUT` | 1s | Wait for a leader proposal before advancing pressure increases. |
| `NOTARIZATION_TIMEOUT` | 2s | Bound for collecting notarization progress. |
| `NULLIFY_RETRY` | 10s | Retry cadence for nullification attempts. |
| `ACTIVITY_TIMEOUT` | 256 views | Threshold for considering peers inactive. |
| `SKIP_TIMEOUT` | 32 views | Threshold for skipping ahead when behind. |
| `FETCH_TIMEOUT` | 2s | Timeout for block fetch operations. |
| `FETCH_CONCURRENT` | 4 | Parallel block fetches. |

### Proposal and Verification Rules

Alto's validator is intentionally simple at the application layer:

- every proposed block references its parent digest,
- every block height is one greater than the parent,
- timestamps must strictly increase,
- timestamps may not be more than 500 ms ahead of local time.

This means the validator is primarily enforcing ordering, ancestry, and bounded-time sanity rather than executing a complex transaction VM.

### Persistence and Recovery

The validator is stateful.

At startup it restores two immutable archives:

| Archive | Contents |
| --- | --- |
| `finalizations_by_height` | Finalization certificates indexed by height. |
| `finalized_blocks` | Finalized block bodies. |

These archives are backed by `commonware_storage::archive::immutable` and use:

- freezer tables,
- append-only journals,
- replay buffers,
- a paged cache,
- optional compression on freezer value journals.

This is what lets a validator:

- restart without replaying the entire network from scratch,
- answer fetches for old finalized blocks,
- support backfill and repair for lagging peers,
- survive unclean shutdowns.

### Block Dissemination

The validator uses a buffered broadcast engine in front of consensus storage.

The `buffered::Engine` gives the validator a separate path for disseminating blocks, while marshal and consensus deal with certification, ordering, and recovery. The split is important:

- block data propagation is not the same as certificate propagation,
- the validator can broadcast blocks while still using marshal for durable storage and subscription,
- recovery traffic does not have to share exactly the same path as hot-path block dissemination.

### Indexer Reporting

If enabled, the validator reports two classes of information:

| Artifact | When it is uploaded |
| --- | --- |
| `Seed` | Immediately on notarization or finalization event. |
| `Notarized` / `Finalized` block wrapper | After marshal can supply the corresponding block body. |

This design avoids reporting incomplete block artifacts. The validator first hears about the certificate event, then waits for marshal to hand back the block body for the proposal payload before pushing the full object.

## Commonware Modules Used by the Validator

The validator depends on Commonware in layers. Some modules are used directly by the binary, and others are used through `alto-chain`.

### Directly Visible in `alto-validator`

| Module | Why the validator uses it |
| --- | --- |
| `commonware-codec` | Decode ED25519 keys, threshold shares, and polynomials from config bytes. |
| `commonware-consensus` | Access `marshal`, `ViewDelta`, and the P2P marshal resolver setup. |
| `commonware-cryptography` | ED25519 identity keys, BLS12-381 threshold shares, and signing traits. |
| `commonware-deployer` | Read `aws::Hosts` when launched from deployer-managed infrastructure. |
| `commonware-p2p` | Authenticated discovery network, `Ingress`, channel registration, and peer manager/oracle functions. |
| `commonware-runtime` | Tokio runner, telemetry, metrics server, thread-pool-backed execution context. |
| `commonware-utils` | Hex parsing, ordered sets, namespace helpers, and non-zero numeric helpers. |

### Used by the Chain Engine the Validator Launches

| Module | Role inside the validator |
| --- | --- |
| `commonware-broadcast` | Buffered block dissemination engine. |
| `commonware-consensus` | Simplex BFT engine, marshaled application adapter, marshal actor, epoch utilities, reporter fanout. |
| `commonware-cryptography` | Threshold certificate scheme provider, SHA-256 block digests, ED25519 public keys. |
| `commonware-p2p` | Sender/receiver traits and blocker abstraction used by consensus and marshal. |
| `commonware-resolver` | Resolver trait for block fetch and repair traffic. |
| `commonware-runtime` | Spawn actors, maintain storage handles, allocate paged cache, expose metrics, provide clock and randomness. |
| `commonware-storage` | Immutable archives for finalized blocks and finalization certificates. |
| `commonware-parallel` | Signature verification / crypto work scheduling. |
| `commonware-utils` | Mailboxes, channels, ordered sets, and non-zero helpers. |

### Present in the Workspace but Not on the Validator Hot Path

`chain/Cargo.toml` still lists `commonware-stream`, but the current validator path described above does not use it. The large Commonware footprint in the workspace reflects shared infrastructure across binaries, not only the validator's active runtime path.

## Network Channels and Internal Data Paths

The validator binary registers five numeric channels before starting the engine:

| Channel ID | Name in code | Consumer |
| --- | --- | --- |
| `0` | `PENDING_CHANNEL` | Passed to consensus engine start. |
| `1` | `RECOVERED_CHANNEL` | Passed to consensus engine start. |
| `2` | `RESOLVER_CHANNEL` | Passed to consensus engine start. |
| `3` | `BROADCASTER_CHANNEL` | Passed to the buffered block broadcaster. |
| `4` | `MARSHAL_CHANNEL` | Passed to marshal's P2P resolver for block fetch / repair. |

Two observations matter:

1. Consensus traffic and block data traffic are separated rather than forced through one undifferentiated socket path.
2. Recovery is first-class. The validator allocates a dedicated resolver channel and a dedicated marshal/backfill channel instead of treating repair as an edge case.

## Operational and Design Characteristics

### Direct, Authenticated Validator Mesh

The validator uses `commonware_p2p::authenticated::discovery`, so it is designed around authenticated peer links rather than anonymous transport. Each validator knows the participant set and speaks directly to peers after discovery.

### Storage-Backed, Not Stateless

The validator writes state to the storage directory configured in the YAML file. It is not a stateless relayer. The persisted archives are part of correctness and recovery.

### Time-Sensitive but Not Clock-Driven Consensus

The application uses local time to propose and validate bounded timestamps, but the consensus design documented in this repository emphasizes advancing views based on observed quorum artifacts rather than on wall-clock synchronization alone.

### Optional External Reporting

Indexer reporting is auxiliary. Consensus continues without it, and failures in indexer upload are logged as warnings rather than treated as fatal engine errors.

## What the Validator Does Not Do

It is equally useful to define the validator by what it does not do:

- It does not implement validator reconfiguration or resharing at runtime.
- It does not execute a complex transaction interpreter or smart-contract VM.
- It does not expose a client-facing query API itself.
- It does not depend on the indexer to make progress.
- It does not use `allowed_peers` from config as the live authorization source in the current startup path.

## Evidence from Tests

The validator behavior is reinforced by the engine tests in `chain/src/lib.rs`.

The test suite covers:

| Test | What it demonstrates about validators |
| --- | --- |
| `test_good_links` | Validators converge deterministically under healthy links. |
| `test_bad_links` | Validators still converge under higher latency, jitter, and packet loss. |
| `test_1k` | Validators can sustain longer runs and reach 1000 blocks. |
| `test_backfill` | A late-joining validator can catch up through backfill / recovery. |
| `test_unclean_shutdown` | Validators recover from crashes using persisted state and checkpoints. |
| `test_indexer` | Validator activity can be exported to the indexer path. |

These tests are important because they show the validator is not just designed for the happy path. Recovery, persistence, and side-effect reporting are treated as core responsibilities.

## Bottom Line

An Alto validator is a full consensus node, not merely a signer.

Its core function is to combine:

- authenticated network membership,
- threshold cryptography,
- Simplex consensus,
- block proposal and verification,
- durable archival storage,
- repair and backfill support,
- optional observability exports,

into a single process that can both advance the chain and keep other validators synchronized.

The cleanest mental model is:

1. `alto-validator` boots the environment.
2. `alto-chain` supplies the validator's replicated state machine.
3. Commonware provides the reusable consensus, networking, cryptography, runtime, storage, and recovery machinery.

The validator is the place where all of those layers meet and become an operating blockchain node.
