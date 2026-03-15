# `examples/log` Report

## Overview

`examples/log` is a minimal Commonware application that uses `commonware-consensus::simplex` to agree on an ordered log of payload digests.

Each participant periodically becomes leader for a view. When it is that participant's turn, it generates a fresh 16-byte secret message, hashes it, and proposes only the hash into consensus. The network reaches agreement on the digest and its position in the log, not on the underlying secret message itself.

This is an important limitation of the example and it is intentional. The code explicitly avoids implementing:

- full-message broadcast
- full-message backfill
- application-specific validation beyond digest acceptance

So the example demonstrates how to integrate an application with Simplex consensus, but it does not yet demonstrate a full replicated data-availability path.

## Top-Level Structure

The example is split into a small number of pieces:

- `src/main.rs`: wires together identity, P2P, consensus, storage, and the application actor
- `src/application/actor.rs`: application logic for genesis, propose, and verify
- `src/application/ingress.rs`: adapter implementing the consensus `Automaton`, `CertifiableAutomaton`, and `Relay` traits
- `src/application/reporter.rs`: logs important consensus events
- `src/gui.rs`: local terminal UI for viewing logs and progress

## Entities Involved

### 1. Participant / Validator Node

Each running process is a participant in the protocol. All participants run the same binary and the same logic.

Each participant:

- derives an Ed25519 private key from the numeric `--me` argument
- binds a local listening port
- knows the full validator set from `--participants`
- joins the authenticated P2P mesh
- starts the application actor
- starts the Simplex consensus engine
- persists consensus state to local storage

A participant is both:

- a network peer
- a consensus voter
- a potential leader for some views

### 2. Bootstrapper

A bootstrapper is not a special consensus role. It is simply a participant whose address is already known to others so they can discover the network.

In the README, participant 0 is used as the bootstrapper, but once the network forms, it behaves like every other validator.

### 3. Application Actor

The application actor is the application-defined state machine boundary.

It handles three requests from the consensus engine:

- `Genesis`: produce the initial digest
- `Propose`: generate a new secret and return its digest
- `Verify`: approve or reject a proposed digest

In this example:

- `Genesis` hashes the constant string `commonware is neat`
- `Propose` generates a random 16-byte secret and hashes it
- `Verify` always returns `true`

This means the application layer is intentionally minimal. It does not distribute the full secret message and does not enforce any parent-linking rules beyond what consensus itself already guarantees for digests.

### 4. Consensus Voter Actor

The voter is the core state machine that drives participation in the protocol.

It is responsible for:

- entering views
- asking the application to propose when we are leader
- asking the application to verify when we receive a proposal
- handling timeouts
- broadcasting votes
- broadcasting certificates
- tracking notarizations, nullifications, and finalizations
- persisting artifacts to the journal
- replaying artifacts after restart

### 5. Consensus Batcher Actor

The batcher is the network-ingest and cryptographic verification pipeline for votes and certificates.

It:

- receives votes from the vote network lane
- receives certificates from the certificate lane
- verifies vote signatures in batches
- blocks invalid peers
- constructs quorum certificates once enough valid votes are present
- forwards leader proposals and certificates to the voter

The batcher exists so the voter does not have to do all network decoding and cryptographic checking itself.

### 6. Consensus Resolver Actor

The resolver is the backfill/catch-up path.

It:

- requests missing certificates from peers
- validates returned certificates
- feeds resolved certificates back into the voter
- serves our own locally known certificates to peers that request them

In this example, the resolver only backfills consensus certificates, not full application data.

### 7. Reporter

The reporter is not part of consensus safety. It is an observer.

It receives consensus activity and logs:

- `notarized`
- `finalized`
- `nullified`

This is what drives the visible progress in the terminal UI.

### 8. GUI

The GUI is purely local and operational. It does not participate in consensus.

It displays:

- an `Activity` panel with important application/consensus events
- a `Logs` panel with lower-level tracing output

## Consensus Data Model

The main consensus objects used by the example are:

### Context

When consensus asks the application to propose or verify, it provides a `Context` containing:

- the current round
- the selected leader
- the parent `(view, digest)` that the new proposal builds on

This is how the application learns where in the log the new payload should attach.

### Proposal

A proposal contains:

- `round`
- `parent`
- `payload`

In this example, `payload` is a SHA-256 digest of a secret 16-byte message.

### Votes

Simplex uses three individual vote types:

- `Notarize`
- `Nullify`
- `Finalize`

These are signed by individual validators.

### Certificates

Simplex also uses three quorum certificate types:

- `Notarization`
- `Nullification`
- `Finalization`

