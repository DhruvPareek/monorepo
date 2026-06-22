// Validator-to-validator lanes over the shared authenticated discovery mesh.
// Each lane maps to one of the engine's rate-limited p2p channels.

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

// Channel 2: simplex resolver certificate repair by view.
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

// Channel 4: marshal block backfill resolver.
export const BACKFILL_PIPELINE = [
  { module: 'resolver', label: 'block request', side: 'source', width: 84 },
  { module: 'marshal', label: 'backfill', side: 'inner' },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Channels 5 and 6: QMDB state-sync and transaction-history sync.
export const DB_SYNC_PIPELINE = [
  { module: 'glue', label: 'sync plan', side: 'source' },
  { module: 'resolver', label: 'state + tx ops', side: 'inner', width: 92 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'storage', label: 'QMDB apply', side: 'dest', width: 84 },
];

// Spammer to primary validator: signed transactions submitted over HTTP.
export const SUBMIT_PIPELINE = [
  { module: 'cryptography', label: 'sign batch', side: 'source', width: 78 },
  { label: 'HTTP POST', side: 'inner', color: '#90A4AE' },
  { module: 'mempool', label: 'admit', side: 'dest' },
];

// Secondary validator to indexer: finalized artifact upload to the exoware Store.
export const UPLOAD_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { label: 'upload', side: 'inner', color: '#90A4AE' },
  { module: 'storage', label: 'exoware store', side: 'dest', width: 84 },
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
  { module: 'mempool', label: 'client' },
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
