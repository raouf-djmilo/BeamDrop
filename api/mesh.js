import { meshPeers, meshOrders, getClientNetworkHash } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rawUrl = req.url || '';
  const meshRoute = String(req.query?.meshRoute || rawUrl);

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = {}; }
  }

  // 1. Order Create (/api/mesh/order/create)
  if (meshRoute.includes('order/create')) {
    const orderData = data || {};
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

  // 2. Order Poll (/api/mesh/order/poll)
  if (meshRoute.includes('order/poll')) {
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

  // 3. Order Respond (/api/mesh/order/respond)
  if (meshRoute.includes('order/respond')) {
    const { orderId, status } = data || {};
    if (orderId && meshOrders.has(orderId)) {
      const ord = meshOrders.get(orderId);
      ord.status = status; // 'accepted' | 'declined'
      return res.status(200).json({ success: true });
    }
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // 4. Order Status (/api/mesh/order/status)
  if (meshRoute.includes('order/status')) {
    const orderId = req.query?.orderId;
    if (orderId && meshOrders.has(orderId)) {
      const ord = meshOrders.get(orderId);
      return res.status(200).json({ success: true, status: ord.status });
    }
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // 5. Default Mesh Announce & Devices (/api/mesh, /api/mesh/announce, /api/mesh/devices)
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

  // Filter peers that match roomHash, private subnet, or PIN
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
