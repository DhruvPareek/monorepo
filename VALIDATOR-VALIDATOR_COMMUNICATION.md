# Validator-to-Validator Communication in Alto

## Scope

This report describes how Alto validators communicate with each other at runtime, with emphasis on:

- what message families exist
- which `commonware` modules send and receive them
- how messages travel across the stack
- what each message is for
- how Alto separates consensus metadata from full block transport

The analysis is based on the Alto workspace and the pinned `commonware` monorepo revision in `Cargo.toml`:

- Alto repo paths such as `validator/src/main.rs`, `chain/src/engine.rs`, and `types/src/*`
- Commonware checkout at `~/.cargo/git/checkouts/monorepo-9732103c47eb4665/16e98b5`

## Executive Summary

Alto validators do **not** run a single monolithic "consensus message" protocol. They run five application channels over one authenticated P2P transport:

| Channel | Alto constant | Main payload family | Main purpose |
| --- | --- | --- | --- |
| `0` | `PENDING_CHANNEL` | `simplex::Vote` | Raw validator votes |
| `1` | `RECOVERED_CHANNEL` | `simplex::Certificate` | Recovered quorum certificates |
| `2` | `RESOLVER_CHANNEL` | resolver request/response messages | Fetch missing consensus certificates |
| `3` | `BROADCASTER_CHANNEL` | full `alto_types::Block` | Disseminate block bodies |
| `4` | `MARSHAL_CHANNEL` | marshal backfill request/response messages | Fetch blocks and block+certificate bundles |

The most important design choice is this:

1. Consensus messages usually carry only a **proposal digest**, not the full block.
2. The full block body is disseminated separately through the buffered broadcaster.
3. If a validator missed a block or certificate, one of two resolver paths repairs the gap.

So, when Alto "proposes a block", the network behavior is really:

1. the leader broadcasts the **full block** on channel 3
2. validators vote on a **digest-backed proposal** on channel 0
3. validators broadcast recovered **certificates** on channel 1
4. validators use channels 2 and 4 to backfill whatever they missed

## Core Modules and Their Roles

### 1. `commonware_p2p::authenticated::discovery`

This is the transport layer Alto uses in `validator/src/main.rs`.

What it does:

- establishes authenticated encrypted peer connections
- discovers peers from bootstrapper information
- multiplexes application traffic by channel id
- enforces per-channel rate limits
- supports message priority

Why it matters:

- every validator-to-validator message eventually becomes a `Payload::Data` message in this layer
- discovery itself also has its own control-plane chatter such as bit vectors and peer info gossip

Important Alto wiring:

- `authenticated::Network::new(...)`
- `oracle.track(EPOCH.get(), participants.clone()).await`
- `network.register(channel_id, quota, backlog)`

### 2. `commonware_consensus::simplex::Engine`

This is Alto's consensus protocol engine. It internally runs three actors:

- `Batcher`
- `Voter`
- `Resolver`

What it does:

- accepts votes and certificates
- verifies or batch-verifies them
- aggregates votes into certificates
- drives view changes, leader timeouts, notarization, nullification, and finalization

### 3. `commonware_broadcast::buffered::Engine`

This is the block dissemination layer.

What it does:

- best-effort broadcast of full block bodies
- caches recently seen blocks by commitment/digest
- lets other components subscribe to or retrieve blocks when they arrive later

Why it matters:

- consensus only knows block digests
- validators still need the actual block body before they can verify and build on it

### 4. `commonware_consensus::marshal::Actor`

This is the bridge between consensus certificates and actual chain data.

What it does:

- stores notarizations and finalizations
- stores finalized blocks
- matches certificates with blocks
- drives application delivery of finalized blocks
- serves and requests backfill data

### 5. `commonware_resolver::p2p::Engine`

This is the generic request/response fetch layer used twice:

- once by simplex resolver for missing consensus certificates
- once by marshal resolver for missing blocks or block+certificate bundles

What it does:

- sends requests to selected peers
- handles retries and timeouts
- blocks peers that answer with invalid data

## The Five Validator Channels

`validator/src/main.rs` registers five P2P channels and hands them into `alto_chain::engine::Engine`.

