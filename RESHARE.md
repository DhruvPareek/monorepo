# Reshare Example Overview

This document explains how `examples/reshare/` works end to end: what it does, which Commonware modules it uses, how the protocol progresses through time, which messages are exchanged, and which conditions must hold for the example to work correctly.

## Purpose

`examples/reshare/` demonstrates a blockchain-like log where consensus runs continuously across epochs while the signing committee for consensus is periodically refreshed by resharing the same underlying BLS12-381 threshold secret.

The example supports two ways to start:

- Trusted setup: shares and the public DKG output are generated locally during `setup`.
- DKG bootstrap: the network starts without shares, first runs consensus using plain Ed25519 signatures, then performs a DKG on-chain to generate the first threshold key shares.

After threshold shares exist, later epochs use BLS threshold signatures for consensus and use the finalized chain itself to carry resharing results.

## High-Level Architecture

Each node starts a single service engine composed of four major subsystems:

1. A DKG actor that manages share distribution, acknowledgements, per-epoch state, and resharing results.
2. A buffered broadcast engine that distributes proposed blocks.
3. A marshal actor that stores finalized blocks/certificates, orders finalized blocks, and reports them to the DKG actor.
4. An orchestrator that starts and stops epoch-scoped Simplex consensus engines with the correct signing scheme for each epoch.

Those pieces are wired together in [`examples/reshare/src/engine.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/engine.rs).

## Files and Responsibilities

- [`examples/reshare/src/main.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/main.rs): CLI, runtime startup, `setup`, `dkg`, and `validator` entrypoints.
- [`examples/reshare/src/setup.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/setup.rs): generates participant configs, peer configs, optional trusted threshold output, and initial shares.
- [`examples/reshare/src/validator.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/validator.rs): loads config, sets up authenticated P2P, registers channels, creates the engine.
- [`examples/reshare/src/engine.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/engine.rs): assembles DKG, broadcast, marshal, and orchestrator.
- [`examples/reshare/src/application/core.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/application/core.rs): consensus application; proposes blocks containing optional signed dealer logs.
- [`examples/reshare/src/application/types.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/application/types.rs): block format.
- [`examples/reshare/src/application/scheme.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/application/scheme.rs): scheme provider for Ed25519 or threshold BLS by epoch.
- [`examples/reshare/src/dkg/actor.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/dkg/actor.rs): core DKG/reshare protocol loop.
- [`examples/reshare/src/dkg/state.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/dkg/state.rs): persistent storage for DKG state, acks, dealings, and logs.
- [`examples/reshare/src/orchestrator/actor.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/orchestrator/actor.rs): per-epoch consensus engine lifecycle.
- [`examples/reshare/src/namespace.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/namespace.rs): root domain-separation namespace.

## Commonware Modules Used

### `commonware-consensus`

- `simplex`: Byzantine consensus engine used for the epoched log.
- `simplex::elector::RoundRobin`: deterministic leader rotation during bootstrap DKG mode.
- `simplex::elector::Random`: threshold-VRF based leader selection once threshold certificates exist.
- `marshal`: ordered finalized-block delivery plus backfill and persistent storage.
- `types::FixedEpocher`: slices the chain into fixed-size epochs.

Role in the example:

- Consensus finalizes blocks.
- Finalized blocks act as the authoritative transport for signed dealer logs.
- Epoch boundaries drive resharing completion and the next epoch’s consensus scheme.

### `commonware-cryptography`

- `ed25519`: network identity and bootstrap consensus signing.
- `bls12381::dkg`: DKG and reshare primitives.
- `bls12381::primitives::group::Share`: private threshold share held by a participant.
- `bls12381::dkg::Output`: public output of a successful DKG/reshare round.
- `certificate` schemes: used by Simplex to sign votes and verify certificates.
- `transcript`: deterministic randomness/domain separation inside DKG.

Role in the example:

- Ed25519 signs P2P traffic and bootstrap Simplex votes.
- BLS DKG creates and refreshes the threshold secret shares.
- Threshold BLS certificates become the consensus certificates in validator mode.

### `commonware-p2p`

