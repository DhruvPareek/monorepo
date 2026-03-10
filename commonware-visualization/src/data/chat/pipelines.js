export const P2P_PIPELINE = [
  { module: 'cryptography', label: 'identity', side: 'source', width: 66 },
  { module: 'p2p', label: 'p2p', side: 'center', width: 62 },
  { module: 'cryptography', label: 'identity', side: 'dest', width: 66 },
];

export const CHAT_PEER_INTERNAL = [
  { module: 'cryptography' },
  { module: 'p2p' },
  { module: 'runtime' },
];
