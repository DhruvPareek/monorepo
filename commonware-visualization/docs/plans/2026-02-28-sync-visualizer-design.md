# Sync Visualizer + Multi-Example Navigation Design

## Summary

Add a sync example visualizer alongside the existing bridge visualizer, with tab-based navigation to switch between them. The sync visualizer shows continuous state synchronization between a server and client using QMDB with Merkle proofs.

## Navigation

- Tab bar at the top of the page, above the logo
- Two tabs: "bridge" and "sync"
- `App.jsx` manages `activeExample` state, conditionally renders the appropriate visualizer
- No router needed

## Sync Visualizer

### Layout (1200x860 SVG, left-right)

```
   +--[SERVER]---+                          +--[CLIENT]---+
   |             |                          |             |
   |  storage    |   codec -> stream -> codec |  storage    |
   |  (QMDB)    | ========================== |  (QMDB)    |
   |  sha256     |    (framed TCP pipe)       |  sha256     |
   |             |                          |             |
   +--------------+                          +--------------+

              runtime (async foundation)
```

- Server at x:300, large rounded rect (~200w x 300h)
- Client at x:900, same dimensions
- Connection pipeline between them with module chips
- Runtime band across bottom (shared with bridge)

### Connection Pipeline

```js
SYNC_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'stream', label: 'frames', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
]
```

No cryptography in the pipeline -- sync uses plain TCP, not encrypted streams. SHA-256 is used internally for Merkle proofs, shown inside nodes.

### Internal Node Modules

```js
SERVER_INTERNAL = [
  { module: 'storage', label: 'QMDB' },
  { module: 'cryptography', label: 'sha256' },
  { module: 'runtime', label: 'async' },
]

CLIENT_INTERNAL = [
  { module: 'storage', label: 'QMDB' },
  { module: 'cryptography', label: 'sha256' },
  { module: 'runtime', label: 'async' },
]
```

### Animation Phases

```js
SYNC_PHASES = [
  { name: 'ADD_OPS',    duration: 1000 },  // server adds operations to QMDB
  { name: 'GET_TARGET', duration: 1000 },  // client requests sync target
  { name: 'FETCH_OPS',  duration: 2000 },  // client fetches batches + proofs
  { name: 'VERIFY',     duration: 1500 },  // client verifies Merkle proofs
  { name: 'APPLY',      duration: 1500 },  // client applies to local QMDB
  { name: 'SYNCED',     duration: 1000 },  // databases match
]
```

### Module Descriptions (Sync-specific)

| Module | Short | Detail |
|--------|-------|--------|
| storage | QMDB state sync | QMDB (Qualified Merkle Database) in any/current/immutable variants. Server holds the evolving database; client rebuilds a verified copy. Merkle proofs ensure every fetched batch is consistent with the server's tree. |
| stream | Frame-based TCP | Length-prefixed frame encoding/decoding via send_frame/recv_frame. Plain TCP (no encryption). recv_frame must never be cancelled mid-read to avoid corrupting the stream. |
| codec | Wire serialization | Encodes/decodes all sync protocol messages: GetSyncTarget, GetOperations requests and their responses (Target, operations + Merkle proof, errors). |
| cryptography | SHA-256 Merkle proofs | SHA-256 hashing for QMDB Merkle tree construction. Proofs verify that fetched operation batches are consistent with the server's root. Also used to deterministically generate test operations. |
| runtime | Async foundation | Tokio-based executor: task spawning (recv loops, handlers, sync engine), TCP networking (bind/dial), storage I/O for QMDB partitions, timers for operation intervals and sync sleeps. |

## Shared Infrastructure

Reuse from bridge:
- Legend.jsx (parameterized with module list)
- Tooltip.jsx
- ConnectionPipeline.jsx + PipelineChip
- Module colors from modules.js
- Runtime foundation band pattern

## File Changes

### New files
- `src/components/SyncVisualization.jsx` -- main sync visualizer
- `src/components/nodes/ServerNode.jsx` -- server node (large rounded rect)
- `src/components/nodes/ClientNode.jsx` -- client node (large rounded rect)
- `src/data/sync/layout.js` -- server/client positions
- `src/data/sync/pipelines.js` -- sync pipeline stages + internal modules
- `src/data/sync/modules.js` -- sync-specific module descriptions
- `src/hooks/useSyncAnimation.js` -- sync animation phases

### Modified files
- `src/App.jsx` -- tab state + conditional rendering
- `src/App.css` -- tab bar styles
- `src/components/Legend.jsx` -- accept module list as prop (instead of importing MODULE_LIST)