- `authenticated::discovery`: local authenticated networking used by the real CLI.
- `utils::mux`: multiplexes logical epoch subchannels over shared physical channels.
- `Manager` / `Blocker`: peer-set tracking and blocking interface used by consensus and networking.

Role in the example:

- One physical network is divided into logical channels for votes, certificates, block broadcast, resolver traffic, marshal traffic, and DKG messages.
- DKG and consensus both use epoch-numbered mux subchannels.

### `commonware-broadcast`

- `buffered::Engine`: distributes proposed blocks and caches recent blocks by digest.

Role in the example:

- Consensus/marshal need access to uncertified blocks before they are finalized.
- Buffered broadcast handles dissemination and retrieval of recently seen blocks.

### `commonware-storage`

- `archive::immutable`: persistent finalized blocks and finalizations for marshal.
- `metadata`: per-epoch DKG state.
- `journal::segmented::variable`: append-only DKG message log for crash recovery.

Role in the example:

- DKG state survives crashes.
- Finalized chain data survives restarts and supports catch-up/backfill.

### `commonware-runtime`

- Tokio runtime in the CLI.
- Deterministic runtime in tests.

Role in the example:

- Production-like async execution in the binary.
- Fully reproducible simulation in tests.

## Startup Modes

### 1. Trusted setup mode

`cargo run --bin commonware-reshare setup`

`setup` generates:

- Ed25519 keypairs for all peers.
- A trusted BLS threshold output over the first round’s dealer set.
- Initial shares for those first-round participants.
- `participant-*.json` files and a `peers.json` file.

When nodes start in `validator` mode, each node already knows:

- its Ed25519 signing key,
- the public threshold output,
- and optionally its private share if it is active in the first epoch.

Consensus immediately uses threshold BLS.

### 2. DKG bootstrap mode

`cargo run --bin commonware-reshare setup --with-dkg`

This mode generates:

- Ed25519 identities,
- no initial threshold output,
- no initial shares.

Then nodes run the `dkg` subcommand. In that mode:

- consensus uses Ed25519,
- the DKG actor performs an initial DKG across all configured participants,
- on success, `SaveFileOnUpdate` writes the resulting public output and each node’s share into that node’s config file,
- the process intentionally stops,
- operators restart the nodes in `validator` mode,
- validator mode then switches to threshold BLS consensus and future resharing.

## Configuration Objects

### `ParticipantConfig`

Stored per node. Contains:

- `port`
- `bootstrappers`
- `output: Option<String>`
- `signing_key`
- `share: Option<Share>`

`output` is hex-encoded serialized `Output<MinSig, PublicKey>`.

### `PeerConfig`

Shared across the network. Contains:

- `num_participants_per_round: Vec<u32>`
- `participants: Set<PublicKey>`

Important behavior:

- `num_participants_per_round` cycles by round.
- `dealers(round)` picks the active participant set for that round.
- Round 0 always uses the first `n` participants in deterministic order.
- Later rounds pseudo-randomly choose `n` participants using `StdRng::seed_from_u64(round)`.

This means every node independently derives the same committee schedule from the same `peers.json`.

## Network Channels

`validator.rs` creates six logical channels:

- `VOTE_CHANNEL = 0`: Simplex vote traffic.
- `CERTIFICATE_CHANNEL = 1`: notarization/finalization traffic.
- `RESOLVER_CHANNEL = 2`: block and certificate fetch/backfill.
- `BROADCASTER_CHANNEL = 3`: block dissemination for buffered broadcast.
- `MARSHAL_CHANNEL = 4`: marshal resolver traffic.
- `DKG_CHANNEL = 5`: dealer messages and player acknowledgements.

Two extra layers matter:

1. These are separate logical channels on the authenticated P2P network.
2. Some of them are then subdivided again by epoch using `Muxer`, so epoch `e` traffic is carried on subchannel `e`.

That gives the example both transport separation by purpose and logical separation by epoch.

## Block Format

Each block contains:

- consensus `context` (`epoch`, `view`, leader, parent context),
- `parent` digest,
- `height`,
- `log: Option<SignedDealerLog<V, C>>`.

