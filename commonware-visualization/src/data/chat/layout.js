export const WIDTH = 1160;
export const HEIGHT = 860;

export const FRIEND_CLUSTER = {
  label: 'authorized peer set 0 = {F1, F2, F3, F4}',
  cx: 400,
  cy: 430,
  width: 620,
  height: 620,
};

export const FRIENDS = [
  { id: 'F1', label: 'F1', x: 400, y: 230 },
  { id: 'F2', label: 'F2', x: 220, y: 430 },
  { id: 'F3', label: 'F3', x: 580, y: 430 },
  { id: 'F4', label: 'F4', x: 400, y: 630 },
];

export const BOOTSTRAPPERS = ['F1', 'F3'];

export const OUTSIDER = {
  id: 'F5',
  label: 'F5',
  x: 930,
  y: 430,
};

export const MESH_CONNECTION_MODULES = [
  'cryptography',
  'p2p',
];

export const CHAT_CONNECTION_MODULES = ['cryptography', 'p2p'];
