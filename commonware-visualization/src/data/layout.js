// SVG viewBox dimensions
export const WIDTH = 1200;
export const HEIGHT = 860;

// Indexer position
export const INDEXER = { x: 600, y: 100 };

// Network cluster centers and bounds
export const NETWORK_1 = {
  label: 'Network 1',
  cx: 300,
  cy: 520,
  width: 400,
  height: 370,
};

export const NETWORK_2 = {
  label: 'Network 2',
  cx: 900,
  cy: 520,
  width: 400,
  height: 370,
};

// Diamond arrangement offsets from cluster center
const DIAMOND = [
  { dx: 0, dy: -130 }, // top
  { dx: -145, dy: 0 }, // left
  { dx: 145, dy: 0 }, // right
  { dx: 0, dy: 130 }, // bottom
];

function makeValidators(network, startIndex) {
  return DIAMOND.map((d, i) => ({
    id: `V${startIndex + i}`,
    label: `V${startIndex + i}`,
    x: network.cx + d.dx,
    y: network.cy + d.dy,
    network: network.label,
  }));
}

export const VALIDATORS_1 = makeValidators(NETWORK_1, 1);
export const VALIDATORS_2 = makeValidators(NETWORK_2, 5);
export const ALL_VALIDATORS = [...VALIDATORS_1, ...VALIDATORS_2];

// Modules present on each connection type
export const INTRA_CLUSTER_MODULES = ['p2p', 'consensus', 'cryptography'];
export const VALIDATOR_INDEXER_MODULES = ['stream', 'codec'];
export const INDEXER_MODULES = ['parallel', 'runtime'];
export const VALIDATOR_MODULES = ['storage', 'parallel', 'runtime'];
