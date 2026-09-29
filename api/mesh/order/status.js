import { meshOrders } from '../../_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const orderId = req.query?.orderId;
  if (orderId && meshOrders.has(orderId)) {
    const ord = meshOrders.get(orderId);
    return res.status(200).json({ success: true, status: ord.status });
  }

  return res.status(404).json({ success: false, error: 'Order not found' });
}