These are assembled from a quorum of votes and serve as compact proof that the network agreed on some protocol step.

## Leader Selection

The example uses `RoundRobin::<Sha256>::default()` as its elector.

That means leaders are chosen deterministically in a round-robin fashion over the participant set. Every honest participant computes the same leader for a given `(epoch, view)`.

This matters because:

- all validators must know who is supposed to propose
- the leader's identity influences when the node should propose
- timeout behavior depends on whether the leader appears active or inactive

## Step-By-Step Consensus Flow

## 1. Startup And Initialization

When the node starts:

1. it parses CLI arguments
2. it derives its identity key from `--me`
3. it builds the authorized validator set from `--participants`
4. it configures the authenticated discovery network
5. it registers peer set `0`
6. it registers three P2P channels for consensus traffic
7. it constructs the application actor
8. it constructs the Simplex engine
9. it starts the application actor, network, and engine

At consensus startup, the voter:

1. asks the application for the genesis digest
2. initializes the journal
3. replays any persisted artifacts from disk
4. restores its prior consensus state
5. enters the current view

Persistence is a first-class part of the design. If the node restarts, it replays prior votes, certificates, and certification results from the journal before resuming.

## 2. Entering A View

Each view has:

- a designated leader
- a leader timeout
- a notarization timeout

When the voter enters a view:

- it computes the leader
- it sets deadlines for progress
- it tracks whether the current proposal can be built on a valid parent

The current view does not automatically finalize anything. It is just the round in which the protocol is trying to make progress.

## 3. Leader Proposal

If the local node is the leader for the current view, the voter asks the application to propose.

The application:

1. generates a random 16-byte secret
2. hashes the secret with SHA-256
3. logs the secret and resulting digest locally
4. returns the digest to the consensus engine

The engine then wraps that digest into a `Proposal`.

Important detail: the proposal contains only the digest. The raw secret is not sent to other participants in this example.

## 4. Proposal Propagation

This example does not have a dedicated "proposal channel" carrying a separate proposal message.

Instead, followers effectively learn about the proposal through the leader's first `Notarize` vote, because the `Notarize` vote carries the full `Proposal`.

That means proposal dissemination in this example is piggybacked on the vote path.

This is minimal and works for the demo, but it is one of the reasons the example is intentionally simplified.

## 5. Proposal Verification

Once a node has a proposal for the current view, the voter asks the application to verify it.

The verification interface receives:

- the `Context`
- the proposed digest

In this example, verification always returns `true`.

A real application would usually do more here, for example:

- verify the payload contents
- confirm parent relationships
- reject malformed application state transitions

## 6. Notarize Vote

After a validator is ready to support the proposal, it signs a `Notarize` vote and broadcasts it.

That vote says, in effect:

"I endorse this proposal for this round."

The vote is:

- stored locally in the journal
- sent to the batcher
- broadcast to peers on the vote lane

## 7. Notarization Certificate

When enough valid `Notarize` votes exist, the batcher assembles a `Notarization` certificate.

The certificate proves that a quorum endorsed the proposal.

The batcher forwards this certificate to the voter, and the voter:

- records it
- persists it
- informs the resolver
- broadcasts it to peers on the certificate lane
- reports it to the reporter

At this point, the proposal is notarized, but not yet finalized.

## 8. Certification Step

Simplex includes a certification step between notarization and finalization.

This allows applications to add one more deterministic safety gate before the protocol commits.

In this example, the application uses the default `CertifiableAutomaton` implementation, which always certifies.

So once a notarization is available, certification succeeds automatically.

If certification were to fail in a more complex application, the voter would move toward nullifying the view rather than finalizing it.

## 9. Finalize Vote

After certification succeeds, validators can sign `Finalize` votes for the proposal.

Like notarize votes, finalize votes are:

- persisted locally
- given to the batcher
- broadcast on the vote lane

The meaning is stronger now:

"I support committing this already-notarized and certified proposal."

## 10. Finalization Certificate

When enough valid `Finalize` votes exist, the batcher assembles a `Finalization` certificate.

The voter then:

- stores it
- advances the finalized tip
- persists it
- informs the resolver
- broadcasts it to peers on the certificate lane
- reports it to the reporter

This is the point where the digest becomes final in the example's log.

## 11. Timeout And Nullification

If progress stalls, the voter triggers a timeout.

Timeouts happen in two main cases:

- the leader does not produce a usable proposal in time
- the network does not collect enough votes quickly enough

When that happens, validators may broadcast `Nullify` votes.

If enough `Nullify` votes are collected, the batcher assembles a `Nullification` certificate.

That certificate means:

"This view is skipped."

