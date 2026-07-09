// Validator-to-validator lanes over the shared authenticated discovery mesh.
// Each lane maps to one of the engine's rate-limited p2p channels.

// Chips show the codec encode/decode boundary, the channel's owning module
// (commonware-resolver where it is the request/response mechanism), and the
// p2p transport - matching the codec-bracketed pipeline style used by the
// other visualizations. coding and parallel are folded into their owners.

// Channel 0: simplex votes.
export const VOTE_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'consensus', label: 'simplex votes', side: 'inner', width: 92 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channel 1: simplex threshold certificates.
export const CERT_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'consensus', label: 'threshold certs', side: 'inner', width: 96 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channel 2: simplex backfiller certificate repair by view.
export const CERT_REPAIR_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'resolver', label: 'cert repair', side: 'inner', width: 84 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channel 3: erasure-coded marshal shards.
export const SHARD_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'marshal', label: 'erasure shards', side: 'inner', width: 96 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channel 4: marshal block backfill resolver (marshal owner in the dots).
export const BACKFILL_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'resolver', label: 'block backfill', side: 'inner', width: 92 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channel 5: QMDB state-sync (glue-driven; applies to storage - both in the dots).
export const STATE_SYNC_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'resolver', label: 'state ops + proof', side: 'inner', width: 98 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channel 6: transaction-hash sync (compact QMDB frontier).
export const TX_SYNC_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'resolver', label: 'tx frontier', side: 'inner', width: 84 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channel 7: state-sync probe (glue-driven; response is a threshold finalization cert).
export const PROBE_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'consensus', label: 'finalization', side: 'inner', width: 84 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Spammer to relayer: a signed transaction batch submitted over HTTP.
export const SUBMIT_PIPELINE = [
  { module: 'cryptography', label: 'sign batch', side: 'source', width: 78 },
  { label: 'HTTP POST', side: 'center', color: '#90A4AE' },
];

// Relayer to the upcoming leader: the batch forwarded to that primary's mempool.
export const RELAY_PIPELINE = [
  { label: 'HTTP POST', side: 'source', color: '#90A4AE' },
  { module: 'mempool', label: 'mempool', side: 'dest' },
];

// Secondary validator to indexer: finalized artifact upload to the exoware Store.
export const UPLOAD_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'storage', label: 'store', side: 'dest' },
];

// Indexer to explorer: SQL metadata stream consumed by the live block explorer.
export const STREAM_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { label: 'gRPC stream', side: 'center', color: '#90A4AE', width: 64 },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Internal modules displayed as dots inside each node.
export const VALIDATOR_INTERNAL = [
  { module: 'consensus', label: 'simplex' },
  { module: 'marshal', label: 'shards' },
  { module: 'storage', label: 'QMDB' },
  { module: 'glue', label: 'stateful' },
  { module: 'mempool', label: 'txs' },
  { module: 'p2p', label: 'mesh' },
  { module: 'resolver', label: 'repair' },
  { module: 'cryptography', label: 'BLS+ed25519' },
  { module: 'runtime', label: 'async' },
];

export const SPAMMER_INTERNAL = [
  { module: 'cryptography', label: 'sign' },
  { module: 'codec', label: 'encode' },
];

export const INDEXER_INTERNAL = [
  { module: 'codec', label: 'decode' },
  { module: 'cryptography', label: 'verify' },
  { module: 'storage', label: 'store' },
];

export const EXPLORER_INTERNAL = [
  { module: 'codec', label: 'decode' },
  { module: 'cryptography', label: 'verify' },
  { module: 'storage', label: 'QMDB proof' },
];
