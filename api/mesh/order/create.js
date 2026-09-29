import { meshOrders } from '../../_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let orderData = req.body;
  if (typeof orderData === 'string') {
    try { orderData = JSON.parse(orderData); } catch (e) { orderData = {}; }
  }

  const orderId = 'ord_' + Math.random().toString(36).substring(2, 9);
  const remoteIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim().replace('::ffff:', '');

  meshOrders.set(orderId, {
    orderId,
    senderName: orderData.senderName || 'BeamDrop Station',
    senderIp: orderData.senderIp || remoteIp,
    senderType: orderData.senderType || 'laptop',
    targetPeerId: orderData.targetPeerId || '',
    targetIp: orderData.targetIp || '',
    payload: orderData.payload || {},
    status: 'pending',
    createdAt: Date.now()
  });

  return res.status(200).json({ success: true, orderId });
}
