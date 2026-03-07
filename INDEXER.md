# INDEXER

This document describes the `alto` Indexer as implemented in this repository. It is based on the code in `indexer/`, plus the validator, client, follower, explorer, and type definitions that produce or consume Indexer data.

## Executive Summary

The Indexer is Alto's HTTP/WebSocket bridge around consensus output.

It does not participate in consensus, does not maintain its own blockchain state machine, and does not speak validator-to-validator P2P. Instead, it accepts already-produced consensus artifacts from validators, verifies them against the network threshold identity, stores them in memory, and serves them back to external consumers.

In practical terms, the Indexer has five core jobs:

1. Accept signed consensus artifacts from validators.
2. Verify those artifacts before indexing them.
3. Organize them by view, height, and digest for lookup.
4. Expose them over a simple HTTP API.
5. Stream new activity over WebSocket to clients such as the local explorer and follower.

## What The Indexer Is

The Indexer is a stateless, in-memory service in `indexer/src/lib.rs` with a small CLI entrypoint in `indexer/src/main.rs`.

When started, it is given the network's threshold public key identity:

```bash
indexer --port 8080 --identity <hex-encoded BLS12-381 public key>
```

That identity is turned into an Alto/Commonware certificate verifier:

- namespace: `alto_types::NAMESPACE`
- scheme: `alto_types::Scheme::certificate_verifier(...)`

From that point on, the Indexer treats every inbound seed, notarization, and finalization as untrusted input until its signature verifies against that scheme.

## What The Indexer Is Not

The Indexer is intentionally narrow.

It is not:

- a validator
- a consensus engine
- a storage/archive node
- a P2P relay
- a database-backed query service
- a replayable event log with durable history

This distinction matters. Alto's validators produce consensus. The Indexer only republishes consensus output in a more convenient format for tools and read-only consumers.

## End-To-End Role In The System

At a high level, the data path looks like this:

```text
validators
  -> simplex consensus produces seeds / notarizations / finalizations
  -> chain::indexer::Pusher observes consensus activity
  -> alto-client uploads artifacts over HTTP to the Indexer
  -> Indexer verifies and stores artifacts in memory
  -> consumers query over HTTP or subscribe over WebSocket
```

The main surrounding actors are:

- `validator`: optionally configured to upload consensus output to an Indexer
- `chain::indexer::Pusher`: adapts consensus activity into upload calls
- `alto-client`: the shared transport/client crate used by validators, followers, inspectors, and other consumers
- `follower`: uses the Indexer as its HTTP/WebSocket source of blocks and certificates
- `inspector`: queries and listens to the Indexer for debugging and analysis
- `explorer`: in local mode, connects to the Indexer WebSocket and query endpoints

## The Artifact Model

The Indexer handles four Alto data types:

### 1. Seed

A `Seed` is the VRF output that drives leader selection for a view. It is keyed by consensus view.

The Indexer stores seeds separately because they are a first-class piece of consensus progress, and tools such as the explorer want to visualize them independently from notarizations and finalizations.

### 2. Notarized

`Notarized` is a bundle of:

- a notarization proof
- the corresponding block

The type itself enforces that the proof payload matches the block digest when decoding. The Indexer verifies the threshold signature before accepting it.

### 3. Finalized

`Finalized` is a bundle of:

- a finalization proof
- the corresponding block

Like `Notarized`, it ties a proof to a concrete block and verifies that relationship at decode time and signature verification time.

### 4. Block

The Indexer never accepts a standalone block upload. Blocks enter the Indexer as a byproduct of notarization and finalization uploads.

This is an important design choice:

- the Indexer only serves blocks that arrived attached to a certificate
- digest lookups can return blocks that were seen via notarization or finalization
- height lookups only work for finalized blocks, because only finalization establishes canonical height-to-view mapping in the Indexer

## How Data Reaches The Indexer

Validators do not push raw consensus internals directly into the Indexer crate. Instead, Alto uses a small adapter layer in `chain/src/indexer.rs`.

`chain::indexer::Pusher` implements `commonware_consensus::Reporter` and observes consensus `Activity`.

When it sees:

- `Activity::Notarization`
- `Activity::Finalization`

it does two things:

1. It uploads the corresponding seed immediately.
2. It waits for the block body from `marshal`, then uploads a `Notarized` or `Finalized` bundle.

That means the Indexer receives:

- seeds as soon as the relevant activity is observed
- notarized/finalized block bundles only after the block payload is available

This is why the Indexer API can serve both certificates and blocks while still remaining outside the validator's internal consensus loop.

## Internal State And Indexing Strategy

The Indexer keeps all state in a single `State` struct behind `Arc<RwLock<_>>`.

Its in-memory indexes are:

- `seeds: BTreeMap<View, Seed>`
- `notarizations: BTreeMap<View, Notarized>`
- `finalizations: BTreeMap<View, Finalized>`
- `finalized_height_to_view: BTreeMap<u64, View>`
- `blocks_by_digest: BTreeMap<Digest, Block>`

This yields a few important behaviors:

- latest lookups are cheap because `BTreeMap::last_key_value()` gives the highest indexed view
- finalized blocks can be found by height because finalizations populate `finalized_height_to_view`
- any indexed block can be found by digest, regardless of whether it arrived through notarization or finalization
- all state disappears on restart

The README is explicit that this is a local-use, stateless implementation and should be adapted to use a database for production.

## Core Functionality In Detail

### Ingestion

The Indexer exposes these write and liveness endpoints:

- `POST /seed`
- `POST /notarization`
- `POST /finalization`
- `GET /health`

For each upload, it:

1. Decodes the request body using Alto/Commonware codec types.
2. Verifies the signature against the configured threshold identity.
3. Stores the artifact if it was not already present.
4. Broadcasts the accepted artifact to WebSocket subscribers.

If decode fails, the API returns `400 Bad Request`.

If signature verification fails, the API returns `401 Unauthorized`.

Duplicate inserts are treated as success. The Indexer is intentionally idempotent at the artifact level.

If an artifact already exists in the relevant map, the Indexer returns success and does not emit a second WebSocket broadcast for that duplicate.

### Query

The Indexer exposes read endpoints for:

- seeds by view or `latest`
- notarizations by view or `latest`
- finalizations by view or `latest`
- blocks by digest
- finalized blocks by height or `latest`

A few subtle points matter:

- `GET /block/latest` returns the latest `Finalized` bundle, not a bare block
- `GET /block/<height>` also returns a `Finalized` bundle
- `GET /block/<digest>` returns a bare `Block`
- view and height queries are hex-encoded on the wire by `alto-client`

So the block endpoint is really two query modes under one path:

- canonical-chain mode by finalized height
- object lookup mode by block digest

### Streaming

The Indexer also exposes:

- `WS /consensus/ws`

Every accepted artifact is encoded as:

- 1 byte of `Kind`
- followed by the artifact bytes

where `Kind` is:

- `0`: seed
- `1`: notarization
- `2`: finalization

The WebSocket stream is push-only and live-only:

- subscribers receive newly accepted artifacts
- subscribers do not get a replay of historical state on connect

This behavior comes from the use of a `tokio::sync::broadcast` channel in front of the WebSocket handler.

## Who The Indexer Communicates With

The Indexer communicates with different classes of peers for different reasons.

### Upstream Producers

These are the processes that send data into the Indexer:

- validators configured with an Indexer URL
- specifically, validator-side `alto-client` instances created in `validator/src/main.rs`
- the `chain::indexer::Pusher` reporter inside the validator engine

In local deployment generation, the first validator is configured to push to the local Indexer. In remote deployment generation, a selectable subset of validators is configured to push to the Indexer URL in round-robin fashion across regions.

### Downstream Read Consumers

These are the processes that read indexed data:

- `alto-inspector`
- `alto-follower`
- any custom program using `alto-client`
- the local `alto-explorer`
- browsers or scripts hitting the raw HTTP API directly

### What It Does Not Communicate With

The Indexer does not directly talk to:

- validator P2P peers
- Commonware broadcast channels
- Commonware storage archives
- Commonware resolver
- the blockchain application/state transition logic

Those components live on the validator or follower side, not inside the Indexer process.

## Commonware Modules Used Directly By The Indexer

The `alto-indexer` crate depends directly on a small set of Commonware crates.

### `commonware-codec`

This is the serialization boundary for the whole service.

The Indexer uses it to:

- decode request bodies
- encode HTTP responses
- compute encoded sizes for WebSocket framing
- decode fixed-size numeric and digest queries from hex

Without `commonware-codec`, the Indexer would not know how to parse or emit Alto artifacts.

### `commonware-consensus`

