// Validator-to-validator lanes over the shared authenticated mesh.
export const VALIDATOR_VOTE_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'consensus', label: 'simplex votes', side: 'inner', width: 88 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

export const VALIDATOR_CERT_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'consensus', label: 'simplex certs', side: 'inner', width: 88 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

export const VALIDATOR_CERT_REPAIR_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'resolver', label: 'cert repair', side: 'inner', width: 82 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

export const VALIDATOR_BLOCK_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'broadcast', label: 'blocks', side: 'inner' },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

export const VALIDATOR_MARSHAL_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { module: 'consensus', label: 'marshal ingest', side: 'inner', width: 92 },
  { module: 'p2p', label: 'mesh', side: 'center' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Validator-to-indexer artifact publication.
export const ARTIFACT_UPLOAD_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { label: 'HTTP POST', side: 'inner', color: '#90A4AE' },
  { module: 'codec', label: 'decode', side: 'inner' },
  { module: 'cryptography', label: 'verify', side: 'dest' },
];

// Indexer live stream to follower.
export const WS_STREAM_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { label: 'WS stream', side: 'center', color: '#90A4AE' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Overview repair edge used in the default simplified mode.
export const HTTP_REPAIR_PIPELINE = [
  { module: 'resolver', label: 'request', side: 'source' },
  { label: 'HTTP GET', side: 'center', color: '#90A4AE' },
  { module: 'codec', label: 'payload', side: 'dest' },
];

// Request path for marshal-driven repair/backfill.
export const HTTP_REPAIR_REQUEST_PIPELINE = [
  { module: 'resolver', label: 'request', side: 'source' },
  { label: 'HTTP GET', side: 'dest', color: '#90A4AE' },
];

// Response path returning an Alto payload for repair/backfill.
export const HTTP_REPAIR_RESPONSE_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { label: 'payload', side: 'inner', color: '#90A4AE' },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Optional startup checkpoint fetch for latest finalization.
export const CHECKPOINT_REQUEST_PIPELINE = [
  { label: 'GET latest', side: 'center', color: '#90A4AE' },
];

export const CHECKPOINT_RESPONSE_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  { label: 'finalization', side: 'inner', color: '#90A4AE', width: 78 },
  { module: 'codec', label: 'decode', side: 'dest' },
];

// Direct liveness probe used before follower startup proceeds.
export const HEALTH_PIPELINE = [
  { label: 'GET /health', side: 'center', color: '#90A4AE' },
];

// Internal modules displayed as dots inside each node
export const VALIDATOR_INTERNAL = [
  { module: 'consensus', label: 'simplex+marshal' },
  { module: 'storage', label: 'archive' },
  { module: 'broadcast', label: 'blocks' },
  { module: 'p2p', label: 'mesh' },
  { module: 'resolver', label: 'repair' },
  { module: 'runtime', label: 'async' },
];

export const INDEXER_INTERNAL = [
  { module: 'codec', label: 'decode' },
  { module: 'cryptography', label: 'verify' },
  { module: 'parallel', label: 'BLS verify' },
];

export const FOLLOWER_INTERNAL = [
  { module: 'consensus', label: 'marshal' },
  { module: 'storage', label: 'archive' },
  { module: 'parallel', label: 'BLS verify' },
  { module: 'resolver', label: 'repair' },
  { module: 'broadcast', label: 'noop buffer' },
  { module: 'cryptography', label: 'verify' },
  { module: 'runtime', label: 'async' },
];
