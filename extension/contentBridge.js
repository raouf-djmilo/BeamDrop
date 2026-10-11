/**
 * BeamDrop Chrome Extension Content Script Bridge
 * Bridges web app session state (token, peerId, E2EE key) directly to background service worker.
 */

// Listen for messages dispatched by the BeamDrop web app
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  // 1. Session & Pairing Sync
  if (msg.type === 'BEAMDROP_EXT_SYNC' || msg.action === 'sync_beamdrop_session') {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'sync_beamdrop_session',
        peerId: msg.peerId,
        token: msg.token,
        phoneName: msg.phoneName || 'Mobile Phone',
        keyHex: msg.keyHex || '',
        receiverBaseUrl: msg.receiverBaseUrl || window.location.origin
      }, (res) => {
        window.postMessage({
          type: 'BEAMDROP_EXT_SYNC_ACK',
          success: Boolean(res && res.success),
          session: res && res.session
        }, '*');
      });
    }
  }

  // 2. Query Pairing Status
  if (msg.type === 'BEAMDROP_CHECK_EXT_INSTALLED') {
    window.postMessage({
      type: 'BEAMDROP_EXT_INSTALLED_ACK',
      version: (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '1.6.2'
    }, '*');
  }
});

// Announce presence to page immediately on load
window.postMessage({
  type: 'BEAMDROP_EXT_PRESENT',
  version: (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '1.6.2'
}, '*');
