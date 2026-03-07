# Follower <-> Indexer Communication

## Scope

This document describes the communication path between the `alto-follower` and the `alto-indexer` in this repository. It covers:

- What messages move between them
- Which direction those messages travel
- The on-the-wire format
- Which modules send, receive, verify, and ingest them
- How those messages are routed inside the follower after receipt
- How the indexer gets the data that it later serves to followers

The most important architectural point is this:

- The follower does **not** participate in Alto consensus P2P.
- The follower talks to the indexer only over **HTTP** and **WebSocket**.
- The actual network transport is **not** implemented with `commonware-*` modules.
- `commonware-*` modules begin at the ingestion boundary inside the follower and validator.

That split is explicit in the code:

- `follower/src/main.rs` defines a `Source` trait backed by `alto_client::Client`, which exposes `health`, `block`, `notarized`, `finalized`, and `listen`.
- `client/src/lib.rs` and `client/src/consensus.rs` implement the HTTP/WebSocket transport.
- `follower/src/feeder.rs` and `follower/src/resolver.rs` hand received data into `commonware_consensus::marshal`.
- `follower/src/main.rs` also installs `NoopSender` and `NoopReceiver` for P2P, confirming the follower is not on the consensus network.

## High-Level Summary

There are three follower/indexer interaction patterns:

| Pattern | Direction | Transport | Purpose |
| --- | --- | --- | --- |
| Health check | Follower -> Indexer | HTTP GET `/health` | Wait until the indexer is reachable |
| Live certificate feed | Follower <- Indexer | WebSocket `/consensus/ws` | Receive newly observed `Seed`, `Notarization`, and `Finalization` events |
| Backfill / repair | Follower <-> Indexer | HTTP GETs | Fetch missing blocks or certificates that marshal needs |

There is also an upstream path that is not follower-originated but matters for understanding the full system:

| Pattern | Direction | Transport | Purpose |
| --- | --- | --- | --- |
| Consensus upload | Validator -> Indexer | HTTP POSTs | Populate the indexer with `Seed`, `Notarized`, and `Finalized` artifacts |

Without that validator -> indexer upload path, the follower would have nothing useful to consume.

## Components Involved

### Network-facing components

- `alto_indexer::Api` in `indexer/src/lib.rs` exposes the HTTP and WebSocket endpoints.
- `alto_client::Client` in `client/src/lib.rs` and `client/src/consensus.rs` is the follower’s transport client.
- `reqwest` is used for HTTP requests.
- `tokio-tungstenite` is used for the WebSocket client.
- `axum` serves HTTP and WebSocket traffic in the indexer.
- `tokio::sync::broadcast` fans indexer events out to all WebSocket subscribers.

### Commonware components on the follower side

- `commonware_consensus::marshal::Actor` is the main ingestion/storage pipeline in the follower.
- `commonware_consensus::marshal::Mailbox` is how the feeder reports verified live activity.
- `commonware_consensus::marshal::ingress::handler::Handler` is how the resolver delivers fetched repair data into marshal.
- `commonware_resolver::Resolver` is implemented by the follower’s resolver handle so marshal can request missing data.
- `commonware_broadcast::buffered::Engine` exists because marshal expects a broadcast/buffer engine, but the follower wires it to `NoopSender`/`NoopReceiver`, so it is not used for network communication with the indexer.

### Commonware components on the validator side

- `chain/src/indexer.rs` defines `Pusher`, a `commonware_consensus::Reporter`.
- `Pusher` receives consensus `Activity` from the validator path, waits for the corresponding block via `marshal::Mailbox::subscribe`, and uploads complete artifacts to the indexer.

## Message Types

The wire-level message families are:

