// In-Memory RAM-to-RAM Ephemeral Transit Engine (Multi-File FIFO Queue & High-Capacity Bridge)
if (!global.__BEAMDROP_TRANSIT__) {
  global.__BEAMDROP_TRANSIT__ = new Map();
}

const transitStore = global.__BEAMDROP_TRANSIT__;

// Clean items older than 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [peer, items] of transitStore.entries()) {
    if (Array.isArray(items)) {
      const active = items.filter(it => now - it.created <= 180000);
      if (active.length === 0) transitStore.delete(peer);
      else transitStore.set(peer, active);
    } else if (now - items.created > 180000) {
      transitStore.delete(peer);
    }
  }
}, 30000);

export const config = {
  api: {
    bodyParser: false, // Handle raw binary streams
  },
};

// Helper to extract multipart file if sent as FormData
function extractMultipartFile(buffer, contentType) {
  try {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!match) return null;
    const boundary = match[1] || match[2];
    const boundaryBuffer = Buffer.from('--' + boundary);

    const startIndex = buffer.indexOf(boundaryBuffer);
    if (startIndex === -1) return null;

    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), startIndex);
    if (headerEnd === -1) return null;

    const headerStr = buffer.slice(startIndex, headerEnd).toString('utf-8');
    let filename = '';
    const fnMatch = headerStr.match(/filename="([^"]+)"/i);
    if (fnMatch) filename = fnMatch[1];

    const nextBoundary = buffer.indexOf(boundaryBuffer, headerEnd + 4);
    if (nextBoundary === -1) return null;

    const fileBuffer = buffer.slice(headerEnd + 4, nextBoundary - 2);
    return { filename, buffer: fileBuffer };
  } catch (_) {
    return null;
  }
}

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

  // 1. PULL / DOWNLOAD (PC Vault Receiver or Mobile Web Redirect)
  if (req.method === 'GET') {
    const accept = (req.headers && req.headers['accept']) || '';
    const items = transitStore.get(peer);
    const queue = Array.isArray(items) ? items : (items ? [items] : []);

    // If requested by a human browser scanning via native camera app (not polling for file download):
    if (accept.includes('text/html') && queue.length === 0) {
      res.writeHead(302, { Location: `/?mode=scan&peer=${encodeURIComponent(peer)}` });
      return res.end();
    }

    if (queue.length === 0) {
      return res.status(404).json({ error: 'transit_not_found', peer });
    }

    // Pop the next queued item (FIFO)
    const item = queue.shift();
    if (queue.length === 0) {
      transitStore.delete(peer);
    } else {
      transitStore.set(peer, queue);
    }

    if (item.remoteUrl) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-BeamDrop-Remote-Url', item.remoteUrl);
      res.setHeader('X-BeamDrop-Name', encodeURIComponent(item.name || 'beamed-object'));
      res.setHeader('X-BeamDrop-Size', item.size || 0);
      res.setHeader('X-BeamDrop-Pending', queue.length);
      return res.status(200).json({
        remoteUrl: item.remoteUrl,
        name: item.name,
        size: item.size,
        mime: item.mime
      });
    }

    res.setHeader('Content-Type', item.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name || 'beamed-object')}"`);
    res.setHeader('Content-Length', item.buffer.length);
    res.setHeader('X-BeamDrop-Name', encodeURIComponent(item.name || 'beamed-object'));
    res.setHeader('X-BeamDrop-Size', item.buffer.length);
    res.setHeader('X-BeamDrop-Pending', queue.length);

    return res.status(200).send(item.buffer);
  }

  // 2. PUSH / UPLOAD (iOS Shortcut Direct HTTP Upload or Multi-File Loop)
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      let rawBuffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';

      // High-Capacity 1GB Remote Relay Dispatch (Bypasses Vercel 4.5MB payload limit)
      if (contentType.includes('application/json') || rawBuffer.toString('utf-8').trim().startsWith('{')) {
        try {
          const json = JSON.parse(rawBuffer.toString('utf-8'));
          if (json.remoteUrl) {
            const existing = transitStore.get(peer);
            const queue = Array.isArray(existing) ? existing : (existing ? [existing] : []);
            queue.push({
              peer,
              name: json.name || 'beamed_file',
              mime: json.mime || 'application/octet-stream',
              size: json.size || 0,
              remoteUrl: json.remoteUrl,
              created: Date.now()
            });
            transitStore.set(peer, queue);

            return res.status(200).json({
              success: true,
              peer,
              remoteUrl: json.remoteUrl,
              name: json.name,
              queuePosition: queue.length,
              message: 'High-capacity 1GB relay order staged'
            });
          }
        } catch (_) {}
      }

      let finalName = '';
      let finalBuffer = rawBuffer;

      // Handle multipart form upload if sent from Shortcuts Form
      if (contentType.includes('multipart/form-data')) {
        const parsed = extractMultipartFile(rawBuffer, contentType);
        if (parsed) {
          finalBuffer = parsed.buffer;
          if (parsed.filename) finalName = parsed.filename;
        }
      }

      // Check URL query and custom headers for filename
      if (!finalName) {
        finalName = decodeURIComponent(
          url.searchParams.get('name') ||
          (req.query && req.query.name) ||
          req.headers['x-file-name'] ||
          req.headers['x-filename'] ||
          ''
        );
      }

      // Check Content-Disposition header if present
      if (!finalName && req.headers['content-disposition']) {
        const cdMatch = req.headers['content-disposition'].match(/filename="?([^";]+)"?/i);
        if (cdMatch && cdMatch[1]) finalName = cdMatch[1];
      }

      // Fallback filename based on MIME type
      const mime = decodeURIComponent(url.searchParams.get('mime') || (req.query && req.query.mime) || contentType || 'application/octet-stream');
      if (!finalName || finalName === 'shared-object') {
        const timestamp = Date.now();
        if (mime.includes('video/quicktime') || mime.includes('mov')) finalName = `video_${timestamp}.mov`;
        else if (mime.includes('video/mp4')) finalName = `video_${timestamp}.mp4`;
        else if (mime.includes('image/jpeg') || mime.includes('jpg')) finalName = `photo_${timestamp}.jpg`;
        else if (mime.includes('image/png')) finalName = `photo_${timestamp}.png`;
        else if (mime.includes('image/heic')) finalName = `photo_${timestamp}.heic`;
        else if (mime.includes('application/pdf')) finalName = `document_${timestamp}.pdf`;
        else if (mime.includes('zip')) finalName = `archive_${timestamp}.zip`;
        else finalName = `beamed_file_${timestamp}.bin`;
      }

      const size = finalBuffer.length;

      // Append to the peer's FIFO queue so multiple photos never overwrite each other
      const existing = transitStore.get(peer);
      const queue = Array.isArray(existing) ? existing : (existing ? [existing] : []);
      queue.push({
        peer,
        name: finalName,
        mime,
        size,
        buffer: finalBuffer,
        created: Date.now()
      });
      transitStore.set(peer, queue);

      return res.status(200).json({
        success: true,
        peer,
        name: finalName,
        size,
        queuePosition: queue.length,
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
