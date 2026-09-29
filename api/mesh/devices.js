import { meshPeers, getClientNetworkHash } from '../_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const roomHash = getClientNetworkHash(req);
  const now = Date.now();

  const activeInRoom = [];
  for (const [id, peer] of meshPeers.entries()) {
    if (now - peer.lastSeen > 35000) {
      meshPeers.delete(id);
    } else if (peer.roomHash === roomHash) {
      activeInRoom.push(peer);
    }
  }

  return res.status(200).json({
    success: true,
    roomHash,
    devices: activeInRoom
  });
}
