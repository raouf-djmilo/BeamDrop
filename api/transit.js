// In-Memory RAM-to-RAM Ephemeral Transit Engine (Zero Cloud Storage)
if (!global.__BEAMDROP_TRANSIT__) {
  global.__BEAMDROP_TRANSIT__ = new Map();
}

const transitStore = global.__BEAMDROP_TRANSIT__;

// Clean items older than 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [peer, item] of transitStore.entries()) {
    if (now - item.created > 180000) {
      transitStore.delete(peer);
    }
  }
}, 30000);

export const config = {
  api: {
    bodyParser: false, // Handle raw binary streams
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, 'http://localhost');
  const peer = url.searchParams.get('peer') || (req.query && req.query.peer) || '';

  if (!peer) {
    return res.status(400).json({ error: 'peer parameter required' });
  }

  // 1. PULL / DOWNLOAD (Mobile Receiver)
  if (req.method === 'GET') {
    const item = transitStore.get(peer);
    if (!item || !item.buffer) {
      return res.status(404).json({ error: 'transit_not_found', peer });
    }

    res.setHeader('Content-Type', item.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name || 'beamed-object')}"`);
    res.setHeader('Content-Length', item.buffer.length);
    res.setHeader('X-BeamDrop-Name', encodeURIComponent(item.name || 'beamed-object'));
    res.setHeader('X-BeamDrop-Size', item.buffer.length);

    // Delete once consumed (One-Time Ephemeral RAM Bridge)
    setTimeout(() => {
      transitStore.delete(peer);
    }, 15000);

    return res.status(200).send(item.buffer);
  }

  // 2. PUSH / STAGE (Desktop Extension)
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const name = decodeURIComponent(url.searchParams.get('name') || (req.query && req.query.name) || 'shared-object');
      const mime = decodeURIComponent(url.searchParams.get('mime') || (req.query && req.query.mime) || 'application/octet-stream');
      const size = buffer.length;

      transitStore.set(peer, {
        peer,
        name,
        mime,
        size,
        buffer,
        created: Date.now()
      });

      return res.status(200).json({
        success: true,
        peer,
        name,
        size,
        message: 'Object staged in RAM transit'
      });
    });
    return;
  }

  // 3. DELETE / CANCEL
  if (req.method === 'DELETE') {
    transitStore.delete(peer);
    return res.status(200).json({ success: true, peer });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