### Channel 0: `PENDING_CHANNEL`

Payload:

- `commonware_consensus::simplex::types::Vote<S, D>`

Concrete vote variants:

- `Notarize`
- `Nullify`
- `Finalize`

Sender path:

- `simplex::actors::voter::Actor::broadcast_vote(...)`

Receiver path:

- remote `simplex::Batcher`

Purpose:

- carry raw validator votes before a quorum certificate has been assembled

Why the name "pending":

- these votes are still pending aggregation and possibly pending signature batch verification

### Channel 1: `RECOVERED_CHANNEL`

Payload:

- `commonware_consensus::simplex::types::Certificate<S, D>`

Concrete certificate variants:

- `Notarization`
- `Nullification`
- `Finalization`

Sender path:

- `simplex::actors::voter::Actor::broadcast_certificate(...)`

Receiver path:

- remote `simplex::Batcher`

Purpose:

- short-circuit raw vote processing by sending fully recovered quorum certificates directly

Why the name "recovered":

- the certificate has already been recovered from `2f+1` votes

### Channel 2: `RESOLVER_CHANNEL`

Payload:

- `commonware_resolver::p2p::wire::Message<U64>`
- request/response wrapper around missing consensus certificates

Request key:

- a `View` encoded as `U64`

Response body:

- an encoded `simplex::Certificate<S, D>`

Purpose:

- fetch missing nullifications, notarizations, or finalizations needed to safely verify or advance views

Used by:

- `simplex::actors::resolver::Actor`

### Channel 3: `BROADCASTER_CHANNEL`

Payload:

- full `alto_types::Block`

Sender path:

- `Marshaled::broadcast(...)`
- `marshal::Mailbox::proposed(...)`
- `marshal::Actor` -> `commonware_broadcast::buffered::Mailbox::broadcast(...)`

Receiver path:

- remote `commonware_broadcast::buffered::Engine`

Purpose:

- disseminate the actual block body referenced by proposal digests in consensus messages

This is important:

- there is no separate "proposal message" type at the consensus wire layer containing the whole block
- the full block travels here, while consensus votes and certificates reference only the block digest

### Channel 4: `MARSHAL_CHANNEL`

Payload:

- `commonware_resolver::p2p::wire::Message<marshal::ingress::handler::Request<Block>>`

Request variants:

- `Request::Block(commitment)`
- `Request::Finalized { height }`
- `Request::Notarized { round }`

Response bodies:

- encoded `Block`
- encoded `(Finalization, Block)`
- encoded `(Notarization, Block)`

Purpose:

- backfill missing chain data after the validator already knows some digest or certificate exists

Used by:

- `marshal::resolver::p2p::init(...)`
- `marshal::Actor`

## Transport and Runtime Settings That Shape Communication

The validator binary hard-codes several transport parameters that materially affect validator-to-validator behavior.

### Message size

- `MAX_MESSAGE_SIZE = 1 MiB`

This is the upper bound passed into `commonware_p2p::authenticated::discovery`.

### Per-channel send quotas

Configured in `validator/src/main.rs`:

- channel 0 (`PENDING_CHANNEL`): `128/sec`
- channel 1 (`RECOVERED_CHANNEL`): `128/sec`
- channel 2 (`RESOLVER_CHANNEL`): `128/sec`
- channel 3 (`BROADCASTER_CHANNEL`): `8/sec`
- channel 4 (`MARSHAL_CHANNEL`): `8/sec`

Interpretation:

- votes, certificates, and certificate repair are allowed at a much higher rate
- full block broadcast and block backfill are intentionally more expensive and slower lanes

### Queueing and backlog

Runtime-configurable values from validator config are threaded into the network stack:

- `mailbox_size`
- `message_backlog`
- `deque_size`

These affect:

- local actor mailboxes
- per-channel P2P buffering
- buffered broadcaster cache depth

### Priority behavior

Priority is not uniform across all message families.

- consensus votes are sent with `priority = true`
- consensus certificates are sent with `priority = true`
- buffered block broadcast is configured with `priority = true`
- simplex resolver requests use `priority_requests = true`
- marshal resolver requests/responses use `priority_requests = false`, `priority_responses = false`

