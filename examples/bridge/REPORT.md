# Bridge Example Research Report

## Scope
This report covers the `examples/bridge` application in the Commonware monorepo, with emphasis on:
- Functional behavior and architecture
- Commonware primitives/modules used
- Validator responsibilities and configuration
- Indexer behavior and storage model
- Communication paths and wire protocol

## High-Level Purpose
`commonware-bridge` demonstrates cross-network interoperability by embedding succinct consensus finalization certificates from one network into blocks finalized on another network.

Each network runs its own validator set and consensus instance. Validators:
- produce local blocks,
- sometimes include a finalization certificate from the other network,
- finalize blocks through `commonware_consensus::simplex`,
- and publish finalized certificates to an external `indexer` service.

The indexer acts as a shared availability and lookup service for:
- block bodies (by digest), and
- latest known finalization certificates per network.

## Executables and Roles
The example has three binaries:

1. `dealer` (`src/bin/dealer.rs`)
- Generates BLS threshold identity + per-validator shares.
- Deterministic for demo reproducibility (`--seed`).
- Sorts participants by Ed25519 public key and maps shares by sorted order.

2. `indexer` (`src/bin/indexer.rs`)
- Authenticated stream server.
- Accepts `PutBlock`, `GetBlock`, `PutFinalization`, `GetFinalization` messages.
- Verifies finalization certificates before storage.

3. `validator` (`src/bin/validator.rs`)
- Runs authenticated p2p gossip/discovery with other validators in its network.
- Runs simplex consensus engine.
- Runs an application actor that interacts with the indexer for block availability and bridge certificates.

## Commonware Modules Used
Core modules in use:

- `commonware_consensus::simplex`
  - Main BFT consensus engine (`Engine`).
  - Round-robin leader election (`elector::RoundRobin`).
  - Threshold BLS scheme wrapper (`scheme::bls12381_threshold::standard`).
  - Consensus activity reporting (notarization/finalization/nullification).

- `commonware_cryptography`
  - Ed25519 identities for network/authentication.
  - BLS12-381 threshold primitives for finalization certificates.
  - SHA-256 payload hashing.
  - DKG/dealer support in `dealer` binary.

- `commonware_p2p::authenticated::discovery`
  - Local authenticated p2p transport for validator-to-validator consensus traffic.
  - Peer authorization/tracking for known validators.
  - Multiplexed channels for votes/certificates/resolver traffic.

- `commonware_stream::encrypted`
  - Authenticated encrypted channel used between validators and indexer.
  - Shared namespace gate (`INDEXER_NAMESPACE`) and message size/synchrony limits.

- `commonware_runtime::tokio`
  - Runtime, network listener/dialer, task spawning, storage directory integration.

- `commonware_storage` (indirectly through consensus engine/runtime)
  - Consensus log persistence in validator `--storage-dir`.
  - Enables restart/recovery from persisted state.

- `commonware_codec`
  - Custom wire-format encode/decode for bridge message types and block format.

- `commonware_parallel::Sequential`
  - Signature verification execution policy used by indexer and application for certificate checks.

- `commonware_utils`
  - Deterministic parsing/hex helpers, ordered sets, namespace byte concatenation, bounded numeric helpers.

## Data Types and Wire Protocol
Types are defined in `src/types`.

### `BlockFormat<D>`
- `Random(u128)`
- `Bridge(Finalization<Scheme, D>)`

A consensus payload digest corresponds to the hash of encoded `BlockFormat` bytes. The digest is what consensus orders; full block retrieval happens via indexer.

### Validator -> Indexer (`Inbound<D>`)
- `PutBlock { network, block }`
- `GetBlock { network, digest }`
- `PutFinalization { network, finalization }`
- `GetFinalization { network }`

### Indexer -> Validator (`Outbound<D>`)
- `Success(bool)`
- `Block(BlockFormat<D>)`
- `Finalization(Finalization<Scheme, D>)`

## Validator Internals
Validator startup flow (`validator.rs`):

1. Parse identity `--me <seed>@<port>` and derive Ed25519 signer from seed.
2. Build validator set from `--participants` (also seed-derived demo keys).
3. Parse threshold `--identity` (group polynomial/sharing) and local `--share`.
4. Connect to indexer over authenticated encrypted stream.
5. Start authenticated p2p discovery network for local consensus network.
6. Register 3 p2p channels:
- channel `0`: votes
- channel `1`: certificates
- channel `2`: resolver traffic
7. Build two schemes:
- `this_network`: signer+verifier for local threshold identity and share
- `other_network`: certificate verifier for the other network public identity
8. Create application actor mailbox and simplex engine.
9. Start p2p network + consensus engine + application loop.

