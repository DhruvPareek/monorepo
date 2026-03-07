# commonware-sync Example: Deep Technical Report

## Scope

This report analyzes `examples/sync` in the Commonware monorepo, focusing on:

- Overall functionality and goals
- Commonware primitives/modules used by the example
- Client/server responsibilities
- Wire protocol and communication mechanics
- How synchronization works across `any`, `current`, and `immutable` QMDB variants
- Operational behavior, invariants, and limitations

## High-Level Purpose

`examples/sync` demonstrates continuous state synchronization from a server database to a client database using `commonware_storage::qmdb::sync`.

The server:

- Initializes a QMDB database with deterministic operations
- Continuously appends new operations over time
- Serves operation batches plus Merkle proofs
- Serves current sync targets `(root digest + operation range)`

The client:

- Connects to the server via runtime network sockets
- Requests an initial sync target
- Uses the generic QMDB sync engine to fetch and verify operation batches
- Optionally accepts target updates while syncing
- Repeats sync forever to stay aligned with the evolving server state

## Code Topology

- `examples/sync/src/bin/server.rs`
- `examples/sync/src/bin/client.rs`
- `examples/sync/src/databases/{mod.rs,any.rs,current.rs,immutable.rs}`
- `examples/sync/src/net/{mod.rs,wire.rs,resolver.rs,io.rs,request_id.rs}`
- `examples/sync/src/error.rs`
- `examples/sync/src/lib.rs`

## Primary Commonware Modules Used

### `commonware-storage` (core of the example)

- `qmdb::{any,current,immutable}`: three DB flavors exercised by the example.
- `qmdb::sync`: shared synchronization engine (`sync::sync` + `sync::engine::Config`).
- `mmr::{Proof, Location}`: operation position indexing and proof transport.
- Sync `Target<D>`: root digest and operation range to fetch.

This is the central primitive: the client verifies fetched operation ranges cryptographically against the target root.

### `commonware-runtime`

- Tokio runtime wrapper (`commonware_runtime::tokio::Runner`).
- Abstract network traits (`Network`, `Listener`, `Sink`, `Stream`) via `bind`/`dial`.
- Clock/timers for periodic tasks.
- Storage abstraction for DB backing files.
- Spawner/handles for task orchestration.
- Metrics registration and telemetry endpoint exposure.

### `commonware-stream`

- `stream::utils::codec::{send_frame, recv_frame}` for length-prefixed framing (varint prefix + payload).
- Provides message boundary framing over byte streams.

### `commonware-codec`

- Serialization/deserialization for protocol messages (`Write`, `Read`, `Encode`, `DecodeExt`, `EncodeSize`).
- Custom wire enum + message structs in `net/wire.rs`.

### `commonware-cryptography`

- SHA-256 digest/hasher types for keys/values and Merkle roots (`Hasher`, `Digest`).

### `commonware-utils`

- Async channels (`mpsc`, `oneshot`) for internal request/response routing.
- `AsyncRwLock`, `Mutex` for server state.
- Duration parsing extension (`DurationExt`).

### `commonware-macros`

- `select_loop!` and `select!` used in networking/scheduling loops.

## Database Abstraction Layer (`databases::Syncable`)

`examples/sync/src/databases/mod.rs` defines a local trait `Syncable` to normalize behavior across DB types.

It abstracts:

- Test operation generation (`create_test_operations`)
- Mutation/apply path (`add_operations`)
- Root and size introspection
- Historical proof retrieval

This keeps server/client generic at orchestration boundaries while still using the distinct APIs of each DB implementation.

### `any`

- Uses unordered fixed-value any DB.
- Root used for sync is the DB root directly.
- Operations include periodic commits (every 10 writes) and guaranteed final commit.

### `current`

- Uses current DB with activity bitmap/grafted structures.
- Important nuance: sync target root is `ops_root`, not canonical root.
- After sync, bitmap/grafted structures are reconstructed deterministically from operations.
- Proofs served are ops-level proofs (`ops_historical_proof`).

### `immutable`

- Uses immutable DB operation type (`Set` + `Commit`).
- Inactivity floor equals pruning boundary (`bounds.start`).
- Sync root is normal immutable root.

