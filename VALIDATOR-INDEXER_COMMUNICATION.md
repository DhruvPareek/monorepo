# Validator <--> Indexer Communication

## Executive summary

In this codebase, validator/indexer communication is not a symmetric peer protocol. The validator has an optional outbound integration with an indexer, configured via `Config.indexer`. When enabled, the validator pushes consensus artifacts to the indexer over HTTP. The indexer validates, stores, and republishes those artifacts over its own HTTP and WebSocket APIs.

The important practical consequence is:

- Validator -> indexer is the only communication path used by `validator/src/main.rs`.
- Indexer -> validator is limited to ordinary HTTP response codes for those uploads.
- The richer indexer read APIs (`GET` endpoints and `/consensus/ws`) are used by other clients in this repo such as `alto-inspector` and `alto-follower`, not by the validator binary.

## The relevant crates and files

- `validator/src/main.rs`: wires validator config into the chain engine and optionally creates an `alto_client::Client`.
- `chain/src/engine.rs`: attaches an optional indexer reporter to the consensus engine.
- `chain/src/indexer.rs`: defines the validator-side indexer abstraction and the `Pusher` that uploads artifacts.
- `client/src/lib.rs`: builds the HTTP/WebSocket client used to talk to the indexer.
- `client/src/consensus.rs`: implements the concrete HTTP upload, HTTP query, and WebSocket listen methods.
- `indexer/src/main.rs`: starts the indexer service and configures the verification identity.
- `indexer/src/lib.rs`: defines the indexer state machine, HTTP routes, verification, storage, and WebSocket rebroadcast.
- `types/src/lib.rs`, `types/src/consensus.rs`, `types/src/block.rs`: define the wire-level artifact types.

## High-level flow

The live validator-to-indexer path is:

1. The validator loads `config.indexer` from YAML.
2. If present, `validator/src/main.rs` creates `alto_client::Client::new(&uri, *identity, strategy.clone())`.
3. `chain/src/engine.rs` passes that client into `engine::Config.indexer`.
4. The chain engine wraps the client in `chain::indexer::Pusher`, which implements `commonware_consensus::Reporter`.
5. When consensus reports an `Activity::Notarization` or `Activity::Finalization`, the `Pusher` spawns upload tasks.
6. The `Pusher` immediately uploads the derived `Seed`.
7. The `Pusher` then waits on `commonware_consensus::marshal::Mailbox` until it can retrieve the corresponding `Block`.
8. Once the block is available, the `Pusher` uploads either a `Notarized` or `Finalized` artifact, each of which embeds the block.
9. The indexer receives the HTTP POST, decodes the binary body, verifies the threshold signature against the configured network identity, stores the object in memory, and returns an HTTP status code.
10. After storing the artifact, the indexer also rebroadcasts it to WebSocket subscribers as a binary message prefixed by a one-byte `Kind`.

## Is the communication really bidirectional?

Not in the validator binary as written.

### What the validator actually sends

- `POST /seed`
- `POST /notarization`
- `POST /finalization`

### What the indexer actually sends back to the validator

- `200 OK` when decode + verification + storage succeed, including duplicate uploads
- `400 BAD_REQUEST` when the body cannot be decoded
- `401 UNAUTHORIZED` when the artifact fails signature verification

That is the full validator-facing response surface used by `validator/src/main.rs`.

### What exists on the indexer but is not used by the validator

- `GET /seed/{query}`
- `GET /notarization/{query}`
- `GET /finalization/{query}`
- `GET /block/{query}`
- `GET /health`
- `WS /consensus/ws`

Those routes are consumed by `alto_client`, `alto-inspector`, and `alto-follower`. They are not part of the validator’s runtime control loop.

## Message types

The validator/indexer boundary moves three logical artifact types.

### 1. `Seed`

Defined as `alto_types::Seed`, which is an alias of the Commonware threshold-VRF seed type:

- Source type: `types/src/consensus.rs`
- Alias: `pub type Seed = vrf::Seed<MinSig>;`

Purpose:

- Represents the verifiable randomness attached to a consensus view.
- Lets downstream consumers observe leader-election randomness and view progression without pulling the full consensus state.

How it is produced:

- The validator does not create an indexer-only seed object.
- Instead, the `Pusher` derives it from a notarization or finalization proof via `.seed()`.

Upload behavior:

- Uploaded for every notarization activity.
- Uploaded again for every finalization activity.
- The indexer deduplicates by view using `BTreeMap<View, Seed>`.

### 2. `Notarized`

Defined in `types/src/block.rs`:

- `pub struct Notarized { pub proof: Notarization, pub block: Block }`

Purpose:

- Carries a notarization proof together with the exact block it certifies.
- Gives clients enough data to inspect non-finalized but quorum-certified chain progress.

Integrity rules:

- Decode checks that `proof.proposal.payload == block.digest()`.
- Verification checks the threshold signature with the configured scheme.

Upload behavior:

- Only uploaded after the validator can retrieve the actual block from marshal.
- Stored by view in the indexer.
- The block is also cached by digest in the indexer.

### 3. `Finalized`

Defined in `types/src/block.rs`:

- `pub struct Finalized { pub proof: Finalization, pub block: Block }`

Purpose:

- Carries the finalization proof and the finalized block.
- Supports finalized-chain queries by view, by height, and indirectly by latest finalized state.

Integrity rules:

- Decode checks that `proof.proposal.payload == block.digest()`.
- Verification checks the threshold signature with the configured scheme.

Upload behavior:

- Only uploaded after the validator retrieves the block from marshal.
- Stored by view in the indexer.
- The block is cached by digest.
- The indexer also records `height -> view` so `GET /block/<height>` can return finalized blocks by height.

## There is no standalone block upload message

This matters operationally.

The repo explicitly documents and implements that there is no `/block` upload endpoint. Blocks reach the indexer only as part of `Notarized` or `Finalized` uploads:

- notarized path: `Notarized { proof, block }`
- finalized path: `Finalized { proof, block }`

That design is enforced in `client/src/consensus.rs`, where the code comments state that block upload is a byproduct of notarization and finalization upload.

## The exact validator-side send path

### 1. Validator startup decides whether an indexer exists

`validator/src/main.rs` loads chain config and does:

- If `config.indexer` is `Some(uri)`, create `alto_client::Client`.
- If `config.indexer` is `None`, validator/indexer communication is disabled.

So the integration is optional and completely absent unless configured.

### 2. The client is attached to the consensus engine

`chain/src/engine.rs` stores `indexer: Option<I>` in `engine::Config` and turns it into:

- `None`, or
- `Some(indexer::Pusher::new(...))`

The `Pusher` is inserted into a `commonware_consensus::Reporters<...>` fanout. This means indexer uploads are triggered by consensus reporting, not by ad hoc validator code.

### 3. Consensus emits an `Activity`

The relevant Commonware type is:

- `alto_types::Activity`
- Alias of `commonware_consensus::simplex::types::Activity`

The `Pusher` only reacts to:

- `Activity::Notarization`
- `Activity::Finalization`

It ignores all other activity variants.

### 4. The `Pusher` uploads the seed immediately

For both activity kinds, `chain/src/indexer.rs`:

- extracts `view`
- derives `seed`
- spawns an async task with `commonware_runtime::Spawner`
- calls `indexer.seed_upload(seed).await`

This path does not wait for block availability.

### 5. The `Pusher` waits for the block through marshal

Still inside `chain/src/indexer.rs`, the validator then:

- clones `commonware_consensus::marshal::Mailbox`
- calls `marshal.subscribe(Some(round), proposal.payload).await.await`

This is a key point: the validator does not upload a `Notarized` or `Finalized` object until it can pair the proof with the exact block bytes that correspond to the proof’s payload digest.

