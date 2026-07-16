// SVG viewBox dimensions
export const WIDTH = 1150;
export const HEIGHT = 800;

// Validator cluster center
export const CLUSTER = {
  label: 'Validators',
  cx: 590,
  cy: 400,
  width: 540,
  height: 560,
};

// Four validators arranged as a diamond around the cluster center. All four
// vote (they are primaries); each runs its own mempool HTTP listener.
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

// Off-cluster nodes, stacked as vertical columns flanking the cluster to keep
// the scene compact. Left column (submit path): the spammer feeds the relayer,
// a non-voting secondary. Right column (finalized-artifact path): the indexer
// uploader secondary feeds the exoware store (Indexer), which streams to the
// Explorer.
export const SPAMMER = { x: 130, y: 250 };
export const RELAYER = { x: 130, y: 550 };
export const INDEXER_SECONDARY = { x: 1020, y: 170 };
export const INDEXER = { x: 1020, y: 415 };
export const EXPLORER = { x: 1020, y: 660 };

// Modules carried on each connection class (used for highlight dimming).
export const P2P_MESH_MODULES = [
  'consensus',
  'marshal',
  'resolver',
  'cryptography',
  'p2p',
];
export const SUBMIT_CONNECTION_MODULES = ['cryptography', 'codec'];
export const RELAY_CONNECTION_MODULES = ['codec', 'mempool'];
export const FOLLOW_CONNECTION_MODULES = ['marshal', 'consensus', 'p2p'];
export const UPLOAD_CONNECTION_MODULES = ['codec', 'cryptography', 'storage'];
export const STREAM_CONNECTION_MODULES = ['codec'];
