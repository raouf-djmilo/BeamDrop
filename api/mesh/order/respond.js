import { meshOrders } from '../../_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { orderId, status } = body || {};
  if (orderId && meshOrders.has(orderId)) {
    const ord = meshOrders.get(orderId);
    ord.status = status; // 'accepted' | 'declined'
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ success: false, error: 'Order not found' });
}