| Message | Rust type | Sent by | Consumed by | Notes |
| --- | --- | --- | --- | --- |
| Seed | `alto_types::Seed` | Validator uploads; indexer streams | Follower feeder receives but ignores after logging | Proof-only item keyed by consensus view |
| Notarization | `alto_types::Notarized` | Validator uploads; indexer streams and serves via GET | Follower feeder and resolver | Contains notarization proof plus full block |
| Finalization | `alto_types::Finalized` | Validator uploads; indexer streams and serves via GET | Follower feeder, resolver, and startup tip logic | Contains finalization proof plus full block |
| Block | `alto_types::Block` | Indexer serves only | Follower resolver | Returned only for `/block/<digest>` lookups |

The types themselves matter:

- `Block` contains consensus context, parent digest, height, timestamp, and a computed digest.
- `Notarized` is `(Notarization proof, Block)`.
- `Finalized` is `(Finalization proof, Block)`.
- `Notarized::read` and `Finalized::read` validate that the proof payload matches the embedded block digest during decoding.

Those definitions live in `types/src/block.rs`.

## On-the-Wire Formats

### HTTP request/response format

The indexer API is binary, not JSON.

- Upload bodies are `commonware_codec::Encode` output.
- Read responses are raw encoded bytes of the corresponding Alto type.
- Query selectors are path parameters, not query strings.

Path serialization rules come from `client/src/lib.rs`:

- `"latest"` means latest available item.
- Numeric view/height selectors are hex-encoded big-endian `u64`.
- Block-by-digest lookups use a hex-encoded SHA-256 digest.

### WebSocket frame format

The WebSocket stream sends binary frames with this layout:

1. First byte: `alto_types::Kind`
2. Remaining bytes: encoded payload

`Kind` is:

- `0` = `Seed`
- `1` = `Notarization`
- `2` = `Finalization`

That encoding is implemented in `indexer/src/lib.rs` and decoded in `client/src/consensus.rs`.

## API Surface Used By the Follower

### 1. Health check

Endpoint:

- `GET /health`

Follower usage:

- The follower loops on `client.health()` until the indexer responds successfully before doing anything else.

Purpose:

- Gate follower startup on indexer availability.

Implementation:

- Client: `client/src/utils.rs`
- Follower startup loop: `follower/src/main.rs`

### 2. Optional tip checkpoint

Endpoint:

- `GET /finalization/latest`

Follower usage:

- On first boot, if `tip` mode is enabled and the follower has no previously processed height, it fetches the latest finalization.
- The follower explicitly verifies that finalization and then calls `mailbox.set_floor(height)` so it starts near the current tip instead of replaying from genesis.

Purpose:

- Fast start near the chain tip.

Important detail:

- This is the one place in follower startup that directly calls `client.finalized_get(...)` instead of going through the `Source` abstraction.

### 3. Live consensus stream

Endpoint:

- `WS /consensus/ws`

Follower usage:

- `Feeder::process_stream()` opens the WebSocket by calling `Source::listen()`.
- `Feeder` reconnects forever with a 1 second delay if the stream ends or errors.

What the indexer sends:

- `Seed`
- `Notarization`
- `Finalization`

What the follower does with them:

- `Seed`: logs it and ignores it
- `Notarization`: verifies the threshold signature, caches the block with `marshal_mailbox.verified(...)`, then reports the proof with `marshal_mailbox.report(Activity::Notarization(...))`
- `Finalization`: verifies the threshold signature, caches the block with `marshal_mailbox.verified(...)`, then reports the proof with `marshal_mailbox.report(Activity::Finalization(...))`

Purpose:

- Keep the follower near real time without polling.
- Feed proofs and blocks into marshal as soon as the indexer learns about them.

Important detail:

- The follower constructs its `alto_client::Client` with verification disabled.
- For the WebSocket path, signature verification is intentionally centralized in `Feeder::handle_message`.
- Invalid streamed notarizations/finalizations panic the follower via `assert!`, which is a fail-fast trust model.

### 4. Repair and backfill fetches

Endpoints:

- `GET /block/<digest>`
- `GET /block/<height>`
- `GET /notarization/<view>`

Follower usage:

- `marshal` requests missing items through the follower’s `Resolver`, which implements `commonware_resolver::Resolver`.
- The resolver actor deduplicates in-flight fetches with `AbortablePool` and a `HashMap`.
- Depending on the request kind, it fetches:
  - raw block by digest
  - finalized block by height
  - notarized block by round/view

What the follower does with the response:

- For block-by-digest:
  - expects `Payload::Block`
  - encodes the block bytes
  - delivers them via `handler::Handler::deliver(Request::Block(...), value)`
- For finalized-by-height:
  - expects `Payload::Finalized`
  - extracts `(finalization, block)`
  - delivers them via marshal ingress as `Request::Finalized { height }`
- For notarized-by-round:
  - expects `Notarized`
  - extracts `(notarization, block)`
  - delivers them via marshal ingress as `Request::Notarized { round }`

Purpose:

- Fill gaps that the live stream alone cannot cover.
- Allow marshal to obtain missing dependencies on demand.

Important detail:

- The resolver path deliberately relies on marshal’s deliver handler for acceptance/rejection.
- The client is again created with verification disabled for this path.
- If marshal rejects a delivered artifact, the resolver logs a warning and stops.

## End-to-End Flow

### Startup Flow

1. The follower parses config and creates a certificate verifier `Scheme`.
2. It builds an `alto_client::Client` using `ClientBuilder::with_verification_disabled()`.
3. It waits on repeated `GET /health` until the indexer is up.
4. It initializes `marshal::Actor` and related storage.
5. If `tip` mode is set on an empty store, it fetches `GET /finalization/latest`, verifies it, and sets marshal’s floor.
6. It starts:
   - the resolver actor
   - the follower engine
   - the feeder

### Live Stream Flow

1. Validators upload new artifacts to the indexer.
2. The indexer verifies and stores them.
3. The indexer serializes each artifact as `[kind byte][encoded payload]`.
4. The indexer pushes that binary frame into `tokio::sync::broadcast`.
5. Each WebSocket subscriber gets the same frame from `/consensus/ws`.
6. `alto_client::Client::listen()` decodes the frame into `Message::Seed`, `Message::Notarization`, or `Message::Finalization`.
7. `Feeder::handle_message()` performs the follower-side verification and forwards accepted items into `marshal`.

### Backfill / Repair Flow

1. Marshal determines it is missing a block or certificate.
2. Marshal uses the follower’s `commonware_resolver::Resolver` implementation to request that item.
3. The resolver actor translates the request into one of the HTTP GETs above.
4. The indexer returns the binary payload.
5. The resolver repackages that payload into the form expected by marshal ingress.
6. `handler::Handler::deliver(...)` forwards it to marshal.
7. Marshal accepts or rejects it.

### Upstream Population Flow (Why the Indexer Has Data)

This is not follower -> indexer traffic, but it is required context.

1. Validator consensus emits `alto_types::Activity`.
2. `chain::indexer::Pusher`, which implements `commonware_consensus::Reporter`, receives that activity.
3. For notarization/finalization activity, it:
   - derives and uploads the `Seed`
   - waits for the full block via `marshal::Mailbox::subscribe(...)`
   - builds `Notarized` or `Finalized`
   - uploads the result via `alto_client::Client`
4. The indexer verifies, stores, and broadcasts the uploaded artifact.

This explains why the indexer’s stream contains full `Notarized` and `Finalized` objects rather than just bare proofs.

## Commonware Modules and Their Actual Roles

This is the part that is easy to get wrong if you only skim the code.

### Modules directly involved in follower/indexer transport

Strictly speaking: none.

The follower/indexer wire transport is built from:

- `reqwest`
- `tokio-tungstenite`
- `axum`
- `tokio::sync::broadcast`

### Commonware modules that receive or route data after transport

`commonware_consensus::marshal::Mailbox`

- Used by `Feeder` to inject already-verified live-stream data.
- Methods used:
  - `verified(round, block)`
  - `report(Activity::Notarization(...))`
  - `report(Activity::Finalization(...))`

`commonware_consensus::marshal::ingress::handler::Handler`