The payload is deliberately small. The only application-specific payload is the optional signed dealer log.

Genesis has:

- epoch 0,
- view 0,
- deterministic leader from `C::from_seed(0)`,
- empty parent digest,
- no dealer log.

## Consensus Scheme Selection

The application-level `Provider` maps epochs to the signing scheme used by Simplex.

### In DKG bootstrap mode

- scheme type: `EdScheme`
- participants: the current epoch’s dealer set
- signer nodes sign with their Ed25519 key
- non-participants get verifier-only schemes
- certificate verification is epoch-scoped only

### In validator/reshare mode

- scheme type: `ThresholdScheme<MinSig>`
- participants: the current epoch’s dealer set
- current dealers that still hold a valid share get signer schemes
- inactive nodes get verifier-only schemes
- an epoch-independent certificate verifier can be built from the public threshold key

That last point is important: because the threshold public key remains stable across resharing, certificates can be verified even after committee rotation.

## Actor Graph and Data Flow

At runtime the main flow is:

1. Orchestrator enters epoch `e`.
2. Orchestrator creates a Simplex engine for epoch `e` with the correct signing scheme.
3. Simplex asks the application to propose a block.
4. The application asks the DKG actor whether it has a finalized dealer log ready.
5. If yes, the log is embedded in the proposed block.
6. The block is broadcast through buffered broadcast.
7. Simplex finalizes blocks.
8. Marshal reconstructs ordered finalization and reports finalized blocks to the DKG actor.
9. The DKG actor processes finalized dealer logs, advances the DKG state machine, and at the epoch boundary computes the next output/share.
10. The DKG actor tells the orchestrator to exit epoch `e` and later enter epoch `e + 1`.

In practice, enter for the new epoch happens at the start of each DKG loop iteration, before finalized blocks for that epoch are processed.

## DKG State Machine

The DKG actor is the heart of the example.

Persistent epoch state is:

- `round`: monotonically increasing DKG round counter
- `rng_seed`: deterministic seed used to recreate dealer randomness after crash
- `output`: latest successful public output
- `share`: our latest private share, if any

Per-epoch persisted message state is:

- dealer messages we accepted,
- player acks we received,
- finalized dealer logs observed on-chain.

This split is crucial:

- metadata stores the current epoch state,
- append-only journals store protocol evidence needed to resume correctly,
- in-memory maps are rebuilt from disk on startup.

## Roles Per Epoch

For each epoch, a node may be:

- a dealer,
- a player,
- both,
- or neither.

### DKG bootstrap mode

- dealers: all configured participants
- players: `peer_config.dealers(0)`
- next players: empty

This is a one-shot initial distribution from the whole configured network to the first active committee.

### Reshare mode

For current persistent `round = r`:

- dealers = `peer_config.dealers(r)`
- players = `peer_config.dealers(r + 1)`
- next players = `peer_config.dealers(r + 2)`

Interpretation:

- the current share holders act as dealers,
- they redistribute the secret to the next epoch’s active committee,
- nodes also pre-track the following epoch’s players in the peer manager so connectivity is ready ahead of time.

## Critical Dealer-Set Conditions

Reshare mode enforces two invariants before starting the epoch:

1. At round 0, the derived dealer set must exactly equal the players in the previous output.
2. At later rounds, every derived dealer must belong to the previous output’s player set.

This is essential. Resharing requires the current dealers to come from the prior holder set; otherwise the chain would be trying to refresh a secret using nodes that do not hold valid shares.

## Peer Tracking Behavior

At the start of each epoch, the DKG actor calls the P2P manager with a peer set containing:

- current dealers,
- current players,
- next players.

This does two things:

- gives the network enough information to maintain or establish connections for the active and near-future committee,
- updates the buffered broadcast peer-set subscription so stale peers can be evicted from caches.

## DKG Messages

The DKG channel carries only two wire message types:

### `Dealer(pub_msg, priv_msg)`

Sent from a dealer to a player.

- `DealerPubMsg<V>` is public and common to all players for that dealer.
- `DealerPrivMsg` contains the player-specific private share material.