Interpretation:

- consensus progress messages get expedited treatment
- marshal backfill is intentionally less urgent than live consensus traffic

## Message Inventory

## 1. Transport Control-Plane Messages

These are not consensus artifacts, but they are validator-to-validator traffic.

Produced by `commonware_p2p::authenticated::discovery`.

Examples:

- peer discovery bit vectors
- signed peer address info records
- peer gossip messages
- keep-alive traffic

Purpose:

- help validators discover and maintain direct authenticated connections to other validators

These messages are **below** Alto's five application channels.

## 2. Consensus Vote Messages

Defined in `commonware_consensus::simplex::types::Vote`.

### `Notarize`

Contents:

- `Proposal { round, parent, payload }`
- signer attestation

Purpose:

- a validator endorses a proposed block digest for notarization

Operational meaning:

- "I have enough context and data to vote for this proposal in this view."

### `Nullify`

Contents:

- `Round`
- signer attestation

Purpose:

- vote to skip the current view

Operational meaning:

- "The leader timed out, the proposal was invalid, or I cannot safely continue this view."

### `Finalize`

Contents:

- proposal
- signer attestation

Purpose:

- vote to finalize a proposal that was already notarized and locally certified

Operational meaning:

- "I am willing to commit this proposal into the finalized chain."

## 3. Consensus Certificate Messages

Defined in `commonware_consensus::simplex::types::Certificate`.

### `Notarization`

Contents:

- proposal
- aggregated certificate

Purpose:

- prove that a quorum endorsed the proposal

Operational meaning:

- "At least `2f+1` validators voted to notarize this proposal."

### `Nullification`

Contents:

- round
- aggregated certificate

Purpose:

- prove that a quorum skipped the view

Operational meaning:

- "Enough validators timed out or rejected this view; move on."

### `Finalization`

Contents:

- proposal
- aggregated certificate

Purpose:

- prove that the proposal is finalized

Operational meaning:

- "This block is now committed and can be treated as canonical."

## 4. Block Dissemination Messages

Payload type:

- `alto_types::Block`

Fields:

- consensus `Context`
- parent digest
- block height
- timestamp

Purpose:

- provide the actual data behind the digest that consensus is talking about

Important nuance:

- Alto consensus messages use `Proposal.payload` as a digest
- validators must still obtain the full `Block` to verify timestamps, parent linkage, and eventually deliver finalized blocks to the application

## 5. Backfill / Repair Messages

These use `commonware_resolver::p2p::wire::Message<Key>`, whose payload is one of:

- `Request(Key)`
- `Response(Bytes)`
- `Error`

There are two logical repair protocols on top of that wrapper.

### Consensus resolver requests

Key:

- `View` as `U64`

Response:

- encoded consensus certificate for that view

Purpose:

- repair missing notarizations, nullifications, and finalizations needed for safe view progression

### Marshal resolver requests

Key:

- `Request::Block(commitment)`
- `Request::Finalized { height }`
- `Request::Notarized { round }`

Response:

- block only
- finalization+block bundle
- notarization+block bundle

Purpose:

- repair missing block bodies or block+certificate pairs after the validator learns some chain artifact exists

## End-to-End Message Flow

## 1. Proposal Flow

This is the cleanest example of Alto's split design.

### Step A: leader builds a block locally

Path:

- `simplex::Voter` asks the `Automaton` to propose
- `commonware_consensus::application::marshaled::Marshaled` asks `alto_chain::Application` to build the `Block`
- consensus only receives the block commitment/digest back

### Step B: leader broadcasts the full block

Path:

- `simplex` calls `Relay::broadcast(digest)`
- `Marshaled::broadcast(...)` looks up the cached full block
- `marshal.proposed(round, block)` is emitted
- `marshal::Actor` caches it and calls `buffer.broadcast(Recipients::All, block)`
- `commonware_broadcast::buffered::Engine` sends the encoded `Block` over channel 3

### Step C: other validators receive and cache the block

Path:

- remote `buffered::Engine` receives the block from channel 3
- it stores the block by commitment/digest
- any waiters/subscribers for that block are fulfilled

Why this matters:

- a validator can learn about a proposal digest through consensus before it has the full block
- the buffer smooths that race

## 2. Notarization Flow

### Step A: validators vote

After a validator has the necessary ancestry and block data, it emits a `Vote::Notarize` on channel 0.

Path:

- `simplex::Voter` constructs the vote
- the vote is journaled
- `broadcast_vote(...)` sends it to all peers on `PENDING_CHANNEL`

### Step B: remote batchers verify and aggregate

Path:

- remote `Batcher` receives the vote
- decodes it
- keeps it only if the view is still interesting
- batch-verifies attestations when quorum conditions are met

### Step C: a certificate is recovered

Once `2f+1` compatible notarize votes exist, the validator can assemble a `Notarization`.

Then:

- the local voter records it
- broadcasts `Certificate::Notarization` on channel 1
- reports the activity to marshal

### Step D: marshal pairs the notarization with a block

Path:

- `marshal::Mailbox` receives `Activity::Notarization`
- `marshal::Actor` stores the notarization
- if the block is already available locally or in the buffer, it caches the block immediately
- otherwise it requests `Request::Notarized { round }` via the marshal resolver

## 3. Nullification Flow

Nullification is the timeout / recovery path.

### Trigger

- leader timeout
- notarization timeout
- verification failure
- inability to safely certify a proposal

### Message sequence

1. validator sends `Vote::Nullify` on channel 0
2. peers aggregate nullify votes
3. a validator recovers `Certificate::Nullification`
4. the certificate is broadcast on channel 1
5. recipients can move to the next view without needing a block body

Why it exists:

- it keeps the protocol live when a leader is slow, silent, or proposes something unusable

## 4. Finalization Flow

### Step A: validators certify and send finalize votes

After notarization, validators wait for local certification to succeed. Then they send `Vote::Finalize` on channel 0.

### Step B: peers recover a finalization certificate

Once `2f+1` finalize votes are collected:

- a `Certificate::Finalization` is assembled
- it is broadcast on channel 1
- it is also reported into marshal

### Step C: marshal stores the finalized block

Path:

- if marshal already has the block body, it stores the finalization and block as finalized chain data
- if the block body is missing, it requests `Request::Block(commitment)` on channel 4
- once received and verified, the finalized block is persisted and dispatched to the application

Why this separation is useful:

- validators can finalize based on certificates even if some peers temporarily missed the block body
- lagging peers repair the missing body afterward

## 5. Catch-Up and Repair Flow

Alto uses two different fetch systems because it repairs two different kinds of absence.

### Missing consensus certificates

Handled by simplex resolver on channel 2.

Typical case:

- a validator receives a proposal but is missing one or more historical certificates needed to judge ancestry or view progression
- the resolver requests certificates by view
- returned certificates are validated and forwarded to the voter

### Missing blocks or bundled artifacts

Handled by marshal resolver on channel 4.

Typical cases:

- validator has a finalization but not the finalized block body
- validator has a digest and round but not the notarized block bundle
- validator learns a peer is ahead and targets that peer for a finalization by height

Important safety property:

- invalid resolver responses are rejected, and the offending peer can be blocked by the resolver stack

## How a Message Actually Travels Between Validators

For most Alto validator traffic, the path looks like this:

1. an Alto/commonware actor creates a typed Rust object such as `Vote`, `Certificate`, `Block`, or resolver `Request`
2. `commonware_codec` encodes that object into bytes
3. `commonware_p2p::utils::codec::{WrappedSender, WrappedReceiver}` bridges typed objects onto raw P2P I/O
4. `commonware_p2p::authenticated::discovery` wraps the bytes in a channel-tagged `Payload::Data` frame
5. the transport sends that frame directly to selected peers over authenticated encrypted connections
6. the remote validator routes the frame to the receiver for that same channel id
7. the typed wrapper decodes the bytes back into the original object
8. the receiving actor validates, stores, aggregates, rebroadcasts, or repairs from it

Two consequences follow from this design:

- Alto is primarily **direct all-to-all**, not gossip-relay consensus networking
- message meaning is mostly determined by the **channel** plus the **typed payload**, not by one giant protocol envelope

## Commonware Modules by Message Family

| Message family | Main sender-side modules | Main receiver-side modules |
| --- | --- | --- |
| discovery / peer control | `commonware_p2p::authenticated::discovery` | `commonware_p2p::authenticated::discovery` |
| votes | `simplex::Voter`, `p2p::Sender`, `codec::WrappedSender` | `simplex::Batcher`, `codec::WrappedReceiver` |
| certificates | `simplex::Voter`, `p2p::Sender`, `codec::WrappedSender` | `simplex::Batcher`, then `simplex::Voter` |
| consensus repair requests | `simplex::Resolver`, `commonware_resolver::p2p::Engine` | remote `simplex::Resolver` |
| full block broadcast | `Marshaled`, `marshal::Actor`, `commonware_broadcast::buffered::Engine` | remote `buffered::Engine`, then marshal/application subscribers |
| marshal repair requests | `marshal::resolver::p2p`, `commonware_resolver::p2p::Engine` | remote `marshal::Actor` via handler bridge |

## Important Protocol Properties

## 1. Validators communicate directly

The consensus path is direct validator-to-validator sending over authenticated P2P sessions. Alto does not depend on a leader relay or multi-hop gossip overlay for consensus artifacts.

## 2. Full blocks are out-of-band from consensus votes

This is the most important Alto-specific communication property.

Consensus traffic carries:

- views
- parent views
- digests
- signatures / threshold certificates

The full block body travels separately through the buffered broadcaster and the marshal repair path.

## 3. Certificates are first-class network objects

Recovered certificates are not just local bookkeeping. They are explicitly broadcast to peers because they let other validators:

- skip waiting for individual votes
- advance views faster
- catch up after packet loss

## 4. Repair is normal, not exceptional

Both simplex and marshal assume validators may receive artifacts out of order. Repair traffic is built into normal operation, not bolted on later.

## 5. The protocol distinguishes liveness data from chain data

- votes and certificates drive consensus progress
- blocks and backfill bundles provide chain contents

That separation is what allows Alto to keep consensus messages compact while still supporting repair.

## What Validators Do Not Send

Some things are easy to assume but are not true in Alto.

### There is no dedicated validator-to-validator "seed" message

Alto uses the VRF-enabled threshold scheme, so notarize/nullify attestations can yield a `Seed(view)` after quorum. But the seed is derived from certificate material; it is not a separate validator P2P message type in Alto's runtime channels.

### There is no single "proposal packet" carrying everything

A proposal is logically composed of:

- the block body on channel 3
- digest-bearing consensus messages on channels 0 and 1

### There is no single generic repair channel for all missing data

Alto intentionally uses:

- one resolver path for consensus certificates
- another resolver path for blocks and bundled chain artifacts

## Practical Reading of the Stack

If you want to trace validator-to-validator communication in the code, the highest-signal path is:

1. `validator/src/main.rs`
2. `chain/src/engine.rs`
3. `~/.cargo/git/checkouts/monorepo-9732103c47eb4665/16e98b5/consensus/src/simplex/engine.rs`
4. `.../consensus/src/simplex/types.rs`
5. `.../broadcast/src/buffered/*`
6. `.../consensus/src/marshal/*`
7. `.../resolver/src/p2p/*`
8. `.../p2p/src/authenticated/discovery/*`

## Bottom Line

Validator-to-validator communication in Alto is a layered protocol:

- `commonware_p2p::authenticated::discovery` supplies authenticated direct transport and peer discovery
- `simplex` carries votes and certificates for consensus progression
- `buffered broadcast` carries full block bodies
- `marshal` connects consensus certificates to actual block data and finalized chain delivery
- `commonware_resolver::p2p` repairs anything missed

The architectural center of gravity is the separation between:

- **small, fast consensus messages about digests**
- **separate dissemination and repair of full block data**

That separation is what makes the validator communication model in Alto both compact and resilient under out-of-order delivery or temporary packet loss.
