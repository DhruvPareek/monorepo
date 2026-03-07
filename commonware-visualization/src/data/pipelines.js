// Ordered module pipelines representing actual data flow in the bridge example.
// Each stage has: module key, a short label describing what it does at that point,
// and a direction (source-side, transport, or dest-side).

// Validator -> Validator: consensus simplexificate over p2p
// The consensus engine generates a vote, p2p authenticates with ed25519 and transports it.
export const P2P_PIPELINE = [
  { module: 'consensus', label: 'simplex', side: 'source' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'p2p', label: 'p2p', side: 'center' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'consensus', label: 'simplex', side: 'dest' },
];

// Validator -> Indexer: block or finalization upload/download over encrypted stream
// Application encodes with codec, sends over encrypted stream, indexer decodes.
export const STREAM_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'stream', label: 'stream', side: 'center' },
  { module: 'cryptography', label: 'peer auth', side: 'inner' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Modules that live inside each node type
export const VALIDATOR_INTERNAL = [
  { module: 'storage' },
  { module: 'parallel' },
  { module: 'runtime' },
];

export const INDEXER_INTERNAL = [
  { module: 'parallel' },
  { module: 'runtime' },
];
