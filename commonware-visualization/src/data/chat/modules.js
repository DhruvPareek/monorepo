export const CHAT_MODULES = {
  p2p: {
    name: 'p2p',
    color: '#0097A7',
    short: 'Authenticated discovery',
    detail:
      'authenticated::discovery owns the friend-set authorization, bootstrap dialing, peer discovery gossip, channel registration, and Recipients::All fanout to currently connected friends.',
  },
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'Ed25519 identity',
    detail:
      'Deterministic Ed25519 keys identify each friend and authenticate peers during connection setup. The example uses these identities directly from the CLI seed values.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Tokio execution',
    detail:
      'commonware_runtime::tokio runs the listener, dialer, discovery actors, keyboard task, message receiver, timers, quotas, and metrics export used by the TUI.',
  },
};

export const CHAT_MODULE_LIST = Object.values(CHAT_MODULES);
