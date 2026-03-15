export const VOTE_PIPELINE = [
  { module: 'consensus', label: 'simplex', side: 'source', width: 62 },
  { module: 'cryptography', label: 'peer auth', side: 'inner', width: 60 },
  { module: 'p2p', label: 'votes(0)', side: 'center', width: 72 },
  { module: 'cryptography', label: 'peer auth', side: 'inner', width: 60 },
  { module: 'consensus', label: 'simplex', side: 'dest', width: 62 },
];

export const CERTIFICATE_PIPELINE = [
  { module: 'consensus', label: 'simplex', side: 'source', width: 62 },
  { module: 'cryptography', label: 'peer auth', side: 'inner', width: 60 },
  { module: 'p2p', label: 'certs(1)', side: 'center', width: 72 },
  { module: 'cryptography', label: 'peer auth', side: 'inner', width: 60 },
  { module: 'consensus', label: 'simplex', side: 'dest', width: 62 },
];

export const RESOLVER_PIPELINE = [
  { module: 'consensus', label: 'simplex', side: 'source', width: 62 },
  { module: 'cryptography', label: 'peer auth', side: 'inner', width: 60 },
  { module: 'p2p', label: 'repair(2)', side: 'center', width: 76 },
  { module: 'cryptography', label: 'peer auth', side: 'inner', width: 60 },
  { module: 'consensus', label: 'simplex', side: 'dest', width: 62 },
];