### Consensus Configuration Highlights
- Leader election: deterministic round-robin.
- `leader_timeout = 1s`, `notarization_timeout = 2s`.
- `fetch_timeout = 1s`, `fetch_concurrent = 32`.
- Persistent partition name: `"log"`.
- Activity timeouts: `activity_timeout=10 views`, `skip_timeout=5 views`.

### Application Actor Behavior
The application actor (`application/actor.rs`) is the app-specific automaton adapter:

- `genesis(epoch=0)`:
  - Hashes constant `"commonware is neat"` to produce genesis payload digest.

- `propose(round)`:
  - With probability 0.5, proposes `BlockFormat::Random(u128)`.
  - Otherwise requests latest finalization from indexer for the other network.
  - Verifies received external finalization locally before use.
  - Stores chosen block in indexer via `PutBlock`.
  - Hashes encoded block and returns digest as consensus payload.

- `verify(payload)`:
  - Fetches corresponding block from indexer (`GetBlock`).
  - If random block -> valid.
  - If bridge block -> verifies embedded external finalization against `other_network` verifier.

- `report(activity)`:
  - Logs notarization/finalization/nullification.
  - On finalization, posts finalization certificate to indexer (`PutFinalization`).

The mailbox (`application/ingress.rs`) implements simplex interfaces (`Automaton`, `Relay`, `Reporter`) and forwards consensus callbacks into actor messages.

## Indexer Internals
Indexer startup flow (`indexer.rs`):

1. Parse identity `--me` and participant list for stream authentication.
2. Parse `--networks` list of threshold public identities (one per bridged network).
3. Build per-network certificate verifier map.
4. Maintain in-memory state:
- `blocks[network][digest] = BlockFormat`
- `finalizations[network][view] = Finalization`
5. Accept encrypted authenticated connections from validators.
6. Decode `Inbound` messages and process via internal channel/handler task.

Validation logic:
- `PutBlock`: accepted only for configured network; digest recomputed internally and used as key.
- `PutFinalization`: accepted only for configured network and only if certificate verifies.
- `GetFinalization`: returns latest by highest `View` (BTreeMap `next_back`).

Important property: the indexer is availability and retrieval infrastructure, not consensus authority. Validators still verify bridge certificates before acceptance.

## End-to-End Communication and Control Flow
1. Validator leader proposes payload digest.
2. Before proposal is released to consensus, validator ensures underlying block is stored on indexer.
3. Other validators receive payload digest through consensus protocol.
4. On verification, they resolve full block body from indexer and validate it.
5. If block includes bridge certificate, they verify external finalization signature against the other network public identity.
6. Once local block finalizes, validators upload that finalization to indexer.
7. Other network validators can later pull latest finalization and embed it in their own proposed blocks.

This creates bidirectional bridging through finalized certificate inclusion.

## Validator Sets and Threshold Details
- Participants are provided explicitly per network.
- Progress requires supermajority participation (in the demo docs: run at least 3 of 4 validators).
- `dealer` output contains:
  - full threshold identity polynomial,
  - network public key,
  - per-validator share.
- Validators use their share to participate in threshold signing for finalization certificates.
- `other-public` is the other network’s threshold public key used only for verification.

## Security and Trust Model (Demo)
- Validator-to-validator and validator-to-indexer channels are authenticated and encrypted.
- Indexer access is restricted to configured participant keys.
- Indexer verifies finalization signatures before storing.
- Validators do not trust indexer for correctness of bridge certificates; they re-verify locally.

Known demo simplifications:
- Indexer is centralized and in-memory (no durable indexer storage).
- Validator identities are deterministic from integer seeds.
- Threshold setup is dealer-based, not DKG/resharing.
- Block dissemination/backfill is centralized via indexer rather than p2p broadcast.

## Persistence and Recovery
- Validator consensus state persists under `--storage-dir` using runtime storage.
- Consensus can recover and continue after restart.
- Indexer state is process-memory only in this example (lost on restart).

## Practical Reading Map
Primary files for understanding behavior:
- `src/bin/validator.rs`
- `src/application/actor.rs`
- `src/application/ingress.rs`
- `src/bin/indexer.rs`
- `src/types/block.rs`
- `src/types/inbound.rs`
- `src/types/outbound.rs`
- `src/bin/dealer.rs`
- `src/lib.rs`

## Summary
`examples/bridge` is a compact interoperability demo built on simplex consensus and threshold BLS certificates. Each network finalizes local blocks, exports finality to an indexer, and imports the other network’s latest finality into future proposals. The design cleanly separates:
- consensus ordering (p2p + simplex),
- data availability/backfill (indexer),
- and application-level bridge semantics (actor + typed messages).
