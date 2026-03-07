# Follower

## Purpose

The `follower` binary is a non-validator node for an alto chain. Its job is to track the finalized chain, persist finalized data locally, and stay near tip without participating in consensus. It does not propose blocks, cast votes, aggregate threshold signatures, or gossip with validator peers. Instead, it follows a trusted data source, currently an alto indexer exposed over HTTP and WebSocket.

At a high level, the follower exists to answer a simpler problem than a validator:

- ingest consensus outputs instead of producing them
- verify finality-related data before accepting it
- repair gaps when data arrives out of order or is missing
- store the finalized chain on disk
- optionally prune old finalized history
- expose operational progress through logs and Prometheus metrics

The implementation lives in the `follower` crate and is centered around the same `commonware-consensus` marshal pipeline that validators use, but without the consensus engine itself.

## What The Follower Does

The follower combines four responsibilities:

1. `Live certificate following`
   It opens a WebSocket stream to the configured `source` and listens for consensus messages. Seed messages are observed but ignored for storage purposes. Notarizations and finalizations are verified and then forwarded into marshal.

2. `Gap repair and backfill`
   If marshal needs a block or certificate that is not available locally, the follower resolves the missing item from the source over HTTP. This is how the follower catches up from genesis, repairs missing blocks after reconnects, and fills holes caused by out-of-order delivery.

3. `Finalized archive maintenance`
   Finalization certificates and finalized blocks are written to local archive storage. The follower can keep the full history or prune old finalized sections when `pruning_depth` is configured.

4. `Progress tracking`
   A lightweight application actor receives finalized blocks from marshal, computes blocks-per-second throughput, estimates ETA to tip when possible, logs progress, and triggers periodic pruning requests.

## What The Follower Does Not Do

The follower is intentionally narrower than a validator:

- It does not run `commonware-consensus::simplex::Engine`.
- It does not maintain validator peer connections.
- It does not broadcast proposals, notarizations, or finalizations.
- It does not sign consensus messages.
- It does not produce new chain state transitions.
- It does not expose a serving API like the indexer does.

This design keeps the follower operationally lighter than a validator while still giving it strong local verification and persistence semantics.

## Startup And Lifecycle

The startup path in `follower/src/main.rs` is:

1. Parse YAML config and decode the threshold public identity.
2. Start the `commonware-runtime` tokio runner with on-disk storage and telemetry.
3. Build an `alto-client` for the configured source.
4. Wait for the source health check to succeed.
5. Create the follower engine, which initializes storage and marshal state.
6. If `tip: true` and the local archive is empty, fetch the latest finalized block, verify it, and set marshal's floor so the follower begins near tip instead of replaying from genesis.
7. Start the resolver actor.
8. Start the engine, which starts the buffer, marshal, and application actors.
9. Start the feeder, which streams certificates into marshal.
10. Exit fatally if any of the engine, feeder, or resolver tasks stops unexpectedly.

Two details matter here:

- The follower only uses `tip` on the first run, when `last_processed_height == 0`.
- The HTTP/WebSocket client is created with verification disabled because verification is deliberately done at the follower's ingestion points instead of inside the client.

## Actor Topology

The follower is built as a small actor graph:

| Component | Role |
| --- | --- |
| `main` | Runtime bootstrap, configuration, health loop, actor wiring |
| `Engine` | Creates the buffer, marshal actor, archive storage, and application actor |
| `Feeder` | Streams consensus messages from the source and forwards verified proofs into marshal |
| `Resolver::Actor` | Fetches missing blocks/certificates from the source on marshal's behalf |
| `marshal::Actor` | Owns certificate/block lifecycle, applies finality, drives repair, and reports updates |
| `Application` | Consumes finalized blocks, logs throughput, and requests pruning |
| `Archive` wrappers | Store finalizations by height and finalized blocks by digest |

The important architectural point is that the follower still trusts marshal to be the center of truth for finalized-chain ingestion. The feeder and resolver are adapters around marshal, not replacements for it.

## Core Data Flow

### 1. Live Stream Path

The feeder connects to the source's WebSocket endpoint and processes messages continuously:

- `Seed`
  Logged at trace level and otherwise ignored.
- `Notarization`
  Threshold signature is verified with the configured chain identity. The block is cached in marshal as a verified block for that round, and the notarization proof is reported to marshal.
- `Finalization`
  Threshold signature is verified. The block is cached in marshal, and the finalization proof is reported to marshal.

If the stream disconnects, the feeder logs the condition, sleeps for one second, and reconnects. This makes the follower tolerant of transient source outages.

### 2. Repair Path

Marshal may discover that it is missing data needed to advance finalized processing. When that happens, it talks to the follower's `Resolver` implementation, which forwards requests to the resolver actor. The actor then fetches the requested item over HTTP:

- block by digest
- finalized block by height
- notarized block by round/view

The fetched payload is encoded and delivered to marshal's ingress handler. If marshal rejects it, the follower logs a warning and abandons that fetch. In-flight fetches are deduplicated, and the actor supports cancel, clear, and retain operations so marshal can manage repair work efficiently.

### 3. Finalization Application Path

Once marshal has enough information to finalize a block, it emits an `Update::Block` to the application actor. The application:

- records throughput over a 30-second sliding window
- logs current height, known tip, blocks-per-second, and ETA
- acknowledges processing back to marshal
- every 10,000 blocks, optionally asks marshal to prune below `height - pruning_depth`

This application is intentionally minimal. The code explicitly notes that a real downstream application could index transactions, update state, or serve queries at this point.

## Who The Follower Communicates With

### External communication

The follower communicates with one external system: the configured `source`.

In practice this is an alto indexer, and the follower uses it in two ways:

- `HTTP`
  Health checks and point lookups for blocks, notarizations, and finalizations.
- `WebSocket`
  Continuous subscription to consensus events.

The follower does not communicate directly with validators in normal operation.

### Internal communication

Internally, the follower has several channels:

- feeder -> marshal mailbox
- marshal -> resolver trait -> resolver actor
- resolver actor -> marshal ingress handler
- marshal -> application reporter mailbox

These channels are bounded using the configured `mailbox_size`.

### Operational communication

The follower also communicates with operators and monitoring systems through:

- structured logs
- Prometheus metrics on `metrics_port`
- persisted archive data in `directory`

## Verification Model

The follower is not a blind replica. It verifies consensus certificates before accepting them, but the verification is placed carefully:

- `Feeder path`
  Notarizations and finalizations from the WebSocket stream are verified in `Feeder::handle_message`.
- `Resolver path`
  Resolved certificates are verified by marshal's deliver path before being accepted.
- `Tip checkpoint path`
  The latest finalized block used for `tip: true` is explicitly verified before `set_floor`.

The `alto-client` is intentionally constructed with verification disabled so that verification happens exactly where the follower consumes the data. The code treats invalid certificates as fatal and uses `assert!` in the feeder and checkpoint path. In other words, an invalid certificate from the source is considered a source-integrity failure, not a recoverable condition.

## Storage Model

The follower persists two finalized data sets:

- `Certificates`
  Finalization certificates keyed by height.
- `Blocks`
  Finalized blocks keyed by digest, with archive indexing by height.

Storage behavior depends on `pruning_depth`:

- `None`
  Use immutable archives optimized for append-only retention of the full finalized history.
- `Some(depth)`
  Use prunable archives so old sections can be reclaimed.

The archive layer also creates a shared paged cache that marshal uses for its own internal prunable stores. This means the follower is not just dumping files to disk; it is using the same storage abstractions as the validator-side chain engine, adapted for follower needs.

## Why The Follower Still Uses A Buffer

The follower does not participate in peer-to-peer broadcast, but it still constructs a `commonware-broadcast::buffered::Engine`. That looks surprising until you see the dependency chain: marshal expects to run alongside the buffered engine. To satisfy that contract without joining the network, the follower provides:

- `NoopSender`
  All sends are dropped.
- `NoopReceiver`
  `recv` never returns.

So the follower keeps the buffer layer only because marshal depends on the same actor wiring used elsewhere in the stack, not because the follower actually gossips data.

