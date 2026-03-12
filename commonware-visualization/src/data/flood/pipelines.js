export const PROVISIONING_PIPELINE = [];

export const MONITORING_PROVISIONING_PIPELINE = [];

export const DISCOVERY_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source', width: 62 },
  { module: 'p2p', label: 'p2p', side: 'inner', width: 54 },
  { module: 'stream', label: 'stream', side: 'inner', width: 62 },
  { module: 'codec', label: 'decode', side: 'dest', width: 62 },
];

export const FLOOD_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source', width: 62 },
  { module: 'p2p', label: 'p2p', side: 'inner', width: 54 },
  { module: 'stream', label: 'stream', side: 'inner', width: 62 },
  { module: 'codec', label: 'decode', side: 'dest', width: 62 },
];

export const TELEMETRY_PIPELINE = [
  { module: 'runtime', label: 'runtime', side: 'source', width: 62 },
];

export const PEER_INTERNAL = [
  { module: 'cryptography', label: 'identity' },
  { module: 'codec', label: 'payloads' },
  { module: 'p2p', label: 'discovery' },
  { module: 'stream', label: 'encrypted' },
  { module: 'runtime', label: 'tasks' },
];