The example still sends them together over one authenticated message so the player knows which dealer sent the public message.

### `Ack(PlayerAck<P>)`

Sent from a player back to a dealer after the player accepts and commits to that dealer’s message.

The player only ever emits one ack per dealer. If it crashes and restarts, the ack is replayed from persisted state rather than recomputed differently.

## Dealer and Player Internal Behavior

### Dealer side

When a node is a dealer:

1. It creates a cryptographic dealer instance using:
   - the round info,
   - its signer,
   - its prior share if resharing,
   - deterministic RNG derived from persisted `rng_seed`.
2. The crypto dealer returns:
   - one public message,
   - one private message per player.
3. The local wrapper keeps unsent private messages in `unsent`.
4. As valid acks arrive, the corresponding player entry is removed from `unsent`.
5. At midpoint or later, the dealer finalizes and produces `SignedDealerLog`.
6. That signed log becomes eligible for inclusion in a consensus block.

### Player side

When a node is a player:

1. It validates each dealer message against the round info.
2. If valid, it persists the dealing before returning an ack.
3. It caches the ack by dealer so it never emits conflicting acknowledgements.
4. At epoch end, it finalizes using the set of finalized dealer logs from the chain.
5. On success it derives:
   - the next public `Output`,
   - its new private `Share`.

Non-players do not derive a share. They can still observe the finalized logs and derive the public output using `observe(...)`.

## Why Dealer Logs Go On-Chain

The DKG actor does not consider a dealer’s work canonical merely because the dealer finalized locally. The signed dealer log must appear in a finalized block.

This has several consequences:

- every node agrees on which dealer logs count,
- duplicate proposals are harmless because the first finalized copy wins,
- DKG completion is bound to the consensus history,
- restart recovery is simple because the chain is the source of truth.

The application intentionally does not fully verify the embedded dealer log during pre-finalization block verification. It defers processing until the block is finalized. This keeps block verification cheap at the cost of allowing invalid DKG payloads to appear in finalized blocks, which later consumers must still validate.

## Per-Epoch Phases

The epoch length is fixed at `BLOCKS_PER_EPOCH = 200`.

Using `FixedEpocher`, each finalized block falls into one of:

- `Early`
- `Midpoint`
- `Late`

The DKG actor uses those phases as follows.

### Phase A: enter epoch

At the top of the outer DKG loop:

1. Load current epoch state from persistent storage.
2. Prune state older than the previous epoch.
3. Determine dealers/players/next players.
4. Track the peer set.
5. Notify the orchestrator with `EpochTransition { epoch, poly, share, dealers }`.
6. Register an epoch-specific DKG mux subchannel.
7. Build `Info::new(...)` for the cryptographic round.
8. Create dealer/player local state if applicable.

At this point the consensus engine for that epoch is live.

### Phase B: early epoch share distribution

While finalized blocks are in the first half of the epoch:

- dealers keep sending any remaining private shares,
- players validate and ack them,
- self-dealing is handled locally without going through the network,
- valid acks and dealings are persisted immediately.

The example ties distribution to finalized-block progress rather than a wall-clock timer. Finalized blocks are the epoch clock.

### Phase C: midpoint finalization by dealers

At midpoint and beyond:

- dealers call `finalize::<N3f1>()` once,
- this produces a `SignedDealerLog`,
- future block proposals may embed that log.

The actor does not force immediate inclusion. Instead, when the application is asked to propose, it asks the DKG actor for the current finalized dealer log and includes it if present.

### Phase D: finalized blocks carry dealer logs

Whenever marshal reports a finalized block:

- the DKG actor checks whether the block contains a dealer log,
- if present, it verifies the log against the current round info,
- if valid, it persists the log for that dealer,
- if the log was our own, the actor removes its local staged copy so it does not keep proposing it.

### Phase E: end-of-epoch outcome computation

Only when the finalized block is the last block of the epoch does the actor attempt to complete the round.

If we are a player:

- finalize player state with the set of finalized logs,
- derive `(new_output, new_share)`.

If we are not a player:

- call `observe(...)` on the finalized logs,
- derive only `new_output`.

Outcome handling:

- success:
  - increment DKG round,
  - generate fresh RNG seed,
  - persist epoch `e + 1` state with new output/share,
  - emit `Update::Success { epoch, output, share }`.
- failure:
  - keep the prior round number,
  - keep the prior output/share,
  - generate fresh RNG seed,
  - persist epoch `e + 1` state,
  - emit `Update::Failure { epoch }`.

So failed epochs still advance the consensus epoch counter, but they do not advance the DKG round counter or threshold state.

## Why Failed Epochs Retry Cleanly

This is one of the most important mechanics in the example.

Consensus epochs and DKG rounds are related but not identical:

- consensus epoch always advances with chain height,
- DKG round advances only after a successful DKG/reshare.

If a round fails:

- the next consensus epoch starts,
- the DKG actor retries the same logical resharing round,
- dealer selection continues to use the same `round` value,
- the previous output/share remain authoritative.

This preserves correctness. A failed resharing attempt never partially mutates the threshold state.

## Orchestrator Behavior

The orchestrator owns the lifecycle of epoch-scoped Simplex engines.

### On `Enter(transition)`

It:

1. builds the epoch’s signing scheme from `Provider::scheme_for_epoch(...)`,
2. registers that scheme in the provider under the epoch,
3. starts a new Simplex engine scoped to that epoch,
4. registers epoch-specific subchannels on vote, certificate, and resolver muxers.

This means each epoch has its own independent consensus engine instance and its own epoch-scoped network subchannels.

### On `Exit(epoch)`

It:

1. aborts the epoch’s consensus engine,
2. unregisters the signing scheme for that epoch.

The DKG actor sends `exit` only after processing the boundary block and persisting the next epoch state.

### Catch-up hinting

The orchestrator listens to the vote mux backup channel. If it sees vote traffic from a future epoch on an unregistered subchannel, it asks marshal to ensure it has the boundary finalization for the latest epoch it knows.

This is a catch-up optimization:

- future-epoch traffic is evidence that some peers have advanced,
- marshal can then fetch the missing boundary finalization,
- once that boundary block is known, the local node can progress.

## Marshal and Deferred Application

Marshal is the finalized-order backbone:

- it receives uncertified blocks via buffered broadcast,
- it receives certificates/finalizations from Simplex,
- it persists finalized blocks and finalizations,
- it reports finalized blocks in order to the DKG actor.

The application is wrapped in `marshal::standard::Deferred`, which means:

- block build/propose remains application-defined,
- ancestry verification and parent/height checks are handled in the marshal layer,
- application verification can run asynchronously.

In this example, application verification is intentionally permissive and mainly relies on marshal for ancestry correctness.

## Broadcast Behavior

Buffered broadcast is used for proposed blocks before they are finalized.

It:

- sends blocks to peers,
- caches recent blocks by digest,
- allows subscribers to wait for blocks by digest,
- evicts cache entries tied to peer sets that are no longer tracked.

This is the mechanism marshal uses to obtain block bodies corresponding to consensus certificates.

## Persistence and Crash Recovery

The example takes recovery seriously.

### Persisted DKG state

`dkg/state.rs` stores:

- current epoch metadata,
- received dealer messages,
- received acks,
- finalized dealer logs.

### Recovery design

On restart:

- latest epoch metadata is reloaded,
- per-epoch journals are replayed into in-memory maps,
- dealer state is reconstructed and replays stored acks,
- player state is reconstructed from stored dealer messages and finalized logs,
- the actor resumes without producing conflicting messages.

This is why the code persists:

- dealings before acknowledging them,
- acks before considering them accepted,
- finalized logs once observed on-chain.

The persistent storage is not just for convenience. It is part of the protocol safety story after crashes.

## Safety and Correctness Conditions

The example assumes or enforces the following:

### 1. Shared static configuration

All nodes must have the same `peers.json`.

Otherwise they will derive different dealer sets per round and the protocol will diverge.

### 2. Monotonic peer-set tracking

