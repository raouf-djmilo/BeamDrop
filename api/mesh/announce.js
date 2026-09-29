import { meshPeers, getClientNetworkHash } from '../_store.js';

export default function handler(req, res) {
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

  if (data && data.id) {
    meshPeers.set(data.id, {
      ...data,
      roomHash,
      clientIp: rawIp,
      ip: data.ip || rawIp,
      lastSeen: Date.now()
    });
  }

  // Prune peers inactive for > 35 seconds
  const now = Date.now();
  for (const [id, peer] of meshPeers.entries()) {
    if (now - peer.lastSeen > 35000) {
      meshPeers.delete(id);
    }
  }

  // Count active peers in the same network room
  let roomCount = 0;
  for (const peer of meshPeers.values()) {
    if (peer.roomHash === roomHash) roomCount++;
  }

  return res.status(200).json({
    success: true,
    roomHash,
    clientIp: rawIp,
    count: roomCount
  });
}
