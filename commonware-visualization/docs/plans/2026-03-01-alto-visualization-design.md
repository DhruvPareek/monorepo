# Alto Visualization Design

## Overview

A new tab in the commonware-visualization app showing the full Alto blockchain system: 5 validators running Simplex BFT consensus, an in-memory indexer serving data, and a follower syncing from the indexer. Animated consensus rounds show leader election, block proposal, notarization voting, finalization, push to indexer, and follower sync.

## Layout

Canvas: 1200x860 SVG viewBox (same as bridge/sync).

```
                    [Indexer]  (900, 200)
                   /    |
    [V1]          /     |
  [V2] [V3]  ---HTTP    |
    [V4]   push     HTTP/WS
  [V5]               |
  (400, 450)      [Follower] (900, 500)

  ========= runtime (async foundation) =========
```

### Entities

1. **5 Validators (V1-V5)** at cluster center ~(400, 450), pentagon arrangement.
   - Circles, radius 26 (same style as bridge).
   - Internal module dots: C (consensus), S (storage), B (broadcast), P (parallel), R (resolver) at 14px spacing.
   - Leader gets pulsing purple ring.
   - Single dashed-border cluster rectangle labeled "Validators".

2. **Indexer** at ~(900, 200).
   - Rounded rectangle (same style as bridge indexer).
   - Internal module dots: parallel, runtime.
   - In-memory HTTP/WS server receiving blocks and certificates from validators.

3. **Follower** at ~(900, 500).
   - Rounded rectangle, slightly smaller or dashed border to indicate non-voting/passive.
   - Internal module dots: S (storage), P (parallel), R (resolver), RT (runtime).
   - Syncs finalized chain from indexer without participating in consensus.

### Connections

- **P2P mesh** between all 5 validators. One representative edge gets full pipeline chips; others get compact colored dots.
- **HTTP POST** from validator cluster to indexer (block/certificate upload). Representative edge gets pipeline chips.
- **HTTP/WS** from indexer to follower (sync). Gets pipeline chips.

### Runtime Band

Green band at bottom spanning full width, labeled "runtime (async foundation)". Same pattern as bridge.

## Modules

9 modules total:

| Key | Color | Short | Detail |
|-----|-------|-------|--------|
| `consensus` | #7B1FA2 | BFT via Simplex | simplex::Engine with VRF-based leader election. Validators propose and vote on block digests. BLS12-381 threshold signatures (3-of-5). Notarization requires 2f+1 votes, followed by finalization. |
| `p2p` | #0097A7 | Authenticated peer mesh | authenticated::discovery::Network with ED25519-authenticated connections. 5 channels: pending(0), recovered(1), resolver(2), broadcast(3), marshal(4), each with independent rate limits. |
| `cryptography` | #C62828 | Ed25519 + BLS12-381 + SHA-256 | Ed25519 for validator identity and P2P authentication. BLS12-381 MinSig for threshold consensus certificates (notarization and finalization). SHA-256 for block digest computation. |
| `broadcast` | #E65100 | Message buffering | buffered::Engine buffers out-of-order consensus messages with priority. Sits between P2P transport and the consensus engine, ensuring messages aren't dropped if the node isn't ready. |
| `storage` | #795548 | Finalized chain persistence | Two immutable archives: finalizations-by-height and finalized-blocks. zstd level 3 compression. Page cache: 4KB pages, 32MB capacity. Enables crash recovery without violating safety. |
| `codec` | #455A64 | Binary serialization | commonware-codec Encode/Decode for all wire and storage formats. Block, Seed, Notarization, Finalization all use binary encoding with varint compression. |
| `parallel` | #283593 | Sig verification | BLS12-381 signature verification via commonware-parallel. Validators use thread pools for parallel verification. Indexer and follower use Sequential strategy. |
| `runtime` | #2E7D32 | Async foundation | Tokio-based async executor. Task spawning, TCP networking, storage I/O, buffer primitives, rate limiting, and metrics. All other modules depend on this. |
| `resolver` | #6A1B9A | Certificate backfill | Resolves missing certificates and blocks when a node falls behind. Validators use P2P-based resolution; follower uses HTTP fetching from indexer. |

## Pipelines

### P2P Pipeline (validator-to-validator)

```
[broadcast, 'buffer'] -> [cryptography, 'peer auth'] -> [p2p, 'p2p'] -> [cryptography, 'peer auth'] -> [broadcast, 'buffer']
```

Consensus messages go through the broadcast buffer, are authenticated by ED25519 at the P2P layer, and arrive into the remote validator's buffer.

### HTTP Push Pipeline (validator-to-indexer)

```
[codec, 'encode'] -> [runtime, 'HTTP POST'] -> [codec, 'decode']
```

Validators push seeds, notarizations, and finalizations to the indexer via HTTP POST.

### Sync Pipeline (indexer-to-follower)

```
[codec, 'encode'] -> [runtime, 'HTTP/WS'] -> [codec, 'decode']
```

Follower receives real-time events via WebSocket and fetches missing blocks via HTTP.

### Internal Modules

**Validator:** consensus, storage, broadcast, parallel, resolver

**Indexer:** parallel, runtime

**Follower:** storage, parallel, resolver, runtime

## Animation

~10s consensus round cycle, repeating:

| Phase | Duration | Visual |
|-------|----------|--------|
| IDLE | 1s | Leader indicator appears on next leader (VRF round-robin rotation through V1-V5). |
| PROPOSE | 2s | Leader pulses. Particles flow from leader to all other validators via P2P mesh. Simultaneously, particles flow from leader to indexer via HTTP (PutBlock). |
| NOTARIZE | 2.5s | All validators exchange vote particles via P2P mesh. At ~70% progress, threshold flash on cluster indicates notarization certificate formed. |
| FINALIZE | 2s | Second round of voting particles. Another threshold flash. |
| PUSH | 1.5s | All validators send particles to indexer (PutFinalization). Indexer pulses. |
| SYNC | 1s | Indexer sends particles to follower (WebSocket broadcast). Follower pulses green. |

Block height counter in corner increments each cycle.

## Interaction

- **Module legend:** Clickable module swatches (shared Legend component). Clicking highlights that module across all pipelines and internal dots; dims everything else.
- **Node hover:** Hovering a validator/indexer/follower shows tooltip with description.
- **Module dot click:** Clicking internal module dots highlights that module globally.
- **Phase indicator:** Top-right corner shows current phase name and progress bar.

## File Structure

```
src/data/alto/
  layout.js       - positions, cluster, node definitions
  modules.js      - 9 module definitions
  pipelines.js    - P2P, HTTP push, sync pipelines + internal modules

src/hooks/useAltoAnimation.js  - consensus round cycle

src/components/
  AltoVisualization.jsx  - top-level composition
  nodes/
    AltoValidatorNode.jsx  - validator circle with 5 internal dots
    AltoIndexerNode.jsx    - indexer rounded rect
    FollowerNode.jsx       - follower rounded rect
  connections/
    AltoP2PMesh.jsx        - validator-to-validator mesh (reuse ConnectionPipeline)
    HttpConnection.jsx     - validator-to-indexer and indexer-to-follower

src/App.jsx - add 'alto' to EXAMPLES array
```

Shared components reused without modification: Legend, ConnectionPipeline.

New AltoTooltip defined inline in AltoVisualization (same pattern as sync's SyncTooltip).
