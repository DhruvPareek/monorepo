export const FLOOD_MODULES = {
  cryptography: {
    name: 'cryptography',
    color: '#C62828',
    short: 'Ed25519 identity',
    detail:
      'Peers use Ed25519 keys for identity, authentication, and signatures over discovery metadata such as signed Info records.',
  },
  codec: {
    name: 'codec',
    color: '#455A64',
    short: 'Binary encoding',
    detail:
      'Encodes and decodes discovery payloads and application data, including Data, Greeting, BitVec, and Peers messages.',
  },
  p2p: {
    name: 'p2p',
    color: '#0097A7',
    short: 'Authenticated discovery',
    detail:
      'authenticated::discovery manages peer-set authorization, discovery gossip, routing, channel registration, and Recipients::All delivery to currently connected peers.',
  },
  stream: {
    name: 'stream',
    color: '#1565C0',
    short: 'Encrypted transport',
    detail:
      'commonware-stream::encrypted provides authenticated handshakes, encrypted framing, mutual identity verification, and forward-secret sessions underneath discovery.',
  },
  runtime: {
    name: 'runtime',
    color: '#2E7D32',
    short: 'Tokio execution',
    detail:
      'commonware-runtime::tokio runs the listener, dialer, sender, receiver, telemetry export, timers, and metrics registration.',
  },
  deployer: {
    name: 'deployer',
    color: '#6D4C41',
    short: 'AWS provisioning',
    detail:
      'commonware-deployer consumes the setup artifacts, uploads binaries and configs, generates hosts.yaml, provisions EC2 instances, and stands up the monitoring stack.',
  },
};

export const FLOOD_MODULE_LIST = Object.values(FLOOD_MODULES);