## Wire Protocol and Message Model

Protocol types are in `net/wire.rs`.

Message enum variants:

1. `GetOperationsRequest { request_id, op_count, start_loc, max_ops }`
2. `GetOperationsResponse { request_id, proof, operations }`
3. `GetSyncTargetRequest { request_id }`
4. `GetSyncTargetResponse { request_id, target }`
5. `Error { request_id, error_code, message }`

`request_id` is a monotonically increasing `u64` (`net/request_id.rs`) and is used to correlate in-flight asynchronous requests with responses.

### Constraints and validation

- Global frame/message cap: `MAX_MESSAGE_SIZE = 10 MB`.
- Proof digest count cap in response decode: `MAX_DIGESTS = 10_000`.
- `GetOperationsRequest::validate()` requires `start_loc < op_count`.
- Server additionally enforces:
  - `start_loc < db_size`
  - per-request cap `MAX_BATCH_SIZE = 100`

## Communication Stack

The effective stack for each request/response:

1. Client encodes `wire::Message` via `commonware-codec`
2. Client sends framed payload via `send_frame` (varint length prefix)
3. Runtime `Sink` writes bytes over TCP connection
4. Server `Stream` receives framed payload via `recv_frame`
5. Server decodes message, handles it, encodes response, sends frame back
6. Client decodes response and matches by `request_id`

No encryption/authentication is applied in this example path; it is plain runtime dial/bind + framed codec transport.

## Server Architecture

## Startup

`server.rs`:

- Parses CLI config (`db`, ports, intervals, storage path, etc.)
- Starts Tokio runtime with configured storage directory
- Initializes telemetry/metrics endpoint
- Dispatches to `run_any` / `run_current` / `run_immutable`

Each `run_*`:

- Builds DB config
- Initializes DB
- Calls `run_helper`

## Core loop (`run_helper`)

Server uses `select_loop!` with three concerns:

1. Periodic operation generation (`maybe_add_operations`)
2. Accepting incoming clients (`listener.accept()`)
3. Shutdown signal (`on_stopped`)

### State model

`State<DB>` stores:

- `database: AsyncRwLock<Option<DB>>`
- counters: requests, errors, ops added
- `last_operation_time`

The `Option<DB>` ownership-transfer pattern is used so async mutation (`add_operations`) can take and return DB ownership safely.

### Client connection handling

Each accepted connection spawns `handle_client` task.

`handle_client` splits behavior:

- Dedicated receive task (`recv_loop`) reads frames only
- Main send loop drains response channel and writes responses

This split intentionally avoids canceling `recv_frame` inside select branches, preventing partial-frame read corruption.

### Request handling

For each decoded inbound message:

- Spawn request handler task
- Route by message type:
  - `GetSyncTargetRequest` -> return `Target { root, range: inactivity_floor..size }`
  - `GetOperationsRequest` -> return historical proof + operations from requested position
  - unexpected message -> `Error(InvalidRequest)`

Errors are normalized to `ErrorCode` and returned as `ErrorResponse`.

## Client Architecture

## Startup

`client.rs`:

- Parses CLI config (`db`, server, batch-size, sync intervals, outstanding requests)
- Starts runtime and telemetry
- Dispatches to `run_any` / `run_current` / `run_immutable`

## Continuous sync loop

Each `run_*` executes an infinite loop with same pattern:

1. Connect resolver to server (`Resolver::connect`)
2. Request initial target (`get_sync_target`)
3. Create DB config
4. Spawn `target_update_task` (periodic target refresh)
5. Build `sync::engine::Config`
6. Call `sync::sync(config)`
7. Log success/root
8. Abort target-update task
9. Sleep `sync_interval`, repeat

`max_outstanding_requests` is passed directly to sync engine and controls parallel fetch request pressure.

## Target update behavior

`target_update_task` periodically polls `get_sync_target()`.

- If root changed, sends new target over `mpsc` update channel into sync engine.
- If channel is closed (sync done/teardown), task exits cleanly.
- If unchanged target, logs and continues.

This demonstrates syncing against moving targets while server keeps appending operations.

## Resolver + I/O Internals

`net/resolver.rs` adapts network RPC semantics to `qmdb::sync::resolver::Resolver` trait.

