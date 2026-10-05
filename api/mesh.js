import { meshPeers, getClientNetworkHash } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = {}; }
  }

  const roomPin = (data && data.pin) || req.query?.pin || '';
  const roomHash = getClientNetworkHash(req, roomPin);
  const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim().replace('::ffff:', '');
  const subnet = data?.subnet || (data?.ip ? data.ip.split('.').slice(0, 3).join('.') : '');

  const now = Date.now();

  // If registering a peer (POST or has data.id)
  if (data && data.id) {
    meshPeers.set(data.id, {
      ...data,
      roomHash,
      subnet,
      clientIp: rawIp,
      ip: data.ip || rawIp,
      lastSeen: now
    });
  }

  // Prune inactive peers (> 35 seconds)
  for (const [id, peer] of meshPeers.entries()) {
    if (now - peer.lastSeen > 35000) {
      meshPeers.delete(id);
    }
  }

  // Filter peers that match:
  // 1. Same roomHash (public IP hash + pin) OR
  // 2. Same private subnet prefix (e.g. 192.168.1) if on same local LAN OR
  // 3. Same PIN (if user typed a PIN)
  const activeInRoom = [];
  for (const [id, peer] of meshPeers.entries()) {
    const isSamePin = Boolean(roomPin && peer.pin && peer.pin === roomPin);
    const isSameRoomHash = peer.roomHash === roomHash;
    const isSameSubnet = Boolean(subnet && peer.subnet && peer.subnet === subnet);

    if (isSamePin || isSameRoomHash || isSameSubnet) {
      activeInRoom.push(peer);
    }
  }

  return res.status(200).json({
    success: true,
    roomHash,
    clientIp: rawIp,
    count: activeInRoom.length,
    devices: activeInRoom
  });
}
