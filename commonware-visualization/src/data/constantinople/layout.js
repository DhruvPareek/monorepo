// SVG viewBox dimensions
export const WIDTH = 1200;
export const HEIGHT = 780;

// Validator cluster center
export const CLUSTER = {
  label: 'Validators',
  cx: 560,
  cy: 390,
  width: 540,
  height: 560,
};

// Four validators arranged as a diamond around the cluster center.
const DIAMOND_R = 175;
const DIAMOND = [
  { dx: 0, dy: -DIAMOND_R }, // top
  { dx: DIAMOND_R, dy: 0 }, // right
  { dx: 0, dy: DIAMOND_R }, // bottom
  { dx: -DIAMOND_R, dy: 0 }, // left
];

export const VALIDATORS = DIAMOND.map((d, i) => ({
  id: `V${i + 1}`,
  label: `V${i + 1}`,
  x: CLUSTER.cx + d.dx,
  y: CLUSTER.cy + d.dy,
}));

// The primary validator fronts the mempool HTTP listener (transaction intake).
export const PRIMARY_VALIDATOR = VALIDATORS[3].id; // left node, faces the spammer
// A secondary validator owns finalized-artifact uploads to the indexer.
export const INDEXER_UPLOADER = VALIDATORS[1].id; // right node, faces the indexer

// Off-cluster service positions.
export const SPAMMER = { x: 120, y: 390 };
export const INDEXER = { x: 1070, y: 215 };
export const EXPLORER = { x: 1070, y: 575 };

// Modules carried on each connection class (compact dot display).
export const P2P_MESH_MODULES = [
  'consensus',
  'marshal',
  'resolver',
  'cryptography',
  'p2p',
];
export const SUBMIT_CONNECTION_MODULES = ['cryptography', 'codec', 'mempool'];
export const UPLOAD_CONNECTION_MODULES = ['codec', 'cryptography', 'storage'];
export const STREAM_CONNECTION_MODULES = ['codec'];

// Modules present inside each node type (used for highlight matching).
export const VALIDATOR_MODULES = [
  'consensus',
  'marshal',
  'storage',
  'glue',
  'mempool',
  'p2p',
  'resolver',
  'cryptography',
  'runtime',
];
export const SPAMMER_MODULES = ['cryptography', 'codec', 'mempool'];
export const INDEXER_MODULES = ['codec', 'cryptography', 'storage'];
export const EXPLORER_MODULES = ['codec', 'cryptography', 'storage'];
