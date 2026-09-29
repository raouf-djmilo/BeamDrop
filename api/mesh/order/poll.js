import { meshOrders } from '../../_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const peerId = req.query?.peerId || '';
  const now = Date.now();

  for (const [id, ord] of meshOrders.entries()) {
    if (now - ord.createdAt > 90000) {
      meshOrders.delete(id);
      continue;
    }

    if (ord.status === 'pending' && (ord.targetPeerId === peerId || !ord.targetPeerId)) {
      return res.status(200).json({ hasOrder: true, order: ord });
    }
  }

  return res.status(200).json({ hasOrder: false });
}
