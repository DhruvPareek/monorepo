// SVG viewBox dimensions
export const WIDTH = 1120;
export const HEIGHT = 760;

// Validator cluster center
export const CLUSTER = {
  label: 'Validators',
  cx: 400,
  cy: 370,
  width: 700,
  height: 700,
};

// Pentagon arrangement offsets from cluster center
const PENTAGON_R = 255;
const PENTAGON = Array.from({ length: 5 }, (_, i) => {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5;
  return {
    dx: Math.round(PENTAGON_R * Math.cos(angle)),
    dy: Math.round(PENTAGON_R * Math.sin(angle)),
  };
});

export const VALIDATORS = PENTAGON.map((d, i) => ({
  id: `V${i + 1}`,
  label: `V${i + 1}`,
  x: CLUSTER.cx + d.dx,
  y: CLUSTER.cy + d.dy,
}));

// Indexer position
export const INDEXER = { x: 920, y: 180 };

// Follower position
export const FOLLOWER = { x: 920, y: 525 };

// Modules present on each connection type (for compact dot display)
export const P2P_MESH_MODULES = ['broadcast', 'cryptography', 'p2p'];
export const HTTP_PUSH_MODULES = ['codec', 'runtime'];
export const SYNC_CONNECTION_MODULES = ['codec', 'runtime'];

// Modules inside each node type (for highlight matching)
export const VALIDATOR_MODULES = [
  'consensus',
  'storage',
  'broadcast',
  'parallel',
  'resolver',
];
export const INDEXER_INTERNAL_MODULES = ['parallel', 'runtime'];
export const FOLLOWER_INTERNAL_MODULES = [
  'storage',
  'parallel',
  'resolver',
  'runtime',
];