### 6. The `Pusher` uploads the composite artifact

Once marshal returns the block:

- construct `Notarized::new(notarization, block)` or
- construct `Finalized::new(finalization, block)`

Then call:

- `indexer.notarized_upload(...)`, or
- `indexer.finalized_upload(...)`

The concrete implementation of that trait is `alto_client::Client`.

### 7. `alto_client` performs the network request

`client/src/consensus.rs` implements the actual transport:

- `seed_upload` -> `POST {base}/seed`
- `notarized_upload` -> `POST {base}/notarization`
- `finalized_upload` -> `POST {base}/finalization`

The request body is the Commonware binary encoding of the artifact:

- `seed.encode().to_vec()`
- `notarized.encode().to_vec()`
- `finalized.encode().to_vec()`

The underlying transport library is `reqwest`, not a Commonware network module.

## The exact indexer-side receive path

### 1. The indexer is configured with the network identity

`indexer/src/main.rs` accepts:

- `--identity <hex-encoded BLS12-381 public key>`

It converts that identity into:

- `Scheme::certificate_verifier(NAMESPACE, identity)`

This scheme is passed into `Indexer::new(...)` and is the basis for all incoming signature verification.

### 2. Axum routes receive the request

`indexer/src/lib.rs` registers:

- `POST /seed`
- `POST /notarization`
- `POST /finalization`

Each handler:

- receives raw `Bytes`
- decodes the body into the expected artifact type
- forwards it to `indexer.submit_*`

### 3. The indexer verifies the artifact

Verification is artifact-specific:

- `submit_seed` calls `seed.verify(&self.scheme)`
- `submit_notarization` calls `notarized.verify(&self.scheme, &self.strategy)`
- `submit_finalization` calls `finalized.verify(&self.scheme, &self.strategy)`

If verification fails, the HTTP handler returns `401 UNAUTHORIZED`.

### 4. The indexer stores the artifact in memory

`indexer/src/lib.rs` uses an in-memory `State` built from `BTreeMap`s:

- `seeds: BTreeMap<View, Seed>`
- `notarizations: BTreeMap<View, Notarized>`
- `finalizations: BTreeMap<View, Finalized>`
- `finalized_height_to_view: BTreeMap<u64, View>`
- `blocks_by_digest: BTreeMap<Digest, Block>`

This indexer is intentionally stateless in the persistence sense: storage is process memory only.

### 5. The indexer rebroadcasts the artifact

After successful insertion, the indexer serializes a new binary message:

- first byte: `alto_types::Kind`
- remaining bytes: encoded artifact

The `Kind` mapping is:

- `0` = `Seed`
- `1` = `Notarization`
- `2` = `Finalization`

That binary payload is sent through:

- `tokio::sync::broadcast::Sender<Vec<u8>>`

WebSocket clients connected to `/consensus/ws` receive it as an Axum binary WebSocket frame.

## Commonware modules involved

This is the most important distinction in the design:

- Commonware is heavily used to create, validate, and internally route the artifacts.
- Commonware is not the HTTP/WebSocket transport layer between validator and indexer.

### Commonware modules on the validator side

#### `commonware_consensus::Reporter` and `commonware_consensus::Reporters`

Used in `chain/src/indexer.rs` and `chain/src/engine.rs`.

Purpose:

- Attach indexer upload logic to consensus activity emission.
- Fan out activity to multiple consumers, including marshal and the optional indexer pusher.

#### `commonware_consensus::marshal::Mailbox`

Used in `chain/src/indexer.rs`.

Purpose:

- Allows the `Pusher` to wait for the block corresponding to a notarization/finalization proof.
- Ensures the uploaded `Notarized` and `Finalized` artifacts contain the actual block, not just the certificate.

#### `commonware_runtime::{Spawner, Metrics}`

Used in `chain/src/indexer.rs`.

Purpose:

- Spawn upload tasks without blocking consensus progress.
- Label tasks for observability.

