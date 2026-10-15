/**
 * ============================================================================
 * BEAMDROP CONTENT BRIDGE (Web Page & Side Panel Interaction Bridge)
 * Purpose: 
 *   1. Bridges web page drag events (images, links, selected text) directly
 *      into the BeamDrop Side Panel without CORS restrictions.
 *   2. Bridges web app session state (token, peerId, E2EE key) to background.
 * ============================================================================
 */

// Configuration parameters
const MAX_PREVIEW_TEXT_LENGTH = 5000;
const ENABLE_DRAG_BRIDGE = true;

// 1. Drag & Drop Event Listener for any active web page
if (ENABLE_DRAG_BRIDGE) {
  document.addEventListener('dragstart', (event) => {
    try {
      const target = event.target;
      let dragPayload = null;

      // Case A: Dragged element is an Image
      if (target && target.tagName === 'IMG' && target.src) {
        dragPayload = {
          type: 'image-url',
          content: target.src,
          title: target.alt || 'Web_Image.png',
          pageUrl: window.location.href,
          timestamp: Date.now()
        };
      } 
      // Case B: Dragged element is a Link (or child of a link)
      else if (target && (target.tagName === 'A' || target.closest('a'))) {
        const anchor = target.tagName === 'A' ? target : target.closest('a');
        if (anchor && anchor.href) {
          dragPayload = {
            type: 'link',
            content: anchor.href,
            title: (anchor.innerText || '').trim() || anchor.href,
            pageUrl: window.location.href,
            timestamp: Date.now()
          };
        }
      } 
      // Case C: Dragged element is Highlighted / Selected text
      else {
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';
        if (selectedText.length > 0) {
          dragPayload = {
            type: 'text',
            content: selectedText.slice(0, MAX_PREVIEW_TEXT_LENGTH),
            pageUrl: window.location.href,
            timestamp: Date.now()
          };
        }
      }

      // Dispatch payload to Side Panel & Background Service Worker
      if (dragPayload && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'web_page_drag_started',
          data: dragPayload
        }).catch(() => {
          // Ignore silently if Side Panel is not actively open
        });
      }
    } catch (_) {}
  }, true);
}

// 2. Listen for messages dispatched by the BeamDrop web app (Pairing & Session Sync)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  // Session & Pairing Sync
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

  // Query Pairing Status
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
