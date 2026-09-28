/**
 * BeamDrop Standalone Web Receiver Client
 * Auto-connects to Desktop WebRTC peer via URL query (?peer=beam-xxxxxx)
 * Reassembles binary chunks in RAM and triggers direct download to device
 * Handles File, Text, Link, and Media objects with zero server storage
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const targetPeerId = urlParams.get('peer') || window.location.hash.replace('#', '');

  let peer = null;
  let connection = null;
  const incomingFiles = new Map();

  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const transferArea = document.getElementById('transferArea');
  const transferFileName = document.getElementById('transferFileName');
  const transferSpeed = document.getElementById('transferSpeed');
  const transferProgressBar = document.getElementById('transferProgressBar');
  const transferPercentage = document.getElementById('transferPercentage');
  const transferBytes = document.getElementById('transferBytes');
  const downloadSuccessCard = document.getElementById('downloadSuccessCard');
  const btnManualDownload = document.getElementById('btnManualDownload');
  const receivedMediaCard = document.getElementById('receivedMediaCard');
  const mediaPreviewImg = document.getElementById('mediaPreviewImg');

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  function updateStatus(state, label) {
    if (!statusText) return;
    statusText.textContent = label;
    if (state === 'connected') {
      statusBadge.className = 'status-badge connected';
    } else {
      statusBadge.className = 'status-badge connecting';
    }
  }

  function initReceiver() {
    if (!targetPeerId) {
      updateStatus('waiting', 'No sender peer provided in URL');
      return;
    }

    updateStatus('connecting', 'Connecting to BeamDrop...');

    const myPeerId = 'receiver-' + Math.random().toString(36).substring(2, 8);

    peer = new Peer(myPeerId, {
      debug: 1,
      config: {
        iceServers: ICE_SERVERS
      }
    });

    peer.on('open', () => {
      console.log('Receiver peer open. Auto-connecting to:', targetPeerId);
      connectToSender(targetPeerId);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      updateStatus('error', 'Connection failed: ' + err.type);
    });
  }

  function connectToSender(remoteId) {
    connection = peer.connect(remoteId, { reliable: true });

    connection.on('open', () => {
      updateStatus('connected', 'Connected to BeamDrop Desktop');
      connection.send({
        type: 'DEVICE_INFO',
        device: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Web Receiver'
      });
    });

    connection.on('data', (data) => {
      handleIncomingData(data);
    });

    connection.on('close', () => {
      updateStatus('connecting', 'Sender Disconnected');
    });
  }

  function handleIncomingData(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'TEXT_PAYLOAD' || msg.type === 'TEXT_MSG') {
      const text = msg.text || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      alert('⚡ Beamed from Desktop:\n\n' + text);
      return;
    }

    if (msg.type === 'FILE_START') {
      if (transferArea) transferArea.style.display = 'block';
      if (downloadSuccessCard) downloadSuccessCard.style.display = 'none';

      if (transferFileName) transferFileName.textContent = msg.fileName;
      incomingFiles.set(msg.fileId, {
        name: msg.fileName,
        size: msg.fileSize,
        mime: msg.fileMime || 'application/octet-stream',
        chunks: [],
        receivedBytes: 0,
        startTime: Date.now(),
        lastSpeedTime: Date.now(),
        lastBytes: 0
      });
    } else if (msg.type === 'FILE_CHUNK') {
      const entry = incomingFiles.get(msg.fileId);
      if (!entry) return;

      const chunk = msg.data;
      entry.chunks.push(chunk);
      entry.receivedBytes += chunk.byteLength;

      const progress = Math.min(100, Math.round((entry.receivedBytes / entry.size) * 100));
      if (transferProgressBar) transferProgressBar.style.width = progress + '%';
      if (transferPercentage) transferPercentage.textContent = progress + '%';
      if (transferBytes) transferBytes.textContent = formatBytes(entry.receivedBytes) + ' / ' + formatBytes(entry.size);

      const now = Date.now();
      const elapsed = (now - entry.lastSpeedTime) / 1000;
      if (elapsed >= 0.25) {
        const speed = (entry.receivedBytes - entry.lastBytes) / Math.max(elapsed, 0.001);
        if (transferSpeed) transferSpeed.textContent = formatBytes(speed) + '/s';
        entry.lastSpeedTime = now;
        entry.lastBytes = entry.receivedBytes;
      }
    } else if (msg.type === 'FILE_END' || msg.type === 'complete') {
      const entry = incomingFiles.get(msg.fileId);
      if (!entry) return;

      const blob = new Blob(entry.chunks, { type: entry.mime });
      const downloadUrl = URL.createObjectURL(blob);

      // Trigger instant automatic download to phone storage
      triggerAutoDownload(downloadUrl, entry.name);

      if (downloadSuccessCard) downloadSuccessCard.style.display = 'flex';
      if (btnManualDownload) {
        btnManualDownload.style.display = 'flex';
        btnManualDownload.onclick = () => triggerAutoDownload(downloadUrl, entry.name);
      }

      // If image, show visual preview
      if (entry.mime.startsWith('image/') && mediaPreviewImg) {
        mediaPreviewImg.src = downloadUrl;
        if (receivedMediaCard) receivedMediaCard.style.display = 'flex';
      }

      incomingFiles.delete(msg.fileId);
    }
  }

  function triggerAutoDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Auto start on page load
  window.addEventListener('DOMContentLoaded', initReceiver);
})();