#### `commonware_parallel::Strategy`

Used throughout validator, client, and indexer code.

Purpose:

- Supplies the parallel verification strategy for threshold-signature validation.

#### `commonware_codec`

Used in types, client, and indexer code.

Purpose:

- Binary wire encoding and decoding for `Seed`, `Notarized`, `Finalized`, `Block`, and query values.

#### `commonware_cryptography`

Used through Alto’s `Scheme`, `Digest`, and verification methods.

Purpose:

- Verify threshold signatures.
- Compute and compare block digests.
- Bind the indexer to a specific consensus identity.

### Non-Commonware transport modules at the network boundary

These handle the actual bytes-on-the-wire exchange between process A and process B:

- `reqwest`: validator/client HTTP uploads and queries
- `axum`: indexer HTTP and WebSocket server
- `tokio_tungstenite`: client WebSocket handling
- `tokio::sync::broadcast`: in-process fanout from indexer state updates to WebSocket subscribers

So if the question is "which Commonware module sends the validator’s HTTP POST to the indexer?", the precise answer is: none. The upload trigger is driven by Commonware consensus/reporting, but the network transport itself is implemented with `reqwest` and `axum`.

## Transport details: how the bytes move on the wire

`alto_client::ClientBuilder` sets up two distinct transport paths:

- an HTTP client for request/response operations
- a WebSocket connector for streaming

### HTTP upload/query path

For HTTP, `client/src/lib.rs` builds a `reqwest::Client` with:

- TCP no-delay enabled
- connect timeout and request timeout
- HTTP/2 adaptive windowing
- HTTP/2 keepalive enabled while idle

So validator uploads normally travel as ordinary HTTP requests issued by `reqwest`. The code is explicitly optimized for connection reuse and multiplexing when the server and deployment path support HTTP/2.

### WebSocket stream path

For streaming, `ClientBuilder` derives the WebSocket base URI from the indexer URI:

- `http://...` -> `ws://...`
- `https://...` -> `wss://...`

`alto_client::listen()` then connects with `tokio_tungstenite` and receives binary frames from `/consensus/ws`.

### TLS support

The validator-side client supports HTTPS and WSS, including custom trusted certificates through `ClientBuilder::with_tls_cert(...)`.

The default indexer binary in `indexer/src/main.rs` does not enable TLS by itself; it binds a plain TCP listener and serves Axum directly. TLS support is demonstrated in indexer tests, which wrap the Axum app in a Rustls acceptor.

## Wire format and route details

### Upload routes used by validators

| Route | Method | Request body | Success | Failure |
| --- | --- | --- | --- | --- |
| `/seed` | `POST` | binary-encoded `Seed` | `200 OK` | `400`, `401` |
| `/notarization` | `POST` | binary-encoded `Notarized` | `200 OK` | `400`, `401` |
| `/finalization` | `POST` | binary-encoded `Finalized` | `200 OK` | `400`, `401` |

### Read routes exposed by the indexer

| Route | Method | Query form | Returned payload |
| --- | --- | --- | --- |
| `/seed/{query}` | `GET` | `latest` or hex view | `Seed` |
| `/notarization/{query}` | `GET` | `latest` or hex view | `Notarized` |
| `/finalization/{query}` | `GET` | `latest` or hex view | `Finalized` |
| `/block/{query}` | `GET` | `latest`, hex height, or hex digest | `Finalized` or `Block` |
| `/consensus/ws` | `GET` upgrade | none | binary stream of `Kind || artifact` |

### Query encoding rules

`alto_client` serializes queries as:

- `"latest"` for latest
- hex-encoded 8-byte big-endian `u64` for view/height indexes
- hex-encoded digest bytes for block digest lookup

On the indexer side, `commonware_utils::from_hex` plus `u64::decode` / `Digest::decode` are used to parse them.

## Purpose of each message

### Why send `Seed`?