Epoch IDs passed into the P2P manager are monotonically increasing and aligned with consensus epochs.

### 3. Correct dealer set for resharing

Dealers in resharing rounds must come from the previous successful output’s player set.

### 4. Sufficient synchrony inside an epoch

The example notes that resharing depends on synchrony during the DKG window. All relevant players need to be online long enough within the epoch to exchange messages and get dealer logs finalized on-chain.

### 5. Finalized chain is source of truth

Only dealer logs in finalized blocks count.

### 6. Crash recovery must be deterministic

Persisted `rng_seed` ensures a restarted dealer regenerates the same dealing instead of creating a conflicting one.

### 7. Private share storage is sensitive

`dkg/state.rs` explicitly warns that private share material is stored on disk. For a production system this would need secure-at-rest handling and secure deletion of obsolete shares.

## Example Timeline

## DKG bootstrap mode timeline

1. `setup --with-dkg` generates Ed25519 identities only.
2. Nodes start `dkg`.
3. Orchestrator starts epoch 0 Simplex with Ed25519.
4. DKG actor treats all peers as dealers and round-0 committee as players.
5. Dealers distribute shares and collect acks.
6. Dealers finalize signed logs.
7. Proposed blocks include those signed dealer logs.
8. Finalized blocks make logs canonical.
9. End of epoch computes the first public output and each player’s share.
10. `SaveFileOnUpdate` writes `output` and `share` back to each node’s config and returns `PostUpdate::Stop`.
11. Operator restarts in `validator` mode.

## Validator/reshare mode timeline

1. Node starts with public output and maybe a private share.
2. Orchestrator starts epoch 0 Simplex with threshold BLS.
3. Current share holders act as dealers for round 0.
4. Next epoch’s committee acts as players.
5. Dealer logs finalize on-chain during epoch 0.
6. At epoch 0 boundary, DKG actor computes output/share for epoch 1 state.
7. DKG actor exits epoch 0 and loops.
8. Orchestrator starts epoch 1 with the new committee and corresponding signer/verifier roles.
9. Process repeats forever.

## Why There Are Two Different Leader Electors

Bootstrap DKG mode uses `RoundRobin` because:

- there is no threshold certificate randomness yet,
- Ed25519 certificates do not provide the threshold VRF seed the random elector expects.

Validator mode uses `Random` because:

- threshold BLS certificates exist,
- their seed signatures can be used to pick unpredictable leaders after the first view.

## Test Suite Insights

The deterministic tests in [`examples/reshare/src/validator.rs`](/Users/dhruv/Documents/monorepo/examples/reshare/src/validator.rs) reveal the intended behavior clearly:

- outputs from the same epoch must match across participants,
- the system is deterministic for a fixed seed,
- epochs may fail and later retry,
- delayed participants can join later and still receive acknowledged shares,
- random crashes and full shutdown/restart scenarios are expected to recover,
- scoped epoch metrics should disappear once an epoch exits.

The tests treat failures as first-class behavior, not exceptional behavior.

## Practical Interpretation

This example is less about building a full blockchain application and more about demonstrating a control-plane pattern:

- use consensus to finalize small application payloads,
- use those payloads to drive threshold-key lifecycle,
- reconfigure the consensus committee epoch by epoch,
- separate consensus epochs from cryptographic round success,
- persist enough protocol state to survive process crashes without equivocation.

That pattern is the core lesson of `examples/reshare/`.

## Summary

`examples/reshare/` is an epoched consensus application where:

- blocks may carry signed dealer logs,
- finalized dealer logs drive DKG/reshare completion,
- the DKG actor computes next-epoch threshold state at epoch boundaries,
- the orchestrator starts a fresh epoch-specific Simplex engine using the right signing scheme,
- trusted setup mode skips the initial DKG,
- DKG bootstrap mode uses Ed25519 until the first threshold key exists,
- persistent DKG journals and metadata make crash recovery deterministic.

The main conceptual split is:

- consensus decides which dealer logs become canonical,
- cryptography turns those canonical logs into the next public output and private shares,
- orchestration turns that new threshold state into the next epoch’s consensus engine.
