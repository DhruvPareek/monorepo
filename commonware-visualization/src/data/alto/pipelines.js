// P2P pipeline: validator-to-validator consensus messages
export const P2P_PIPELINE = [
  { module: 'broadcast', label: 'buffer', side: 'source' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'p2p', label: 'p2p', side: 'center' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'broadcast', label: 'buffer', side: 'dest' },
];

// HTTP push pipeline: validator-to-indexer block/certificate upload
export const HTTP_PUSH_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'runtime', label: 'HTTP POST', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Sync pipeline: indexer-to-follower WebSocket + HTTP backfill
export const SYNC_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'runtime', label: 'HTTP/WS', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Internal modules displayed as dots inside each node
export const VALIDATOR_INTERNAL = [
  { module: 'consensus', label: 'simplex' },
  { module: 'storage', label: 'archive' },
  { module: 'broadcast', label: 'buffer' },
  { module: 'parallel', label: 'BLS verify' },
  { module: 'resolver', label: 'backfill' },
];

export const INDEXER_INTERNAL = [
  { module: 'parallel', label: 'BLS verify' },
  { module: 'runtime', label: 'async' },
];

export const FOLLOWER_INTERNAL = [
  { module: 'storage', label: 'archive' },
  { module: 'parallel', label: 'BLS verify' },
  { module: 'resolver', label: 'backfill' },
  { module: 'runtime', label: 'async' },
];
