export const PROVISIONING_PIPELINE = [
  { module: 'cryptography', label: 'keys', side: 'source' },
  { module: 'codec', label: 'hex', side: 'inner' },
  { label: 'bootstrappers', side: 'inner', color: '#90A4AE', width: 84 },
  { label: 'peer yaml', side: 'dest', color: '#90A4AE', width: 68 },
];

export const MONITORING_PROVISIONING_PIPELINE = [
  { module: 'deployer', label: 'config', side: 'source' },
  { label: 'config.yaml', side: 'inner', color: '#90A4AE', width: 82 },
  { label: 'dashboard.json', side: 'dest', color: '#90A4AE', width: 90 },
];

export const DISCOVERY_PIPELINE = [
  { module: 'codec', label: 'encode', side: 'source' },
  {
    label: 'Greeting / BitVec / Peers',
    side: 'inner',
    color: '#90A4AE',
    width: 128,
  },
  { module: 'stream', label: 'encrypted', side: 'center', width: 78 },
  { module: 'codec', label: 'decode', side: 'dest' },
];

export const FLOOD_PIPELINE = [
  { module: 'codec', label: 'Data', side: 'source' },
  { module: 'p2p', label: 'channel 0', side: 'inner', width: 78 },
  { module: 'stream', label: 'encrypted', side: 'dest', width: 78 },
];

export const TELEMETRY_PIPELINE = [
  { module: 'runtime', label: 'runtime', side: 'source', width: 62 },
  { label: '/metrics + OTLP', side: 'inner', color: '#90A4AE', width: 106 },
  { label: 'monitoring', side: 'dest', color: '#90A4AE', width: 80 },
];

export const PEER_INTERNAL = [
  { module: 'cryptography', label: 'identity' },
  { module: 'codec', label: 'payloads' },
  { module: 'p2p', label: 'discovery' },
  { module: 'stream', label: 'encrypted' },
  { module: 'runtime', label: 'tasks' },
];
