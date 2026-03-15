export const WIDTH = 1200;
export const HEIGHT = 860;

export const CLUSTER = {
  cx: WIDTH / 2,
  cy: 420,
  width: 620,
  height: 620,
};

const DIAMOND = [
  { dx: 0, dy: -240 },
  { dx: -235, dy: 0 },
  { dx: 235, dy: 0 },
  { dx: 0, dy: 240 },
];

export const PARTICIPANTS = DIAMOND.map((offset, index) => ({
  id: `P${index}`,
  label: `P${index}`,
  x: CLUSTER.cx + offset.dx,
  y: CLUSTER.cy + offset.dy,
}));

export const BOOTSTRAPPERS = [PARTICIPANTS[0].id];

export const PARTICIPANT_INTERNAL_MODULES = [
  'consensus',
  'p2p',
  'cryptography',
  'storage',
  'parallel',
  'runtime',
];
