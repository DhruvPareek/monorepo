export const WIDTH = 1120;
export const HEIGHT = 840;

export const PEER_CLUSTER = {
  label: 'Flood peers',
  cx: 420,
  cy: 355,
  width: 690,
  height: 620,
};

const RADIUS = 220;
const PENTAGON = Array.from({ length: 5 }, (_, i) => {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5;
  return {
    dx: Math.round(RADIUS * Math.cos(angle)),
    dy: Math.round(RADIUS * Math.sin(angle)),
  };
});

export const PEERS = PENTAGON.map((offset, i) => ({
  id: `P${i + 1}`,
  label: `P${i + 1}`,
  x: PEER_CLUSTER.cx + offset.dx,
  y: PEER_CLUSTER.cy + offset.dy,
}));

export const BOOTSTRAPPERS = [PEERS[0].id, PEERS[1].id];

export const SETUP = { x: 120, y: 145, width: 160, height: 84 };
export const MONITORING = { x: 930, y: 320, width: 188, height: 126 };
export const SETUP_OUTPUT = { x: 895, y: 180, width: 220, height: 96 };

export const PROVISION_SETUP = { x: 410, y: 118, width: 180, height: 88 };
export const PROVISION_PEER_CLUSTER = {
  label: 'Peer config files',
  cx: 420,
  cy: 340,
  width: 620,
  height: 220,
};
export const PROVISION_PEERS = [
  { id: 'P1', label: 'P1', x: 180, y: 340 },
  { id: 'P2', label: 'P2', x: 300, y: 340 },
  { id: 'P3', label: 'P3', x: 420, y: 340 },
  { id: 'P4', label: 'P4', x: 540, y: 340 },
  { id: 'P5', label: 'P5', x: 660, y: 340 },
];

export const DISCOVERY_CONNECTION_MODULES = [
  'cryptography',
  'codec',
  'p2p',
  'stream',
];

export const FLOOD_CONNECTION_MODULES = ['codec', 'p2p', 'stream'];
export const PROVISIONING_CONNECTION_MODULES = ['cryptography', 'codec'];
export const SETUP_OUTPUT_CONNECTION_MODULES = ['deployer'];
export const TELEMETRY_CONNECTION_MODULES = ['runtime'];

export const PEER_MODULES = [
  'cryptography',
  'codec',
  'p2p',
  'stream',
  'runtime',
];
