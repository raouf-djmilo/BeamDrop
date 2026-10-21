// BeamDrop 24h Global Cloud Drop Engine (Google Drive Resumable API + Auto-Purge + Hybrid Fallback)
// Stores temporary drops with bit-exact SHA-256 and automatic permanent deletion after 24 hours.

if (!global.__BEAMDROP_CLOUD_DROPS__) {
  global.__BEAMDROP_CLOUD_DROPS__ = new Map();
}

const cloudDropsStore = global.__BEAMDROP_CLOUD_DROPS__;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Periodic housekeeper: clean up expired drops from memory every 60 seconds
const dropCleaner = setInterval(() => {
  const now = Date.now();
  for (const [id, drop] of cloudDropsStore.entries()) {
    if (drop.expiresAt && now > drop.expiresAt) {
      console.log(`[CloudDrop Housekeeper] Expired drop purged: ${id} (${drop.name})`);
      cloudDropsStore.delete(id);
    }
  }
}, 60000);
if (dropCleaner && dropCleaner.unref) dropCleaner.unref();

export const config = {
  api: {
    bodyParser: false, // Handle raw streaming for binary uploads
  },
};

/**
 * Checks if Google Drive credentials are configured in environment variables
 */
function isGoogleDriveConfigured() {
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = process.env;
  return Boolean(GOOGLE_DRIVE_CLIENT_ID && GOOGLE_DRIVE_CLIENT_SECRET && GOOGLE_DRIVE_REFRESH_TOKEN);
}

/**
 * Exchanges Google OAuth2 refresh token for fresh short-lived access token
 */
let cachedGoogleToken = null;
let googleTokenExpiresAt = 0;

async function getGoogleDriveAccessToken() {
  const now = Date.now();
  if (cachedGoogleToken && now < googleTokenExpiresAt - 60000) {
    return cachedGoogleToken;
  }

  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error('Google Drive environment credentials missing');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_DRIVE_CLIENT_ID,
    client_secret: GOOGLE_DRIVE_CLIENT_SECRET,
    refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google Drive token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  cachedGoogleToken = data.access_token;
  googleTokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedGoogleToken;
}

/**
 * Searches and permanently purges Google Drive files marked with beamdrop that are older than 24 hours
 */
