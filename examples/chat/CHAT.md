# Chat Example Description

## Purpose

`examples/chat/` is a small end-to-end application that demonstrates how to build a private group chat on top of Commonware's authenticated peer-to-peer stack. Each running process represents one participant in a fixed friend group. Participants identify each other by public key, discover one another over the network, establish encrypted connections, and then exchange plaintext chat payloads over a single registered application channel.

The example is intentionally simple. It is not trying to solve durable messaging, ordering, persistence, history sync, or large-scale group management. Its job is to show the minimum application code needed to:

- create cryptographic identities,
- define an authorized peer set,
- bootstrap peer discovery,
- open encrypted authenticated links,
- multiplex an application channel over those links, and
- send and receive application messages in a terminal UI.

## What The Example Does

At startup, a participant:

1. Parses its local identity from `--me=<seed>@<port>`.
2. Derives an Ed25519 keypair from the numeric seed.
3. Parses the full friend set from `--friends=...`.
4. Optionally parses one or more bootstrap peers from `--bootstrappers=...`.
5. Configures `commonware_p2p::authenticated::discovery` with a localhost listener and dialable address.
6. Registers the friend set with the discovery oracle as peer set `0`.
7. Registers one application channel for chat messages.
8. Starts the network and then hands control to a terminal UI.

Once running, the process does two things concurrently:

- it participates in discovery, authentication, encrypted transport, and routing with other authorized peers;
- it lets the user type a message and sends that message to `Recipients::All`, meaning all currently connected authorized peers on the chat channel.

Incoming chat payloads are shown in the `Messages` pane. Logs from the networking stack are shown in the `Logs` pane. Runtime metrics, including connection counts, are shown in the `Metrics` pane.

## Participants And Their Relationships

The example models a fixed friend group, not an open network.

### 1. The local participant

The local participant is the current process. Its long-term identity is the Ed25519 keypair derived from the numeric seed in `--me`. In the demo, identities are deterministic so multiple terminals can be started with predictable keys. This is a convenience for the example, not production key management.

### 2. Friends

Friends are the public keys derived from every numeric id listed in `--friends`. This set is the trust boundary of the application.

Friends have three important relationships:

- **Authorization**: only peers in the tracked peer set are considered valid participants.
- **Discovery**: peers gossip address knowledge only for tracked authorized peers.
- **Delivery target**: when the UI sends to `Recipients::All`, the network resolves that to the currently connected peers from the tracked sets.

The example expects every real participant to use the same friend list. That shared list is what gives the discovery protocol a common interpretation of peer-set index `0`.

### 3. Bootstrappers

Bootstrappers are just initial contact points. They are not leaders, servers, or permanent relays. Their role is to give a joining participant at least one known address so discovery can begin.

After a participant connects to any bootstrapper, the discovery protocol can gossip the rest of the group's dialable addresses. Different participants may use different bootstrappers. That is why the README shows friend 4 bootstrapping from friend 3 instead of friend 1.

### 4. Unauthorized participants

The "Not Friend (Blocked)" example demonstrates the trust model. A process started as participant 5 tracks the set `{1,2,3,4,5}`, but the real group tracks `{1,2,3,4}`. Participant 5 is therefore not authorized by the others, and the group will not treat it as a valid member of the tracked set.

This is important: exclusion is enforced by the authenticated network configuration, not by a polite application-level convention.

## Topology And Communication Model

Conceptually, the example wants a fully connected mesh among the friend group. No single participant is responsible for forwarding chat messages. Each participant sends directly to its connected peers.

The chat application itself uses a single broadcast-style operation:

- send one payload to `Recipients::All` on channel `0`

That does **not** mean:

- reliable delivery,
- durable fanout,
- retransmission to offline peers,
- ordering across senders, or
- consensus over message history.

It means "attempt immediate delivery to the currently connected members of the authorized peer set." If a friend is offline or currently disconnected, the message is dropped for that friend.

## End-To-End Flow

### Startup

`src/main.rs` assembles the entire application:

- `clap` parses CLI arguments.
- `ed25519::PrivateKey::from_seed` produces the local signer.
- every numeric friend id is converted into a public key and inserted into an ordered set;
- `discovery::Config::local(...)` builds a low-latency local-demo configuration;
- `discovery::Network::new(...)` constructs the authenticated network and returns an oracle for peer-set management;
- `oracle.track(0, recipients).await` declares the authorized friend group at index `0`;
- `network.register(...)` creates the chat sender/receiver pair for application channel `0`;
- `network.start()` launches the networking actors;
- `handler::run(...)` starts the terminal UI.

### Discovery And Connection Formation

The heavy lifting happens inside `commonware_p2p::authenticated::discovery`.

The discovery protocol assumes that all participants agree on the mapping:

- peer-set index `0` -> ordered set of friend public keys

Using that shared view, peers exchange compact bit vectors that encode which dialable addresses they currently know for members of the set. When one peer knows addresses another peer lacks, it gossips signed peer information back. That lets the group expand from one bootstrap connection into a mesh of authenticated connections.

### Authentication And Encryption

Once peers connect, the underlying transport is `commonware_stream::encrypted`.

That layer provides:

