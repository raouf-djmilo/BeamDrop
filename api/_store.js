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

export function getClientNetworkHash(req, optionalPin = '') {
  const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
  let cleanIp = rawIp.replace('::ffff:', '');

  // Normalize IPv6 to /64 subnet prefix so all devices on same home router / hotspot match (PairDrop open-source standard)
  if (cleanIp.includes(':')) {
    const parts = cleanIp.split(':');
    cleanIp = parts.slice(0, 4).join(':'); // First 64 bits (/64)
  }

  let hash = 0;
  for (let i = 0; i < cleanIp.length; i++) {
    hash = (hash << 5) - hash + cleanIp.charCodeAt(i);
    hash |= 0;
  }
  const baseRoom = 'room-' + Math.abs(hash).toString(36).slice(0, 8);
  const pin = (optionalPin || req.query?.pin || '').toString().trim();
  return pin ? `${baseRoom}-pin-${pin}` : baseRoom;
}