- For each fetch request:
  - Generate request id
  - Send request over `request_tx` to I/O task
  - Await oneshot response
  - Validate response variant
  - Return `FetchResult { proof, operations, success_tx }`

`success_tx` is provided to satisfy sync-engine API; this implementation currently discards receiver side.

### I/O task (`net/io.rs`)

I/O subsystem uses:

- Request channel (`mpsc<Request<M>>`)
- Response channel from dedicated recv task
- `pending_requests: HashMap<RequestId, oneshot::Sender<...>>`

Flow:

1. Request arrives -> store callback in `pending_requests` -> encode+send frame.
2. Response arrives -> decode -> locate callback by `request_id` -> respond oneshot.

This gives multiplexed request/response semantics over one TCP connection.

## How QMDB Sync Engine Is Used

The example uses storage’s shared sync engine (`storage/src/qmdb/sync/engine.rs`) rather than implementing custom sync logic.

Key engine properties relevant to this example:

- Accepts target `(root + range)`.
- Schedules operation fetches with bounded outstanding parallelism.
- Verifies Merkle proofs for each batch against target root.
- Stores fetched batches and applies only contiguous operations at journal tip.
- Supports target updates if update channel is provided:
  - validates updates (no backward movement, root must change, bounds valid)
  - resets sync state for new target
  - reschedules requests
- On completion:
  - syncs journal
  - constructs final DB via DB-specific conversion
  - verifies final root equals target root

This means the example’s networking is thin; correctness-critical proof validation and final root checking are in common storage sync primitives.

## End-to-End Message Sequence

1. Server starts DB and begins periodic operation generation.
2. Client connects and requests `GetSyncTarget`.
3. Client starts sync engine with returned target.
4. Sync engine issues `GetOperations` requests through resolver.
5. Server replies with `(proof, operations)` batches.
6. Client engine verifies proofs and appends valid contiguous operations.
7. Optional target updates arrive while sync is in progress.
8. Engine adapts to updated target and continues until complete.
9. Client logs successful sync root and repeats after interval.

## Metrics and Observability

Server metrics include counters for:

- requests handled
- errors
- operations added since start

Both binaries initialize runtime telemetry and expose Prometheus endpoints (`--metrics-port`).

Logging (`tracing`) is used heavily for state transitions (target updates, operation additions, sync completion, errors).

## Error Handling Model

Error types are centralized in `examples/sync/src/error.rs` and include:

- network/frame transport errors
- protocol mismatch (`UnexpectedResponse`)
- server-provided errors (`Server { code, message }`)
- channel lifecycle errors
- DB errors
- config errors

Server maps internal errors to protocol `ErrorCode`; client decodes and lifts to typed errors.

## Important Design Decisions

1. Dedicated recv loops on both server and client I/O
- Avoid cancellation of partial framed reads, preventing stream desynchronization.

2. Request/response correlation by monotonic request IDs
- Allows concurrent in-flight requests over a single channel.

3. Generic database abstraction (`Syncable`)
- Same sync orchestration across three QMDB flavors.

4. Continuous server mutation + client target updates
- Demonstrates realistic moving-target sync behavior.

5. Root verification delegated to storage sync engine
- Keeps application logic simple while preserving cryptographic integrity checks.

## Security and Production Caveats

Per README and code behavior:

- No server authentication in transport path.
- No encrypted/authenticated session in this example networking flow.
- Sync target is sourced directly from server (not from independent trusted consensus source).
- No explicit client-side rate limiting for target update polling.

So this is a correct sync mechanics demo, not a production trust model.

## What This Example Teaches Well

- How to plug a custom network resolver into `qmdb::sync`.
- How to model wire protocol with Commonware codec traits.
- How to run framed RPC-like messaging over runtime sockets.
- How to support dynamic sync targets while maintaining proof verification.
- How DB flavor differences (`any/current/immutable`) affect root/proof handling.

## Suggested Follow-Up Explorations

- Add authenticated transport path (e.g., pattern similar to chat example).
- Add target provenance from trusted consensus certificate.
- Add explicit backoff/rate-limits for target update polling.
- Extend tests to include end-to-end client/server integration under deterministic runtime.
