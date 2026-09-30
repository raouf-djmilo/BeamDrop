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
    const item = transitStore.get(peer);

    // If requested by a human browser scanning via native camera app (not polling for file download):
    if (accept.includes('text/html') && (!item || !item.buffer)) {
      res.writeHead(302, { Location: `/?mode=scan&peer=${encodeURIComponent(peer)}` });
      return res.end();
    }

    if (!item || !item.buffer) {
      return res.status(404).json({ error: 'transit_not_found', peer });
    }

    res.setHeader('Content-Type', item.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name || 'beamed-object')}"`);
    res.setHeader('Content-Length', item.buffer.length);
    res.setHeader('X-BeamDrop-Name', encodeURIComponent(item.name || 'beamed-object'));
    res.setHeader('X-BeamDrop-Size', item.buffer.length);

    // Delete immediately once consumed (One-Time Ephemeral RAM Bridge)
    transitStore.delete(peer);

    return res.status(200).send(item.buffer);
  }

  // 2. PUSH / UPLOAD (iOS Shortcut Direct HTTP Upload or Extension)
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      let rawBuffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';

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

      transitStore.set(peer, {
        peer,
        name: finalName,
        mime,
        size,
        buffer: finalBuffer,
        created: Date.now()
      });

      return res.status(200).json({
        success: true,
        peer,
        name: finalName,
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