- mutual authentication using the participants' static signing keys,
- encrypted traffic using ChaCha20-Poly1305,
- forward secrecy via ephemeral X25519 key exchange,
- namespace binding to prevent cross-application replay.

The chat example benefits from these guarantees automatically because `authenticated::discovery` builds on that transport internally.

### Application Messaging

The chat application registers a single channel:

- channel id `0`
- per-channel send quota of `128` messages per second
- receive backlog of `128` messages

When the user presses Enter, `handler.rs` calls:

- `sender.send(Recipients::All, input.as_bytes().to_vec(), false).await`

The returned recipient list is the set of peers the network accepted for send at that moment. If the list is empty, the application logs the message as dropped. That usually means there were no connected recipients or rate/availability checks filtered them out.

Incoming messages arrive through the registered receiver and are appended to the message pane with the sender's public key shortened for display.

## The UI's Role

The terminal UI in `src/handler.rs` is useful but secondary to the networking example.

It provides four panes:

- `Messages`: sent and received chat messages
- `Input`: user text entry
- `Metrics`: runtime metrics exported by the Commonware runtime and network stack
- `Logs`: structured tracing output reformatted for readability

This matters because the example is meant to be observed while it runs. The metrics pane helps confirm whether the peer mesh has formed. The logs pane helps explain discovery and connection behavior without attaching a debugger.

## Commonware Modules Used And Their Importance

### Most important: `commonware-p2p::authenticated::discovery`

This is the core of the example.

It is responsible for:

- maintaining the authorized peer sets,
- discovering peer addresses,
- dialing and accepting connections,
- authenticating peers,
- routing messages,
- multiplexing channels,
- rate limiting per channel,
- resolving `Recipients::All` into live peers.

Without this module, there is no group formation and no chat transport.

### Essential: `commonware-stream::encrypted`

This module is not used directly by the example, but it is essential in practice because the p2p layer uses it internally. It provides the confidentiality and authenticated transport properties that make the chat "private" rather than just "connected".

If `authenticated::discovery` is the main application-facing abstraction, `stream::encrypted` is the security-critical transport underneath it.

### Essential: `commonware-cryptography::ed25519`

Ed25519 keys are the identity system for the example. The same key material is used to:

- define who each participant is,
- build the friend list,
- authenticate peers during connection setup,
- sign discovery-related information.

The example chooses deterministic seeds for convenience. In a real deployment, keys would come from secure key generation and storage.

### Important: `commonware-runtime`

The runtime supplies the execution environment:

- Tokio-backed task runner for this example,
- spawning and labeling async tasks,
- metrics collection,
- quotas used by registered channels.

The runtime is important because Commonware primitives are runtime-agnostic by design, but for this example it is infrastructure rather than the main idea.

### Supporting: `commonware-utils`

This crate contributes small but useful pieces:

- ordered sets for the friend list,
- a mutex wrapper for shared logs,
- bounded channels for keyboard events,
- hex formatting helpers,
- small helpers like `TryCollect` and `NZU32`.

These pieces keep the example concise, but they are not what the example is teaching.

### Supporting: `commonware-macros`

`select!` is used in the UI loop to wait on either local keyboard events or inbound network messages. This is convenient async control flow, not a conceptual centerpiece.

## Why The Friend Set Must Be Synchronized

This is one of the most important concepts in the example.

Discovery messages are interpreted relative to an ordered peer set at a given index. If two participants disagree about who belongs in peer set `0`, then the same bit position can refer to different public keys on different machines. Once that happens, discovery information becomes ambiguous or invalid.

That is why the example insists that all real friends use the same `--friends` list. In this design, "friendship" is not just an application permission check. It is part of the network protocol's shared configuration.

## Important Operational Semantics

### Messages to offline friends are dropped

This example is live chat only. There is no mailbox, retry queue, or store-and-forward service.

### Messages are not globally ordered

Two participants can send concurrently, and the UI simply displays messages as they are observed locally.

### There is no persistence

Chat history exists only in memory for the current process.

### There is no group membership protocol

Membership is configured out-of-band through the command line and then injected into the p2p oracle.

### There is no content-level cryptography in the application

The application sends UTF-8 chat text as ordinary bytes. Privacy and authenticity come from the authenticated encrypted transport.

## Files In The Example

- `src/main.rs`: application wiring, identity setup, peer-set tracking, network startup
- `src/handler.rs`: terminal UI and chat send/receive loop
- `src/logger.rs`: adapts JSON tracing output into human-readable log lines for the UI
- `README.md`: concise usage instructions

## How To Read This Example

If the goal is to understand the example quickly, read it in this order:

1. `src/main.rs` to see how little code is needed to configure the network.
2. `src/handler.rs` to see the application-facing send/receive API.
3. `p2p/src/authenticated/discovery/mod.rs` if you want to understand how peer discovery and authorization actually work.
4. `stream/src/encrypted.rs` if you want the transport-security details.

## Summary

`examples/chat/` is best understood as a demonstration of authenticated group communication over a fixed peer set. The application layer is intentionally thin: it gathers user input, renders output, and delegates almost all hard distributed-systems work to Commonware primitives. The most important idea is that the friend list is both the access-control policy and the shared discovery context. Once that set is synchronized, Commonware handles peer discovery, encrypted authenticated transport, channel routing, and live fanout to connected group members.