Once nullified, the protocol advances to the next view without finalizing a proposal for the skipped one.

The state machine is careful about parent selection here. When searching for the parent of a future proposal, it can walk backwards through nullified views until it finds a certified or finalized ancestor.

## 12. Backfill / Resolver Flow

If a validator is missing certificates needed to understand current state, it uses the resolver lane.

The resolver sends request/response traffic keyed by view. The underlying backfill type includes:

- `Backfiller::Request`
- `Backfiller::Response`

Requests ask for:

- missing notarizations
- missing nullifications

Responses carry:

- the requested notarization certificates
- the requested nullification certificates

The resolver validates returned certificates and forwards accepted ones to the voter.

This lets a node catch up on consensus proof state.

Again, this applies only to consensus certificates in this example. It does not backfill the secret messages behind the digests.

## Communication Channels

There are two kinds of channels in the example:

- external network channels between participants
- internal mailboxes between local actors

## External Network Channels

### Channel 0: Vote Channel

Registered as P2P channel `0`.

Purpose:

- carry individual validator votes

Messages sent on this channel:

- `Vote::Notarize`
- `Vote::Nullify`
- `Vote::Finalize`

Why it matters:

- this is how individual validators express support for proposals or view skips
- the batcher consumes this lane and batch-verifies signatures
- quorum on this lane is what enables certificate construction

### Channel 1: Certificate Channel

Registered as P2P channel `1`.

Purpose:

- carry assembled quorum certificates

Messages sent on this channel:

- `Certificate::Notarization`
- `Certificate::Nullification`
- `Certificate::Finalization`

Why it matters:

- certificates let peers advance quickly without separately processing every outstanding vote
- receiving a certificate can short-circuit slower vote-by-vote processing
- this is the compact proof lane for protocol progress

### Channel 2: Resolver Channel

Registered as P2P channel `2`.

Purpose:

- request/response backfill for missing certificates

Messages sent on this channel:

- resolver requests for missing views
- resolver responses carrying requested certificates
- internally, these are represented by `Backfiller::Request` and `Backfiller::Response`

Why it matters:

- allows lagging nodes to catch up
- supports parent validation when the node missed earlier certificates
- keeps the protocol live in the presence of temporary message loss or restarts

## Underlying Discovery Transport

Below those application lanes, the authenticated discovery network manages:

- peer discovery
- encrypted authenticated connections
- peer gossip
- per-channel multiplexing
- rate limiting

Its own internal protocol includes:

- bit-vector gossip for peer knowledge
- signed peer `Info` records
- `Payload::Peers` gossip responses
- `Payload::Data` for lane-specific application data

The example relies on this layer so consensus does not have to implement connection management itself.

## Internal Local Mailboxes

### Application Mailbox

The application mailbox carries:

- `Genesis`
- `Propose`
- `Verify`

These are local messages from the voter/application adapter into the application actor.

### Voter Mailbox

The voter mailbox carries:

- `Proposal`
- `Verified(Certificate, from_resolver)`

Sources:

- batcher forwards proposals and recovered certificates
- resolver forwards resolved certificates

### Batcher Mailbox

The batcher mailbox carries:

- `Update { current, leader, finalized }`
- `Constructed(Vote)`

Sources:

- voter updates batcher about current protocol position
- voter also feeds locally constructed votes into batcher so local votes participate in quorum construction just like remote ones

### Resolver Mailbox

The resolver mailbox carries:

- `Certificate`
- `Certified { view, success }`

This keeps resolver state synchronized with what the voter has already learned locally.

## Messages Sent On Each Channel

For clarity, here is the complete message inventory relevant to the example.

### Application-Level Consensus Objects

- `Context`
- `Proposal`
- `Notarize`
- `Nullify`
- `Finalize`
- `Notarization`
- `Nullification`
- `Finalization`
- `Backfiller::Request`
- `Backfiller::Response`

### External P2P Lane Mapping

- channel `0`: individual votes
- channel `1`: quorum certificates
- channel `2`: resolver request/response backfill traffic

### Internal Actor Message Mapping

- application mailbox: `Genesis`, `Propose`, `Verify`
- voter mailbox: `Proposal`, `Verified`
- batcher mailbox: `Update`, `Constructed`
- resolver mailbox: `Certificate`, `Certified`, plus handler `Deliver` and `Produce`

## Commonware Modules Used

## `commonware-consensus`

This is the most important module in the example.

It provides:

- `simplex::Engine`
- leader election
- proposal/vote/certificate types
- the `Automaton` interface
- the `CertifiableAutomaton` interface
- the `Relay` interface
- the `Reporter` interface

What it does in this example:

- drives the Byzantine consensus protocol
- determines the leader for each view
- tracks notarization, finalization, and nullification
- manages timeouts and retries
- persists and replays protocol artifacts
- coordinates voter, batcher, and resolver actors

Why it matters:

- without it, there is no agreement on digest order or finality

## `commonware-cryptography`

This module provides:

- Ed25519 identity and signing
- SHA-256 hashing
- certificate assembly and verification primitives

What it does in this example:

- derives each participant identity from a seed
- signs votes
- verifies votes and certificates
- hashes the secret messages into digest payloads

Why it matters:

- consensus messages must be attributable and verifiable
- the payload agreed on by the example is specifically a cryptographic digest

## `commonware-p2p`

This module provides:

- authenticated discovery
- encrypted peer-to-peer connections
- peer set management
- multiplexed channels
- rate limiting
- peer blocking

What it does in this example:

- forms the validator mesh
- tracks peer set `0`
- carries consensus traffic on channels `0`, `1`, and `2`
- blocks peers that send invalid or malformed consensus messages

Why it matters:

- consensus needs authenticated transport between validators
- per-channel isolation keeps vote, certificate, and resolver traffic separate

## `commonware-runtime`

This module provides:

- the Tokio runner
- task spawning
- storage directory integration
- quotas
- page cache
- metrics
- randomness through the runtime context

What it does in this example:

- starts the async system
- gives the application actor the RNG it uses for random secret generation
- hosts the storage directory for persistence
- provides the page cache used by the consensus journal
- provides quotas for P2P channels

Why it matters:

- all OS interaction and async execution flow through runtime abstractions

## `commonware-storage`

Used indirectly by the voter through the journal implementation.

What it does in this example:

- stores votes, certificates, and certification outcomes
- enables replay on restart
- makes crash recovery safe

Why it matters:

- without persistent protocol state, a restarted validator could violate safety or fail to resume correctly

## `commonware-parallel`

The example uses `Sequential` as the strategy.

What it does in this example:

- provides the strategy interface used for certificate assembly and verification work
- keeps execution simple by using sequential behavior in the demo

Why it matters:

- the same abstraction can support more parallel verification strategies in more performance-focused deployments

## `commonware-utils`

This module provides utility infrastructure used throughout the example.

What it does here:

- typed sets for validator collections
- local channels (`mpsc`, `oneshot`)
- namespace helpers
- non-zero numeric helpers
- hex formatting

Why it matters:

- it keeps the example concise and provides the local messaging glue between actors

## What The Example Intentionally Does Not Do

The example is educational because it is small, but that also means it leaves out several pieces a production application would need.

It does not:

- broadcast the full secret messages
- store the full secret messages in replicated application storage
- backfill old application payloads
- reject proposals based on application-level semantics
- enforce richer parent-link validation in the application layer

So the example demonstrates:

- consensus on digest commitments
- protocol progress across views
- restart-safe persistence of consensus state

But it does not demonstrate:

- replicated application data availability
- full state sync
- end-to-end retrieval of committed application contents

## Why This Example Is Still Important

Even with those omissions, `examples/log` is a strong minimal example because it clearly shows:

- how to plug an application into Simplex
- what the application is responsible for
- what the consensus engine is responsible for
- how P2P lanes are allocated
- how votes differ from certificates
- how timeouts lead to nullification
- how restart-safe persistence is integrated

It is a good reference for anyone trying to understand the smallest useful Commonware consensus integration before moving on to more complete systems.

## Final Summary

`examples/log` is a consensus demo for agreeing on an ordered log of SHA-256 digests of locally generated secret messages.

The main entities are:

- validator participants
- the application actor
- the voter actor
- the batcher actor
- the resolver actor
- the reporter
- the local GUI

The core protocol flow is:

1. enter a view
2. choose a round-robin leader
3. leader proposes a digest
4. validators verify and send `Notarize`
5. quorum yields `Notarization`
6. certification succeeds
7. validators send `Finalize`
8. quorum yields `Finalization`
9. if progress stalls, validators send `Nullify` and may produce `Nullification`

The main external communication lanes are:

- vote lane
- certificate lane
- resolver lane

The most important Commonware modules are:

- `commonware-consensus` for protocol logic
- `commonware-cryptography` for identities, signatures, and hashing
- `commonware-p2p` for authenticated transport
- `commonware-runtime` for execution and storage integration
- `commonware-storage` for persistence
- `commonware-parallel` for verification strategy
- `commonware-utils` for support infrastructure

The example's key simplification is that consensus commits only to digests, not to the full secret messages themselves. That keeps the demo small and focused on consensus integration.