## Tip Mode

`tip: true` is a catch-up optimization, not a permanent operating mode. On a fresh archive:

- the follower fetches the latest finalized block from the source
- verifies the finalization certificate
- sets marshal's floor to that height

This tells marshal not to insist on replaying the chain from genesis before processing live updates. If the follower already has local state, `tip` does nothing and normal resume behavior applies.

## Failure And Recovery Characteristics

The follower is designed to recover from availability failures but not from integrity failures.

Recoverable conditions:

- source not yet reachable at startup
- WebSocket disconnects
- fetch failures for particular repairs
- source returning a payload that does not match the requested shape

Fail-fast conditions:

- invalid notarization signature from the live stream
- invalid finalization signature from the live stream
- invalid finalization used for the initial tip checkpoint

This is a deliberate trust model: the source may be temporarily unavailable, but it must not lie.

## Commonware Modules Used By The Follower

The follower directly depends on the following `commonware` crates in `follower/Cargo.toml`.

| Module | How the follower uses it |
| --- | --- |
| `commonware-consensus` | The most important dependency. Supplies `marshal::Actor`, marshal ingress handling, update reporting, consensus types like `Height`, `Round`, `ViewDelta`, and the follower's finality-processing pipeline. |
| `commonware-broadcast` | Provides the buffered engine required by marshal. The follower instantiates it with dummy networking adapters because it does not actually broadcast. |
| `commonware-cryptography` | Supplies ED25519 keys for buffer identity plumbing, SHA-256 digest types, and certificate verification infrastructure for threshold notarizations/finalizations. |
| `commonware-runtime` | Supplies the tokio runtime wrapper, task spawning, clocks, metrics support, storage hooks, and paged buffer/cache integration. |
| `commonware-storage` | Backs the immutable and prunable archive implementations used for finalized blocks and finalizations. |
| `commonware-resolver` | Defines the resolver trait that marshal uses to request missing data; the follower implements that trait by translating repair requests into HTTP fetches. |
| `commonware-parallel` | Provides the execution strategy abstraction used for signature verification. The follower uses both `Sequential` and a runtime-created strategy for verification work. |
| `commonware-utils` | Supplies channels, acknowledgements, numeric helpers, hex parsing, abortable pools, and time helpers used across bootstrap and actor messaging. |
| `commonware-codec` | Encodes and decodes blocks and certificate payloads for storage and resolver delivery into marshal. |
| `commonware-p2p` | Used only for interface compatibility with the buffered engine. The follower implements noop sender/receiver types rather than joining the validator network. |
| `commonware-macros` | Provides the `select!` and `select_loop!` helper macros used in task coordination. |
| `commonware-math` | Used narrowly for the randomness trait bound needed when generating a dummy key for the buffer engine. |

Two nuances are worth calling out:

- `commonware-consensus` is still the architectural center even though the follower does not run consensus.
- `commonware-p2p` is present, but only as a compatibility shim rather than a real networking layer.

## Relationship To Other Alto Components

The follower sits between the validator world and downstream consumers:

- `Validators`
  Produce the consensus certificates and blocks, but the follower does not talk to them directly.
- `Indexer`
  Acts as the follower's source of truth for live consensus events and repair fetches.
- `Follower`
  Reconstructs and persists the finalized chain locally.
- `Downstream application logic`
  Could be attached to the follower's application actor if someone wanted indexing, query serving, or state execution on top of finalized blocks.

This makes the follower a replication and persistence node, not a consensus node and not a public serving node.

## Concise Mental Model

The simplest accurate description of the follower is:

> A follower is a local finalized-chain replica that reuses alto's marshal and storage machinery, follows a trusted indexer over HTTP/WebSocket, verifies consensus certificates at ingestion time, repairs gaps on demand, and never participates in validator consensus.

## Primary Source Files

- `follower/src/main.rs`
- `follower/src/engine.rs`
- `follower/src/feeder.rs`
- `follower/src/resolver.rs`
- `follower/src/application.rs`
- `follower/src/archive.rs`
- `follower/README.md`
- `ARCHITECTURE.md`