The Indexer uses consensus-facing types, especially `View` and `Viewable`, to organize artifacts by consensus view.

It does not run a consensus engine itself, but it indexes consensus output using consensus-native coordinates.

### `commonware-cryptography`

This is central to the Indexer's trust model.

The Indexer uses Commonware cryptography to:

- verify seed signatures
- verify notarization threshold signatures
- verify finalization threshold signatures
- digest blocks and key them by hash

If a certificate does not verify against the configured threshold identity, the Indexer rejects it.

### `commonware-parallel`

Threshold signature verification is parameterized over a Commonware strategy.

The library type is generic over `S: Strategy`, and the standalone `indexer` binary instantiates it with `Sequential`.

This means the Indexer uses the same verification interface as the rest of Alto, while keeping the standalone server simple.

### `commonware-utils`

This is used mainly for hex parsing and small helper functionality.

In practice it powers:

- parsing the startup identity from CLI input
- parsing hex query strings in the HTTP API

## Commonware Modules Used By The Broader Indexing Pipeline

If the question is "what Commonware modules make the Indexer possible in Alto end-to-end," the answer is slightly broader than the Indexer crate itself.

### `commonware-consensus`

On the validator side, consensus activity is the source material that gets indexed. `Reporter` and `marshal` are what let Alto observe a notarization/finalization and pair it with the corresponding block.

### `commonware-runtime`

The validator-side pusher and follower-side feeder/resolver run inside Commonware runtime tasks. The Indexer itself uses `tokio` and `axum`, but the components that feed and consume it are integrated into Commonware runtime infrastructure.

### `commonware-resolver`

The follower uses a resolver actor to fetch missing blocks and certificates from the Indexer over HTTP, replacing the validator's normal P2P repair path.

### `commonware-storage`

This is not used by the Indexer crate, but it is the obvious missing piece if you want a production-grade Indexer. The current implementation loses state on restart because it does not persist artifacts.

## Security And Trust Model

The Indexer is not trusted because it is an API server. It is trusted only insofar as it can present valid threshold-certified artifacts.

The design has multiple verification layers:

- the Indexer verifies uploads before accepting them
- `alto-client` verifies fetched and streamed artifacts by default
- the follower intentionally disables client-side verification and instead verifies at its own ingestion points
- the local explorer verifies inbound WebSocket artifacts in the browser using WASM

This means consumers are not required to trust the Indexer's honesty about Alto consensus output. They can independently validate the signatures.

## Operational Characteristics And Limitations

The current Indexer implementation makes several deliberate tradeoffs.

### In-Memory Only

All indexed state is stored in RAM. Restarting the process clears all seeds, notarizations, finalizations, digest mappings, and finalized height mappings.

### No Historical Replay On Subscribe

The WebSocket endpoint only emits new artifacts that arrive after subscription. A consumer that wants history must query HTTP endpoints separately.

### No Authentication Or Fine-Grained Authorization

The Axum router is wrapped in permissive CORS, and the default server is just an HTTP service. There is no uploader authentication beyond certificate verification on artifact contents.

### No Built-In TLS Termination

The standalone binary binds a plain TCP listener. TLS, if desired, must be added outside this binary or by adapting the service.

### No Database, Pagination, Or Rich Query Language

The API is deliberately minimal:

- point lookups by view
- point lookups by height
- point lookups by digest
- live push stream

It is optimized for tooling and local observability, not for archival analytics workloads.

## Why The Indexer Exists

Without the Indexer, every read-only consumer would need to speak validator internals directly:

- consensus protocol messages
- internal actor mailboxes
- storage formats
- repair/resolver paths

The Indexer gives Alto a much cleaner separation:

- validators focus on producing consensus
- the Indexer focuses on republishing verified artifacts
- clients, followers, explorers, and debugging tools consume a stable read API

That separation is the real function of the Indexer. It turns consensus output into a queryable and streamable interface without putting consensus itself behind an opaque trusted backend.

## Bottom Line

The Alto Indexer is a verification-aware adapter layer between consensus producers and external readers.

Its essential behavior is:

- receive threshold-certified consensus artifacts
- verify them against the network identity
- index them in memory by view, height, and digest
- expose them over HTTP and WebSocket

Its essential limitation is equally important:

- it is not the source of truth for consensus, only a republisher of already certified output

That is why the implementation is small, stateless, and mostly concerned with verification, indexing, and transport rather than consensus execution or durable blockchain storage.