- Used by `Resolver` to deliver fetched repair data into marshal.
- Method used:
  - `deliver(request, bytes)`

`commonware_consensus::marshal::Actor`

- The core consumer of both live-stream and repair-path data.
- Owns follower persistence and canonicalization logic.

`commonware_resolver::Resolver`

- The trait marshal talks to when it needs missing data.
- Implemented by `follower/src/resolver.rs`.

`commonware_broadcast::buffered::Engine`

- Present because marshal expects the broader consensus buffering substrate.
- In the follower it is wired to `NoopSender` and `NoopReceiver`.
- It is therefore **not** used for the follower/indexer network link.

`commonware_consensus::Reporter`

- Used on the validator side, not the follower side, by `chain::indexer::Pusher`.
- This is the commonware hook that causes consensus activity to be uploaded into the indexer in the first place.

## Message-by-Message Breakdown

### `Seed`

Direction:

- Validator -> Indexer via `POST /seed`
- Indexer -> Follower via WebSocket

Follower handling:

- The follower logs the view and does nothing else.

Purpose:

- Preserve the seed stream for clients that care about it.
- Keep the WebSocket stream faithful to the activity the indexer receives.

Practical note:

- The current follower does not use streamed seeds to drive state.

### `Notarized`

Direction:

- Validator -> Indexer via `POST /notarization`
- Indexer -> Follower via WebSocket
- Indexer -> Follower via `GET /notarization/<view>` during repair

Follower handling:

- Live stream path:
  - verify threshold signature
  - cache block in marshal
  - report notarization proof to marshal
- Repair path:
  - fetch binary `Notarized`
  - split into `(proof, block)`
  - deliver to marshal ingress

Purpose:

- Let the follower learn about blocks that are certified enough to be worth caching.
- Reduce future repair work by inserting the block before finalization arrives.

### `Finalized`

Direction:

- Validator -> Indexer via `POST /finalization`
- Indexer -> Follower via WebSocket
- Indexer -> Follower via `GET /finalization/latest` for checkpoint selection
- Indexer -> Follower via `GET /block/<height>` during repair

Follower handling:

- Startup tip path:
  - fetch latest finalization
  - verify it
  - set marshal floor
- Live stream path:
  - verify threshold signature
  - cache block in marshal
  - report finalization proof to marshal
- Repair path:
  - fetch `Payload::Finalized`
  - split into `(proof, block)`
  - deliver to marshal ingress

Purpose:

- Advance the follower’s finalized chain.
- Provide a checkpoint anchor for fast startup.
- Let marshal complete finalized-chain repair when there are gaps.

### `Block`

Direction:

- Indexer -> Follower via `GET /block/<digest>`

Follower handling:

- Resolver delivers the raw encoded block to marshal as `Request::Block(digest)`.

Purpose:

- Fetch a block body when marshal knows the digest but not the contents.

## Indexer Internal Storage and Why It Matters to Communication

The indexer stores data in memory in `BTreeMap`s:

- seeds by `View`
- notarizations by `View`
- finalizations by `View`
- finalized height -> view
- blocks by digest

Communication consequences:

- `latest` is implemented by taking the largest key in the relevant `BTreeMap`.
- `/block/<height>` works only for finalized heights because the indexer keeps a `finalized_height_to_view` map.
- `/block/<digest>` can return any stored block, including blocks learned through notarization uploads.
- Duplicate uploads are idempotent at the storage layer: if the keyed certificate already exists, the indexer returns success without rebroadcasting a new logical item.

## Reliability and Failure Semantics

### Follower-side behavior

- Health checks retry forever.
- The WebSocket feeder reconnects forever with a 1 second backoff.
- Invalid streamed notarizations/finalizations panic the follower.
- Resolver fetch failures are warnings, not panics.
- Marshal rejection of resolver-delivered data is treated as a warning and the item is dropped.

### Indexer-side behavior

- Upload endpoints return:
  - `200 OK` on success
  - `400 BAD_REQUEST` on decode failure
  - `401 UNAUTHORIZED` on signature verification failure
