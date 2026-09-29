// In-Memory Shared Registry for Local Mesh Signaling
// Scoped across warm serverless container invocations

if (!global.__BEAMDROP_MESH_PEERS__) {
  global.__BEAMDROP_MESH_PEERS__ = new Map();
}

if (!global.__BEAMDROP_MESH_ORDERS__) {
  global.__BEAMDROP_MESH_ORDERS__ = new Map();
}

export const meshPeers = global.__BEAMDROP_MESH_PEERS__;
export const meshOrders = global.__BEAMDROP_MESH_ORDERS__;

export function getClientNetworkHash(req) {
  const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
  const cleanIp = rawIp.replace('::ffff:', '');

  let hash = 0;
  for (let i = 0; i < cleanIp.length; i++) {
    hash = (hash << 5) - hash + cleanIp.charCodeAt(i);
    hash |= 0;
  }
  return 'room-' + Math.abs(hash).toString(36).slice(0, 8);
}