- Exposes per-view VRF output.
- Lets external observers track randomness and consensus progression.
- Can arrive before the full block-bearing artifact is available.

### Why send `Notarized`?

- Exposes quorum-certified but not necessarily finalized progress.
- Lets external consumers see which block currently has notarization support.
- Carries the block itself so clients do not need a separate block fetch from validators.

### Why send `Finalized`?

- Exposes finalized chain state.
- Drives finalized block queries by latest/view/height.
- Gives downstream systems a durable canonical-chain signal.

## Ordering and timing characteristics

The upload order is intentionally staged:

1. Seed upload happens first.
2. Notarized/finalized upload happens only after marshal returns the block.

This means observers may see:

- a seed before the corresponding notarized/finalized artifact
- a notarization before a finalization for the same block/view

The code does not enforce an atomic multi-artifact transaction across those uploads.

## Duplicate and idempotent behavior

The indexer is tolerant of duplicate uploads.

- Seeds are deduplicated by `View`.
- Notarizations are deduplicated by `View`.
- Finalizations are deduplicated by `View`.

If an artifact already exists for that key, the indexer returns success rather than an error.

This is especially relevant because the validator uploads a seed for both notarization activity and finalization activity. The second upload usually becomes a no-op at the indexer.

## Security model at this boundary

### What authenticates the data

The HTTP API does not rely on validator network identity or a separate auth token. Instead, the artifact itself is authenticated cryptographically:

- `Seed` carries a threshold-VRF proof
- `Notarized` carries a threshold notarization proof
- `Finalized` carries a threshold finalization proof

The indexer verifies each artifact against the configured BLS threshold public identity.

### What is not authenticated by default

- The validator process itself is not separately authenticated at the HTTP layer.
- The indexer binary in `indexer/src/main.rs` serves plain HTTP unless deployed behind TLS or replaced with the TLS test harness pattern.
- CORS is permissive.

So the trust boundary is "accept any sender that presents a valid consensus artifact signed by the configured network identity."

## Deployment patterns

The deploy tooling shows which validators are expected to talk to an indexer.

### Local deploy

`deploy/src/main.rs` configures only the first validator to upload to the local indexer when `--indexer-port` is provided.

### Remote deploy

`deploy/src/main.rs` can assign `indexer` URLs to multiple validators when `--indexer-url` and `--indexer-count` are provided. Validators are selected in round-robin order across regions.

So in practice:

- validator/indexer communication may be absent
- or may be emitted by one validator
- or may be emitted by a selected subset of validators

It is not automatically every validator in every deployment.

## What the indexer sends onward after receiving validator uploads

Although not sent back to the validator, this is the downstream path created by validator uploads:

1. Indexer accepts validator upload.
2. Indexer stores the artifact in memory.
3. Indexer sends `Kind || encoded_artifact` to all WebSocket subscribers.
4. `alto_client::listen()` decodes the kind byte and reconstructs:
   - `Message::Seed`
   - `Message::Notarization`
   - `Message::Finalization`
5. `alto-follower` consumes those messages, verifies them, and feeds them into its own `marshal::Mailbox`.

That means the validator->indexer path is effectively the front half of a larger "validator -> indexer -> client/follower" dissemination pipeline.

## Bottom line

The validator/indexer interface in Alto is a push-only publication channel for consensus artifacts:

- trigger source: Commonware consensus activity
- validator-side internal plumbing: Commonware `Reporter`, `Reporters`, `marshal::Mailbox`, runtime spawning, codec, crypto, and parallel verification strategy
- network transport: `reqwest` HTTP POST
- indexer-side receive path: Axum route -> decode -> signature verification -> in-memory insert -> HTTP status
- downstream rebroadcast: one-byte `Kind` prefix plus encoded artifact over WebSocket

There is no validator control protocol coming back from the indexer. The indexer is a verification, indexing, and dissemination service for validator-produced consensus artifacts, not a participant in validator consensus or validator network control.