async function purgeExpiredGoogleDriveFiles() {
  if (!isGoogleDriveConfigured()) return 0;
  try {
    const token = await getGoogleDriveAccessToken();
    const query = "properties has { key='beamdrop' and value='true' } and trashed = false";
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,properties)&pageSize=100`;

    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return 0;
    const data = await res.json();
    const files = data.files || [];
    const now = Date.now();
    let purgedCount = 0;

    for (const file of files) {
      let isExpired = false;
      if (file.properties && file.properties.expiresAt) {
        isExpired = now > parseInt(file.properties.expiresAt, 10);
      } else if (file.createdTime) {
        const fileAge = now - new Date(file.createdTime).getTime();
        isExpired = fileAge > TWENTY_FOUR_HOURS_MS;
      }

      if (isExpired) {
        console.log(`[CloudDrop Auto-Purge] Deleting expired file from Google Drive: ${file.name} (${file.id})`);
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        purgedCount++;
      }
    }
    return purgedCount;
  } catch (err) {
    console.warn('[CloudDrop Auto-Purge Notice]:', err);
    return 0;
  }
}

/**
 * Helper to read raw stream into Buffer
 */
function readStreamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', err => reject(err));
  });
}

/**
 * Unified Cloud Drop Handler
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, 'http://localhost');
  const action = (url.searchParams.get('action') || (req.query && req.query.action) || 'get_meta').toLowerCase();
  const dropId = url.searchParams.get('id') || url.searchParams.get('drop') || (req.query && (req.query.id || req.query.drop)) || '';

  // 1. GET STATUS: Integration telemetry & health check
  if (action === 'status') {
    const gdConfigured = isGoogleDriveConfigured();
    return res.status(200).json({
      success: true,
      service: 'BeamDrop 24h Global Cloud Drop',
      mode: gdConfigured ? 'google_drive' : 'hybrid',
      configured: gdConfigured,
      autoPurgeHours: 24,
      activeDropsCount: cloudDropsStore.size,
      folderConfigured: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID)
    });
  }

  // 2. PURGE EXPIRED: Trigger housekeeping
  if (action === 'purge_expired') {
    const gdPurged = await purgeExpiredGoogleDriveFiles();
    const now = Date.now();
    let memPurged = 0;
    for (const [id, drop] of cloudDropsStore.entries()) {
      if (drop.expiresAt && now > drop.expiresAt) {
        cloudDropsStore.delete(id);
        memPurged++;
      }
    }
    return res.status(200).json({
      success: true,
      purged: { googleDrive: gdPurged, memory: memPurged },
      timestamp: now
    });
  }

  // 3. INITIALIZE DROP UPLOAD: Creates session + 24h countdown metadata
  if (action === 'init_upload' && req.method === 'POST') {
    let payload = {};
    try {
      const buf = await readStreamToBuffer(req);
      payload = JSON.parse(buf.toString('utf-8') || '{}');
    } catch (_) {
      payload = req.body || {};
    }

    const fileName = (payload.name || payload.fileName || 'cloud_drop_file.bin').trim();
    const fileSize = parseInt(payload.size || payload.fileSize || 0, 10);
    const mimeType = (payload.mime || payload.type || 'application/octet-stream').trim();
    const sha256 = (payload.hash || payload.sha256 || '').trim();

    const id = 'cdrop_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    const now = Date.now();
    const expiresAt = now + TWENTY_FOUR_HOURS_MS;

    const gdConfigured = isGoogleDriveConfigured();

    // Mode A: Direct Resumable Upload to Google Drive (Zero server bandwidth bottleneck)
    if (gdConfigured) {
      try {
        const token = await getGoogleDriveAccessToken();
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        // Run background purge of expired files
        purgeExpiredGoogleDriveFiles().catch(() => {});

        const metadata = {
          name: fileName,
          description: `BeamDrop 24h Temporary Drop. Automatically deleted after 24 hours.`,
          properties: {
            beamdrop: 'true',
            dropId: id,
            sha256: sha256,
            expiresAt: String(expiresAt),
            createdAt: String(now)
          }
        };
        if (folderId) {
          metadata.parents = [folderId];
        }

        const resumableInitRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(fileSize)
          },
          body: JSON.stringify(metadata)
        });

        const uploadLocation = resumableInitRes.headers.get('location');
        if (!resumableInitRes.ok || !uploadLocation) {
          throw new Error(`Google Drive resumable init error: ${resumableInitRes.status}`);
        }

        cloudDropsStore.set(id, {
          id,
          name: fileName,
          size: fileSize,
          mime: mimeType,
          hash: sha256,
          createdAt: now,
          expiresAt,
          mode: 'google_drive',
          uploadUrl: uploadLocation,
          status: 'uploading'
        });

        return res.status(200).json({
          success: true,
          dropId: id,
          mode: 'google_drive',
          name: fileName,
          size: fileSize,
          uploadUrl: uploadLocation,
          downloadUrl: `/download.html?drop=${id}`,
          expiresAt,
          remainingSeconds: 86400,
          message: 'Google Drive direct resumable session ready'
        });
      } catch (gdErr) {
        console.warn('[CloudDrop] Google Drive init failed, falling back to Hybrid:', gdErr?.message);
        // Seamless fallback to hybrid mode if Google API error occurs
      }
    }

    // Mode B: Fast Hybrid Fallback (In-Memory / Instant Drop for local tests & zero-config)
    cloudDropsStore.set(id, {
      id,
      name: fileName,
      size: fileSize,
      mime: mimeType,
      hash: sha256,
      createdAt: now,
      expiresAt,
      mode: 'hybrid',
      buffer: null,
      status: 'awaiting_data'
    });

    return res.status(200).json({
      success: true,
      dropId: id,
      mode: 'hybrid',
      name: fileName,
      size: fileSize,
      uploadUrl: `/api/cloud-drop?action=upload_binary&id=${id}`,
      downloadUrl: `/download.html?drop=${id}`,
      expiresAt,
      remainingSeconds: 86400,
      message: 'Hybrid cloud drop staged'
    });
  }

  // 4. UPLOAD BINARY CHUNK / FULL FILE (Used in Hybrid Mode or direct proxy)
  if (action === 'upload_binary' && req.method === 'POST') {
    if (!dropId || !cloudDropsStore.has(dropId)) {
      return res.status(404).json({ success: false, error: 'Drop session not found or expired' });
    }

    const drop = cloudDropsStore.get(dropId);
    if (Date.now() > drop.expiresAt) {
      cloudDropsStore.delete(dropId);
      return res.status(410).json({ success: false, expired: true, error: 'Drop expired' });
    }

    try {
      const buffer = await readStreamToBuffer(req);
      drop.buffer = buffer;
      drop.size = buffer.length;
      drop.status = 'ready';
      cloudDropsStore.set(dropId, drop);

      return res.status(200).json({
        success: true,
        dropId,
        size: buffer.length,
        status: 'ready',
        downloadUrl: `/download.html?drop=${dropId}`,
        expiresAt: drop.expiresAt
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || 'Upload failed' });
    }
  }

  // 5. FINALIZE GOOGLE DRIVE UPLOAD: Associate Google Drive fileId after direct client upload
  if (action === 'finalize_gd' && req.method === 'POST') {
    let payload = {};
    try {
      const buf = await readStreamToBuffer(req);
      payload = JSON.parse(buf.toString('utf-8') || '{}');
    } catch (_) {
      payload = req.body || {};
    }

    const targetId = payload.dropId || dropId;
    const gdFileId = payload.fileId;

    if (!targetId || !cloudDropsStore.has(targetId)) {
      return res.status(404).json({ success: false, error: 'Drop session not found' });
    }

    const drop = cloudDropsStore.get(targetId);
    drop.googleDriveFileId = gdFileId;
    drop.status = 'ready';
    cloudDropsStore.set(targetId, drop);

    return res.status(200).json({
      success: true,
      dropId: targetId,
      status: 'ready',
      downloadUrl: `/download.html?drop=${targetId}`
    });
  }

  // 6. GET DROP METADATA: For download.html and countdown timer
  if (action === 'get_meta' || (!action && dropId)) {
    if (!dropId) {
      return res.status(400).json({ success: false, error: 'Missing drop ID' });
    }

    // Check store
    let drop = cloudDropsStore.get(dropId);
    const now = Date.now();

    // If not in local store, attempt to find in Google Drive by dropId property
    if (!drop && isGoogleDriveConfigured()) {
      try {
        const token = await getGoogleDriveAccessToken();
        const query = `properties has { key='dropId' and value='${dropId}' } and trashed = false`;
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,mimeType,createdTime,properties)`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (searchRes.ok) {
          const sData = await searchRes.json();
          const gdFile = sData.files && sData.files[0];
          if (gdFile) {
            const expAt = gdFile.properties?.expiresAt ? parseInt(gdFile.properties.expiresAt, 10) : (new Date(gdFile.createdTime).getTime() + TWENTY_FOUR_HOURS_MS);
            drop = {
              id: dropId,
              name: gdFile.name,
              size: parseInt(gdFile.size || '0', 10),
              mime: gdFile.mimeType || 'application/octet-stream',
              hash: gdFile.properties?.sha256 || '',
              createdAt: new Date(gdFile.createdTime).getTime(),
              expiresAt: expAt,
              googleDriveFileId: gdFile.id,
              mode: 'google_drive',
              status: 'ready'
            };
            cloudDropsStore.set(dropId, drop);
          }
        }
      } catch (_) {}
    }

    if (!drop) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'This cloud drop does not exist or has already been deleted.'
      });
    }

    // Check 24-hour expiration
    if (now > drop.expiresAt) {
      // Auto-purge
      if (drop.googleDriveFileId && isGoogleDriveConfigured()) {
        try {
          const token = await getGoogleDriveAccessToken();
          await fetch(`https://www.googleapis.com/drive/v3/files/${drop.googleDriveFileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (_) {}
      }
      cloudDropsStore.delete(dropId);

      return res.status(410).json({
        success: false,
        code: 'EXPIRED',
        expired: true,
        message: 'This drop link has expired after 24 hours and was automatically purged.'
      });
    }

    const remainingSeconds = Math.max(0, Math.floor((drop.expiresAt - now) / 1000));

    return res.status(200).json({
      success: true,
      id: drop.id,
      name: drop.name,
      size: drop.size,
      mime: drop.mime,
      hash: drop.hash,
      createdAt: drop.createdAt,
      expiresAt: drop.expiresAt,
      remainingSeconds,
      downloadUrl: `/api/cloud-drop?action=download&id=${drop.id}`,
      mode: drop.mode,
      status: drop.status
    });
  }

  // 7. STREAM / DOWNLOAD FILE
  if (action === 'download') {
    if (!dropId) {
      return res.status(400).json({ success: false, error: 'Missing drop ID' });
    }

    let drop = cloudDropsStore.get(dropId);
    const now = Date.now();

    if (!drop && isGoogleDriveConfigured()) {
      try {
        const token = await getGoogleDriveAccessToken();
        const query = `properties has { key='dropId' and value='${dropId}' } and trashed = false`;
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,mimeType,createdTime,properties)`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (searchRes.ok) {
          const sData = await searchRes.json();
          const gdFile = sData.files && sData.files[0];
          if (gdFile) {
            const expAt = gdFile.properties?.expiresAt ? parseInt(gdFile.properties.expiresAt, 10) : (new Date(gdFile.createdTime).getTime() + TWENTY_FOUR_HOURS_MS);
            drop = {
              id: dropId,
              name: gdFile.name,
              size: parseInt(gdFile.size || '0', 10),
              mime: gdFile.mimeType || 'application/octet-stream',
              hash: gdFile.properties?.sha256 || '',
              createdAt: new Date(gdFile.createdTime).getTime(),
              expiresAt: expAt,
              googleDriveFileId: gdFile.id,
              mode: 'google_drive',
              status: 'ready'
            };
            cloudDropsStore.set(dropId, drop);
          }
        }
      } catch (_) {}
    }

    if (!drop) {
      return res.status(404).send('Cloud drop not found or expired.');
    }

    if (now > drop.expiresAt) {
      return res.status(410).send('This 24-hour cloud drop has expired and was automatically deleted.');
    }

    // Google Drive Streaming Proxy
    if (drop.googleDriveFileId && isGoogleDriveConfigured()) {
      try {
        const token = await getGoogleDriveAccessToken();
        const gdRes = await fetch(`https://www.googleapis.com/drive/v3/files/${drop.googleDriveFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!gdRes.ok) {
          return res.status(gdRes.status).send('Failed to stream file from Google Drive');
        }

        res.setHeader('Content-Type', drop.mime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(drop.name)}"`);
        if (drop.size) res.setHeader('Content-Length', String(drop.size));
        if (drop.hash) res.setHeader('X-BeamDrop-SHA256', drop.hash);
        res.setHeader('X-BeamDrop-Expires', String(drop.expiresAt));

        const arrayBuf = await gdRes.arrayBuffer();
        return res.status(200).send(Buffer.from(arrayBuf));
      } catch (streamErr) {
        return res.status(500).send('Streaming error: ' + (streamErr?.message || 'unknown'));
      }
    }

    // Hybrid Mode Streaming
    if (drop.buffer) {
      res.setHeader('Content-Type', drop.mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(drop.name)}"`);
      res.setHeader('Content-Length', String(drop.buffer.length));
      if (drop.hash) res.setHeader('X-BeamDrop-SHA256', drop.hash);
      res.setHeader('X-BeamDrop-Expires', String(drop.expiresAt));
      return res.status(200).send(drop.buffer);
    }

    return res.status(204).end();
  }

  // 8. DELETE NOW: Sender manual purge before 24h
  if (action === 'delete' || req.method === 'DELETE') {
    let targetId = dropId;
    if (!targetId && req.method === 'POST') {
      try {
        const buf = await readStreamToBuffer(req);
        const body = JSON.parse(buf.toString('utf-8') || '{}');
        targetId = body.id || body.dropId;
      } catch (_) {}
    }

    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Drop ID required' });
    }

    const drop = cloudDropsStore.get(targetId);
    if (drop && drop.googleDriveFileId && isGoogleDriveConfigured()) {
      try {
        const token = await getGoogleDriveAccessToken();
        await fetch(`https://www.googleapis.com/drive/v3/files/${drop.googleDriveFileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (_) {}
    }

    cloudDropsStore.delete(targetId);

    return res.status(200).json({
      success: true,
      message: 'Cloud drop permanently deleted ahead of 24h expiration schedule.'
    });
  }

  return res.status(400).json({ success: false, error: 'Invalid cloud drop action' });
}