- Read endpoints return:
  - `200 OK` with binary body on success
  - `404 NOT_FOUND` if the item is absent

### Trust model

- The follower trusts the indexer enough to connect to it and consume its stream.
- It does **not** trust it enough to skip cryptographic verification.
- The validation point differs by path:
  - WebSocket live path: `follower/src/feeder.rs`
  - Repair path: marshal ingress inside `commonware_consensus`
  - Tip checkpoint path: explicit check in `follower/src/main.rs`

## What the Follower Does Not Do

- It does not send consensus votes, proposals, or repair requests over P2P.
- It does not POST seeds/notarizations/finalizations back to the indexer.
- It does not use the indexer’s `/seed/<view>` endpoint today.
- It does not use `commonware_p2p` for the follower/indexer connection.

## Key Code References

These are the most important implementation anchors for this topic:

- `follower/src/main.rs:52-121`
  - `Source` trait, showing the follower’s abstract interface to the indexer
- `follower/src/main.rs:226-303`
  - follower startup, verification policy, tip checkpoint, resolver startup, feeder startup
- `follower/src/feeder.rs:21-29`
  - statement of feeder purpose and verification responsibility for the WebSocket path
- `follower/src/feeder.rs:72-89`
  - WebSocket connection loop and reconnect behavior
- `follower/src/feeder.rs:97-162`
  - exact handling of `Seed`, `Notarization`, and `Finalization`
- `follower/src/resolver.rs:90-98`
  - statement of resolver purpose and verification policy for the repair path
- `follower/src/resolver.rs:137-178`
  - resolver actor loop, deduplication, cancel/clear/retain handling
- `follower/src/resolver.rs:200-279`
  - mapping from marshal requests to HTTP fetches and marshal ingress delivery
- `follower/src/engine.rs:93-107`
  - follower installs buffered engine with noop P2P adapters
- `follower/src/engine.rs:114-150`
  - marshal initialization inside the follower
- `client/src/lib.rs:15-42`
  - query serialization rules for `latest`, hex-encoded indices, and digests
- `client/src/lib.rs:74-158`
  - client construction, TLS, and optional verification disabling
- `client/src/consensus.rs:55-225`
  - HTTP upload/download methods and binary response decoding
- `client/src/consensus.rs:228-333`
  - WebSocket client, `Kind` decoding, and message deserialization
- `client/src/utils.rs:8-20`
  - health-check request
- `indexer/src/lib.rs:54-70`
  - seed verification, storage, and broadcast
- `indexer/src/lib.rs:85-113`
  - notarization verification, storage, and broadcast
- `indexer/src/lib.rs:128-159`
  - finalization verification, storage, and broadcast
- `indexer/src/lib.rs:174-205`
  - block lookup semantics for latest, height, and digest
- `indexer/src/lib.rs:227-239`
  - full HTTP/WebSocket route table
- `indexer/src/lib.rs:247-353`
  - request handlers and WebSocket fanout loop
- `chain/src/indexer.rs:97-207`
  - validator-side reporter that uploads seeds, notarizations, and finalizations
- `types/src/lib.rs:36-60`
  - `Kind` discriminant used on the WebSocket wire format
- `types/src/block.rs:108-199`
  - `Notarized` and `Finalized` structure and decode-time proof/block consistency checks

## Bottom Line

Follower/indexer communication is intentionally simple:

- The indexer is an HTTP/WebSocket serving layer.
- The follower is a read-only consumer of that serving layer.
- Live chain progress arrives over a WebSocket stream of binary-encoded consensus artifacts.
- Missing dependencies are repaired with binary HTTP GETs.
- Once data crosses the transport boundary, `commonware_consensus::marshal` and `commonware_resolver` take over.

The cleanest mental model is:

1. Validators push signed Alto artifacts into the indexer.
2. The indexer stores them and republishes them over HTTP/WebSocket.
3. The follower consumes those artifacts and hands them into marshal.
4. Marshal decides what is canonical, what is missing, and what must be repaired.
