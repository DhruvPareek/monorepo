// Internal architecture of a single PRIMARY validator process. The primary
// holds a DKG share, votes in simplex, runs the mempool HTTP server, and
// proposes blocks when elected leader. Relayer and indexer (secondary-only)
// paths are intentionally omitted.

export const WIDTH = 1150;
export const HEIGHT = 720;

// The validator process boundary and the engine sub-container drawn inside it.
export const BOUNDARY = { x: 235, y: 95, w: 825, h: 560 };
export const ENGINE = { x: 545, y: 135, w: 505, h: 475 };

// Subsystem and external boxes, keyed by id.
export const NODES = {
  client: {
    id: 'client',
    kind: 'external',
    x: 115,
    y: 250,
    w: 130,
    h: 64,
    label: 'Client',
    sublabel: 'submits txs',
    color: '#607D8B',
  },
  peers: {
    id: 'peers',
    kind: 'external',
    x: 115,
    y: 505,
    w: 130,
    h: 74,
    label: 'Peers',
    sublabel: 'other validators',
    color: '#607D8B',
  },
  config: {
    id: 'config',
    kind: 'context',
    x: 330,
    y: 150,
    w: 158,
    h: 42,
    label: 'config',
    sublabel: 'DKG share -> primary',
    color: '#B0BEC5',
  },
  mempool: {
    id: 'mempool',
    kind: 'subsystem',
    x: 350,
    y: 300,
    w: 158,
    h: 66,
    label: 'mempool',
    sublabel: 'HTTP intake',
    color: '#1565C0',
  },
  p2p: {
    id: 'p2p',
    kind: 'subsystem',
    x: 350,
    y: 485,
    w: 158,
    h: 66,
    label: 'p2p discovery',
    sublabel: '8 channels',
    color: '#0097A7',
  },
  simplex: {
    id: 'simplex',
    kind: 'subsystem',
    x: 630,
    y: 235,
    w: 146,
    h: 62,
    label: 'simplex',
    sublabel: 'BFT votes + certs',
    color: '#7B1FA2',
  },
  marshal: {
    id: 'marshal',
    kind: 'subsystem',
    x: 630,
    y: 500,
    w: 146,
    h: 62,
    label: 'marshal',
    sublabel: 'erasure shards',
    color: '#E65100',
  },
  glue: {
    id: 'glue',
    kind: 'subsystem',
    x: 805,
    y: 368,
    w: 150,
    h: 66,
    label: 'glue stateful',
    sublabel: 'QMDB lifecycle',
    color: '#00695C',
  },
  application: {
    id: 'application',
    kind: 'subsystem',
    x: 975,
    y: 235,
    w: 140,
    h: 62,
    label: 'application',
    sublabel: 'execute transfers',
    color: '#37474F',
  },
  qmdb: {
    id: 'qmdb',
    kind: 'subsystem',
    x: 975,
    y: 500,
    w: 140,
    h: 62,
    label: 'QMDB',
    sublabel: 'state + tx DBs',
    color: '#795548',
  },
};

// Directed connectors between boxes. `step` keys group them under the flow
// selector; `config_mempool` is always-on faint context.
export const EDGES = [
  { id: 'submit', from: 'client', to: 'mempool', color: '#1565C0', label: 'POST txs' },
  { id: 'txsource', from: 'mempool', to: 'application', color: '#1565C0', label: 'TxSource' },
  { id: 'elect', from: 'simplex', to: 'glue', color: '#7B1FA2', label: 'propose / verify' },
  { id: 'glue_app', from: 'glue', to: 'application', color: '#00695C', label: 'execute' },
  { id: 'app_qmdb', from: 'application', to: 'qmdb', color: '#37474F', label: 'roots' },
  { id: 'block', from: 'glue', to: 'marshal', color: '#E65100', label: 'block' },
  { id: 'marshal_p2p', from: 'marshal', to: 'p2p', color: '#E65100', label: 'shards' },
  { id: 'simplex_p2p', from: 'simplex', to: 'p2p', color: '#7B1FA2', label: 'votes / certs' },
  { id: 'p2p_peers', from: 'p2p', to: 'peers', color: '#0097A7', label: 'mesh' },
  { id: 'finalize', from: 'marshal', to: 'glue', color: '#E65100', label: 'finalization' },
  { id: 'glue_commit', from: 'glue', to: 'qmdb', color: '#00695C', label: 'commit' },
  { id: 'reporter', from: 'marshal', to: 'mempool', color: '#2E7D32', label: 'resolve' },
  { id: 'config_mempool', from: 'config', to: 'mempool', color: '#B0BEC5', label: 'role', dashed: true, context: true },
];

// Point on a node's border in the direction of a target point.
function borderPoint(node, tx, ty) {
  const dx = tx - node.x;
  const dy = ty - node.y;
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };
  const sx = dx !== 0 ? node.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? node.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: node.x + dx * s, y: node.y + dy * s };
}

// Resolve an edge to its clipped start/end points on the two node borders.
export function edgePoints(edge) {
  const a = NODES[edge.from];
  const b = NODES[edge.to];
  const start = borderPoint(a, b.x, b.y);
  const end = borderPoint(b, a.x, a.y);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}
