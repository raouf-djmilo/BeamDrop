/**
 * BeamDrop Background Service Worker (Manifest V3)
 * Universal Device Bridge: Context Menus, Clipboard Relaying,
 * OTA Background Update Engine, Toolbar Badges, and Direct Package Downloads.
 */

const DEFAULT_VERCEL_URL = "https://beam-drop-mu.vercel.app";
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/raouf-djmilo/BeamDrop/main/public/version.json";
const UPDATE_ALARM_NAME = "beamdrop_periodic_update_check";
let lastWebDragPayload = null;

/**
 * Function to display/clear update badge on toolbar icon
 * @param {boolean} hasUpdate - If true, show Electric Sky Blue badge with "NEW"
 */
function updateExtensionBadge(hasUpdate) {
  const BADGE_COLOR = "#0284C7"; // BeamDrop Electric Sky Blue
  const BADGE_TEXT = "NEW";

  if (typeof chrome !== 'undefined' && chrome.action) {
    if (hasUpdate) {
      if (chrome.action.setBadgeBackgroundColor) {
        chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      }
      if (chrome.action.setBadgeText) {
        chrome.action.setBadgeText({ text: BADGE_TEXT });
      }
    } else {
      if (chrome.action.setBadgeText) {
        chrome.action.setBadgeText({ text: "" });
      }
    }
  }
}

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;

    const safeCreate = (props) => {
      chrome.contextMenus.create(props, () => {
        void chrome.runtime.lastError;
      });
    };

    safeCreate({
      id: "beamdrop_send_image",
      title: "⚡ Beam image directly to Phone (RAM stream)",
      contexts: ["image"]
    });

    safeCreate({
      id: "beamdrop_send_selection",
      title: "⚡ Beam selected text to Phone",
      contexts: ["selection"]
    });

    safeCreate({
      id: "beamdrop_send_link",
      title: "⚡ Beam link to Phone",
      contexts: ["link"]
    });

    safeCreate({
      id: "beamdrop_send_page",
      title: "⚡ Beam this page to Phone",
      contexts: ["page"]
    });

    if (chrome.sidePanel) {
      safeCreate({
        id: "beamdrop_open_sidepanel",
        title: "⚡ BeamDrop: Open Side Panel (Persistent)",
        contexts: ["action"]
      });
    }
  });
}

// Persistent Chrome Side Panel (Manifest V3) configuration
function configureSidePanelBehavior() {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sidePanelEnabled'], (res) => {
        const enabled = res.sidePanelEnabled !== false;
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: enabled })
          .catch((err) => console.log('[BeamDrop] Side panel behavior notice:', err));
      });
    } else {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((err) => console.log('[BeamDrop] Side panel behavior notice:', err));
    }
  }
}

// Initialize on installed
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  configureSidePanelBehavior();

  // Setup periodic background check for updates (every 30 mins, with immediate 1-min initial check)
  chrome.alarms.create(UPDATE_ALARM_NAME, {
    periodInMinutes: 30,
    delayInMinutes: 1
  });

  // Check immediately on install
  checkCloudForUpdates();
});

// Configure Side Panel on browser startup
if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    configureSidePanelBehavior();
  });
}

// Periodic alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    checkCloudForUpdates();
  }
});

// Notification click listener
if (chrome.notifications && chrome.notifications.onClicked) {
  chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('beamdrop_update_')) {
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup().catch(() => {});
      }
    }
  });
}

// Keyboard Shortcuts Listener (chrome.commands)
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === "quick-beam-clipboard") {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        if (tab && tab.id) {
          await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id) {
              chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
            }
          });
        }
      }

      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: "beam_from_clipboard_shortcut"
        }).catch(() => {});
      }, 300);
    }
  });
}

// Universal Context Menu Actions (Zero-Click RAM-to-Phone Web Beam)
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "beamdrop_open_sidepanel") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      if (tab && tab.id) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
          }
        });
      }
    }
    return;
  }

  // Retrieve paired session and server configuration
  let paired = null;
  let targetBaseUrl = DEFAULT_VERCEL_URL;
  if (chrome.storage && chrome.storage.local) {
    const stored = await chrome.storage.local.get(['beamdrop_paired_phone', 'custom_update_server']);
    if (stored && stored.beamdrop_paired_phone) {
      paired = stored.beamdrop_paired_phone;
    }
    if (stored && stored.custom_update_server && !stored.custom_update_server.includes('.run.app') && !stored.custom_update_server.includes('localhost')) {
      targetBaseUrl = stored.custom_update_server.replace(/\/$/, '');
    } else if (paired && paired.receiverBaseUrl && !paired.receiverBaseUrl.includes('.run.app') && !paired.receiverBaseUrl.includes('localhost')) {
      targetBaseUrl = paired.receiverBaseUrl.replace(/\/$/, '');
    }
  }

  const phoneLabel = (paired && (paired.phoneName || paired.name)) || 'Paired Phone';

  // Automatically open the persistent Side Panel when user beams via context menu
  if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }

  // 1. BEAM IMAGE DIRECTLY TO PHONE (RAM Streaming - No PC Disk Footprint)
  if (info.menuItemId === "beamdrop_send_image" && info.srcUrl) {
    let fileName = `beamed_photo_${Date.now()}.jpg`;
    let mime = 'image/jpeg';
    let imageBlob = null;

    try {
      const parsedUrl = new URL(info.srcUrl);
      const pathname = parsedUrl.pathname;
      const base = pathname.split('/').pop();
      if (base && base.includes('.')) {
        fileName = decodeURIComponent(base);
      }
    } catch (_) {}

    try {
      const resp = await fetch(info.srcUrl, { cache: 'no-cache' });
      if (resp.ok) {
        imageBlob = await resp.blob();
        mime = imageBlob.type || mime;
      }
    } catch (e) {
      console.warn('[BeamDrop Background] Could not fetch image blob in RAM, using URL:', e);
    }

    if (paired && paired.peerId) {
      // Direct stream to paired phone via Fast Ephemeral Transit Tunnel
      try {
        const transitUrl = `${targetBaseUrl}/api/transit?peer=${paired.peerId}&name=${encodeURIComponent(fileName)}&mime=${encodeURIComponent(mime)}`;
        const transitResp = await fetch(transitUrl, {
          method: 'POST',
          body: imageBlob || info.srcUrl
        });

        if (transitResp.ok) {
          if (chrome.notifications && chrome.notifications.create) {
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "⚡ BeamDrop: Image Beamed!",
              message: `Beamed "${fileName}" directly to ${phoneLabel} with zero PC disk footprint.`
            });
          }
          return;
        }
      } catch (streamErr) {
        console.warn('[BeamDrop Background] Direct transit error, falling back to staging:', streamErr);
      }
    }

    // Staging fallback if not yet paired
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        pendingSharePayload: {
          type: 'image',
          content: info.srcUrl,
          fileName: fileName,
          mime: mime,
          timestamp: Date.now()
        }
      }, () => {
        if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.id) {
          chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        } else if (chrome.action && chrome.action.openPopup) {
          chrome.action.openPopup().catch(() => {});
        }

        if (chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "⚡ BeamDrop: Image Staged",
            message: `"${fileName}" ready. Open BeamDrop toolbar or pair phone via QR to beam.`
          });
        }
      });
    }
    return;
  }

  // 2. BEAM SELECTED TEXT TO PHONE
  if (info.menuItemId === "beamdrop_send_selection" && info.selectionText) {
    const textSnippet = info.selectionText.trim();
    if (paired && paired.peerId) {
      try {
        const transitUrl = `${targetBaseUrl}/api/transit?peer=${paired.peerId}&name=beamed_selection.txt&mime=text%2Fplain`;
        const resp = await fetch(transitUrl, {
          method: 'POST',
          body: textSnippet
        });
        if (resp.ok) {
          if (chrome.notifications && chrome.notifications.create) {
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "⚡ BeamDrop: Text Beamed!",
              message: `Beamed text (${textSnippet.length} chars) directly to ${phoneLabel} clipboard.`
            });
          }
          return;
        }
      } catch (_) {}
    }

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        pendingSharePayload: {
          type: 'text',
          content: textSnippet,
          timestamp: Date.now()
        }
      }, () => {
        if (chrome.action && chrome.action.openPopup) chrome.action.openPopup().catch(() => {});
        if (chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "⚡ BeamDrop: Text Ready",
            message: `Selected text staged. Open BeamDrop to scan QR or pair phone.`
          });
        }
      });
    }
    return;
  }

  // 3. BEAM HYPERLINK TO PHONE
  if (info.menuItemId === "beamdrop_send_link" && info.linkUrl) {
    const linkUrl = info.linkUrl.trim();
    if (paired && paired.peerId) {
      try {
        const transitUrl = `${targetBaseUrl}/api/transit?peer=${paired.peerId}&name=beamed_link.txt&mime=text%2Fplain`;
        const resp = await fetch(transitUrl, {
          method: 'POST',
          body: linkUrl
        });
        if (resp.ok) {
          if (chrome.notifications && chrome.notifications.create) {
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "⚡ BeamDrop: Link Beamed!",
              message: `Beamed link directly to ${phoneLabel} browser.`
            });
          }
          return;
        }
      } catch (_) {}
    }

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        pendingSharePayload: {
          type: 'link',
          content: linkUrl,
          timestamp: Date.now()
        }
      }, () => {
        if (chrome.action && chrome.action.openPopup) chrome.action.openPopup().catch(() => {});
        if (chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "⚡ BeamDrop: Link Ready",
            message: `Link staged. Click BeamDrop to beam to mobile.`
          });
        }
      });
    }
    return;
  }

  // 4. BEAM CURRENT PAGE TAB TO PHONE
  if (info.menuItemId === "beamdrop_send_page" && tab && tab.url) {
    const pageUrl = tab.url;
    const pageTitle = tab.title || 'Web Page';
    const pagePayload = `${pageTitle}\n${pageUrl}`;

    if (paired && paired.peerId) {
      try {
        const transitUrl = `${targetBaseUrl}/api/transit?peer=${paired.peerId}&name=beamed_page.txt&mime=text%2Fplain`;
        const resp = await fetch(transitUrl, {
          method: 'POST',
          body: pagePayload
        });
        if (resp.ok) {
          if (chrome.notifications && chrome.notifications.create) {
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "⚡ BeamDrop: Page Beamed!",
              message: `Beamed "${pageTitle}" directly to ${phoneLabel}!`
            });
          }
          return;
        }
      } catch (_) {}
    }

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        pendingSharePayload: {
          type: 'link',
          content: pageUrl,
          timestamp: Date.now()
        }
      }, () => {
        if (chrome.action && chrome.action.openPopup) chrome.action.openPopup().catch(() => {});
      });
    }
    return;
  }
});

// Background update available listener (Web Store / CRX auto-update)
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('Native update downloaded and waiting to install:', details.version);
  chrome.action.setBadgeText({ text: 'NEW' });
  chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      nativeUpdateReady: true,
      latestVersion: details.version
    });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_pending_share') {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pendingSharePayload', 'pendingShareText'], (res) => {
        const payload = res.pendingSharePayload || (res.pendingShareText ? { type: 'text', content: res.pendingShareText } : null);
        // Clear after reading
        chrome.storage.local.remove(['pendingSharePayload', 'pendingShareText']);
        sendResponse({ payload });
      });
      return true;
    }
    sendResponse({ payload: null });
    return true;
  }

  if (message.action === 'web_page_drag_started') {
    lastWebDragPayload = message.data;
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ beamdrop_last_web_drag: message.data }).catch(() => {});
    }
    sendResponse({ success: true, received: true });
    return true;
  }

  if (message.action === 'get_last_web_drag') {
    sendResponse({ success: true, data: lastWebDragPayload });
    return true;
  }

  if (message.action === 'check_updates_now') {
    checkCloudForUpdates().then((res) => sendResponse(res));
    return true;
  }

  if (message.action === 'clear_update_badge') {
    updateExtensionBadge(false);
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['updateAvailable']);
    }
    sendResponse({ cleared: true });
    return true;
  }

  if (message.action === 'get_extension_version') {
    const manifest = (chrome.runtime && chrome.runtime.getManifest)
      ? chrome.runtime.getManifest()
      : { version: '1.6.2' };
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['installedCommitSha', 'installedShortSha', 'installedVersion'], (stored) => {
        sendResponse({
          success: true,
          version: (stored && stored.installedVersion) || manifest.version || '1.6.2',
          commitSha: (stored && (stored.installedShortSha || stored.installedCommitSha)) || '38027b1',
          manifestVersion: manifest.version || '1.6.2'
        });
      });
      return true;
    }
    sendResponse({
      success: true,
      version: manifest.version || '1.6.2',
      commitSha: '38027b1',
      manifestVersion: manifest.version || '1.6.2'
    });
    return true;
  }

  if (message.action === 'trigger_runtime_reload') {
    setTimeout(() => {
      if (chrome.runtime.reload) {
        chrome.runtime.reload();
      }
    }, 150);
    sendResponse({ reloading: true });
    return true;
  }

  if (message.action === 'download_update_package') {
    const url = message.url || `${DEFAULT_VERCEL_URL}/extension.zip`;
    const filename = message.filename || 'BeamDrop-Extension-Latest.zip';
    if (chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false,
        conflictAction: 'overwrite'
      }, (downloadId) => {
        sendResponse({ success: Boolean(downloadId), downloadId });
      });
      return true;
    } else {
      sendResponse({ success: false, reason: 'downloads API unavailable' });
      return true;
    }
  }

  if (message.action === 'fetch_cloud_version') {
    checkCloudForUpdates().then((res) => {
      sendResponse(res && res.data ? res.data : null);
    }).catch(() => {
      sendResponse(null);
    });
    return true;
  }

  if (message.action === 'request_store_update_check') {
    if (chrome.runtime.requestUpdateCheck) {
      chrome.runtime.requestUpdateCheck((status, details) => {
        sendResponse({ status, details });
      });
      return true;
    } else {
      sendResponse({ status: 'unsupported' });
      return true;
    }
  }

  if (message.action === 'sync_beamdrop_session' || message.action === 'pair_session') {
    if (chrome.storage && chrome.storage.local) {
      const pairedSession = {
        peerId: message.peerId,
        token: message.token,
        phoneName: message.phoneName || 'Mobile Phone',
        keyHex: message.keyHex || '',
        receiverBaseUrl: message.receiverBaseUrl || DEFAULT_VERCEL_URL,
        pairedAt: Date.now()
      };
      chrome.storage.local.set({ beamdrop_paired_phone: pairedSession }, () => {
        sendResponse({ success: true, session: pairedSession });
      });
      return true;
    }
    sendResponse({ success: false });
    return true;
  }

  if (message.action === 'get_paired_session') {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['beamdrop_paired_phone'], (res) => {
        sendResponse({
          success: true,
          paired: Boolean(res.beamdrop_paired_phone),
          pairedPhone: res.beamdrop_paired_phone || null
        });
      });
      return true;
    }
    sendResponse({ success: false, paired: false });
    return true;
  }

  if (message.action === 'open_camera_permission_tab') {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('options.html?grant=camera')
      }, (tab) => {
        sendResponse({ success: true, tabId: tab ? tab.id : null });
      });
      return true;
    }
    sendResponse({ success: false });
    return true;
  }

  if (message.action === 'set_side_panel_behavior') {
    const enabled = Boolean(message.enabled);
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ sidePanelEnabled: enabled }, () => {
        if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
          chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: enabled })
            .catch(() => {});
        }
        sendResponse({ success: true, enabled });
      });
      return true;
    }
  }

  if (message.action === 'open_side_panel') {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.sidePanel.open({ tabId: tabs[0].id })
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: (err && err.message) || 'failed' }));
        } else {
          sendResponse({ success: false, error: 'no_active_tab' });
        }
      });
      return true;
    }
    sendResponse({ success: false, error: 'side_panel_unsupported' });
    return true;
  }

  if (message.action === 'capture_active_tab_screenshot') {
    if (chrome.tabs && chrome.tabs.captureVisibleTab) {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({
            success: false,
            error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'capture_failed'
          });
        } else {
          sendResponse({ success: true, dataUrl });
        }
      });
      return true;
    }
    sendResponse({ success: false, error: 'capture_unsupported' });
    return true;
  }

  // Fallback for unhandled message actions so message ports do not close prematurely
  sendResponse({ success: false, error: 'unknown_action' });
  return false;
});

// Compare Semver utility
function compareSemver(v1, v2) {
  const p1 = (v1 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Background Cloud Updater Check (Vercel + GitHub Raw Dual Polling)
async function checkCloudForUpdates() {
  try {
    let installedVer = (chrome.runtime && chrome.runtime.getManifest)
      ? (chrome.runtime.getManifest().version || '1.5.0')
      : '1.5.0';

    // Ensure legacy simulation keys are cleanly pruned from storage
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['simulated_installed_version']).catch(() => {});
    }

    let targetBaseUrl = DEFAULT_VERCEL_URL;
    if (chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['custom_update_server']);
      if (stored && stored.custom_update_server && !stored.custom_update_server.includes('.run.app') && !stored.custom_update_server.includes('localhost')) {
        targetBaseUrl = stored.custom_update_server.replace(/\/$/, '');
      }
    }

    const endpoints = [
      `${targetBaseUrl}/version.json?_t=${Date.now()}`,
      `${GITHUB_RAW_URL}?_t=${Date.now()}`
    ];

    let data = null;
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp.ok) {
          data = await resp.json();
          if (data && data.version) break;
        }
      } catch (e) {
        console.debug('Failed fetching from:', url, e);
      }
    }

    if (!data || !data.version) return { hasUpdate: false };

    const remoteVer = data.version;
    const isNewer = compareSemver(remoteVer, installedVer) > 0;

    if (isNewer) {
      // Set badge on toolbar icon with brand color (#0284C7)
      updateExtensionBadge(true);
      chrome.action.setTitle({ title: `⚡ BeamDrop Update Available (v${remoteVer})! Click to update.` });

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          updateAvailable: true,
          latestVersion: remoteVer,
          updateDownloadUrl: data.downloadUrl || `${targetBaseUrl}/extension.zip`,
          updateHighlights: data.highlights || [],
          updateChangelog: data.changelog || [],
          lastCheckedTimestamp: Date.now()
        });
      }

      // Native OS notification
      if (chrome.notifications && chrome.notifications.create) {
        chrome.notifications.create(`beamdrop_update_${remoteVer}`, {
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: `⚡ BeamDrop Update v${remoteVer} Available!`,
          message: `A new version of BeamDrop is available. Click toolbar icon to apply instant update.`
        });
      }

      return { hasUpdate: true, version: remoteVer, data };
    } else {
      updateExtensionBadge(false);
      return { hasUpdate: false, version: remoteVer, data };
    }
  } catch (err) {
    console.debug('Background update check skipped/failed:', err);
    return { hasUpdate: false };
  }
}

// External message listener for Web-to-Extension Auth, Pairing Bridge & Quota Sync
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // 1. One-Click Zero-UI Extension Pairing Bridge
  if (message?.type === 'BEAMDROP_EXT_SYNC' || message?.action === 'sync_beamdrop_session') {
    if (chrome.storage && chrome.storage.local) {
      const pairedSession = {
        peerId: message.peerId,
        token: message.token,
        phoneName: message.phoneName || 'Mobile Phone',
        keyHex: message.keyHex || '',
        receiverBaseUrl: message.receiverBaseUrl || DEFAULT_VERCEL_URL,
        pairedAt: Date.now()
      };
      chrome.storage.local.set({
        beamdrop_paired_phone: pairedSession
      }, () => {
        if (chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "⚡ BeamDrop: Phone Connected!",
            message: `Paired with ${pairedSession.phoneName}. Right-click any image or text to beam directly to phone!`
          });
        }
        sendResponse({ success: true, paired: true, session: pairedSession });
      });
      return true;
    }
  }

  // 2. Query Active Pairing Status
  if (message?.type === 'BEAMDROP_GET_PAIR_STATUS' || message?.action === 'get_paired_session') {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['beamdrop_paired_phone'], (res) => {
        sendResponse({
          success: true,
          paired: Boolean(res.beamdrop_paired_phone),
          pairedPhone: res.beamdrop_paired_phone || null
        });
      });
      return true;
    }
  }

  // 3. Unpair Phone
  if (message?.type === 'BEAMDROP_UNPAIR_PHONE' || message?.action === 'unpair_session') {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['beamdrop_paired_phone'], () => {
        sendResponse({ success: true, unpaired: true });
      });
      return true;
    }
  }

  // 4. Web Account Auth Sync
  if (message?.type === 'BEAMDROP_AUTH_SYNC') {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        beamdrop_user: message.user || null,
        beamdrop_daily_usage: message.dailyUsage || null,
        beamdrop_last_sync: Date.now()
      }, () => {
        sendResponse({ success: true, received: true });
      });
      return true;
    }
  }

  if (message?.type === 'BEAMDROP_GET_STATUS') {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['beamdrop_user', 'beamdrop_daily_usage', 'beamdrop_paired_phone'], (res) => {
        sendResponse({
          success: true,
          user: res.beamdrop_user || null,
          dailyUsage: res.beamdrop_daily_usage || null,
          pairedPhone: res.beamdrop_paired_phone || null
        });
      });
      return true;
    }
  }
});

// Background High-Efficiency ReadableStream Buffer & Direct Disk Pipeline (OPFS)
const activeBackgroundStreams = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'init_background_stream') {
    const { streamId, fileName, mime, size } = message;
    const safeName = (fileName || `beam_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');

    (async () => {
      let controller = null;
      let writableStream = null;
      let fileHandle = null;
      let pipePromise = null;
      let isOpfs = false;

      try {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
          const root = await navigator.storage.getDirectory();
          fileHandle = await root.getFileHandle(`bdrop_bg_${streamId}_${safeName}`, { create: true });
          writableStream = await fileHandle.createWritable();
          isOpfs = true;
        }
      } catch (opfsErr) {
        console.warn('[BeamDrop Background] OPFS init notice, using memory fallback:', opfsErr);
      }

      const queueStrategy = new ByteLengthQueuingStrategy({ highWaterMark: 1024 * 1024 });
      const readableStream = new ReadableStream({
        start(c) {
          controller = c;
        },
        cancel(reason) {
          console.warn('[BeamDrop Background] Stream cancelled:', reason);
        }
      }, queueStrategy);

      if (writableStream) {
        pipePromise = readableStream.pipeTo(writableStream).catch((err) => {
          console.error('[BeamDrop Background] Disk pipe error:', err);
        });
      }

      activeBackgroundStreams.set(streamId, {
        readableStream,
        controller,
        fileHandle,
        writableStream,
        pipePromise,
        isOpfs,
        fileName: safeName,
        mime: mime || 'application/octet-stream',
        size: size || 0,
        receivedBytes: 0,
        chunksCount: 0
      });

      sendResponse({ success: true, streamId, isOpfs });
    })();
    return true;
  }

  if (message?.action === 'push_stream_chunk') {
    const { streamId, chunk, chunkIndex } = message;
    const stream = activeBackgroundStreams.get(streamId);
    if (stream && stream.controller) {
      let data = chunk;
      if (!(data instanceof Uint8Array)) {
        if (Array.isArray(data)) {
          data = new Uint8Array(data);
        } else if (data instanceof ArrayBuffer) {
          data = new Uint8Array(data);
        } else if (data && data.buffer) {
          data = new Uint8Array(data.buffer);
        } else {
          data = new Uint8Array(0);
        }
      }

      // Check if 32-byte binary frame header is present and extract payload
      if (data.byteLength >= 32) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const payloadLen = view.getUint32(24, false);
        if (payloadLen > 0 && 32 + payloadLen <= data.byteLength) {
          data = data.subarray(32, 32 + payloadLen);
        }
      }

      try {
        stream.controller.enqueue(data);
        stream.receivedBytes += data.byteLength;
        stream.chunksCount++;
        const desired = stream.controller.desiredSize ?? 1;
        sendResponse({
          success: true,
          receivedBytes: stream.receivedBytes,
          chunksCount: stream.chunksCount,
          backpressure: desired <= 0
        });
      } catch (enqueueErr) {
        sendResponse({ success: false, error: String(enqueueErr) });
      }
    } else {
      sendResponse({ success: false, error: 'Stream not found' });
    }
    return true;
  }

  if (message?.action === 'close_background_stream') {
    const { streamId, autoDownload = true } = message;
    const stream = activeBackgroundStreams.get(streamId);
    if (!stream) {
      sendResponse({ success: false, error: 'Stream not found' });
      return true;
    }

    (async () => {
      try {
        if (stream.controller) {
          try { stream.controller.close(); } catch (_) {}
        }
        if (stream.pipePromise) {
          await stream.pipePromise;
        }

        // If stored in OPFS and auto-download requested, download directly via chrome.downloads
        if (stream.isOpfs && stream.fileHandle && autoDownload && chrome.downloads && chrome.downloads.download) {
          try {
            const file = await stream.fileHandle.getFile();
            const blobUrl = URL.createObjectURL(file);
            chrome.downloads.download({
              url: blobUrl,
              filename: stream.fileName,
              saveAs: false,
              conflictAction: 'uniquify'
            }, () => {
              setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            });
          } catch (dlErr) {
            console.warn('[BeamDrop Background] Auto-download error:', dlErr);
          }
        }

        activeBackgroundStreams.delete(streamId);
        sendResponse({
          success: true,
          fileName: stream.fileName,
          totalBytes: stream.receivedBytes,
          chunksCount: stream.chunksCount,
          isOpfs: stream.isOpfs
        });
      } catch (closeErr) {
        activeBackgroundStreams.delete(streamId);
        sendResponse({ success: false, error: String(closeErr) });
      }
    })();
    return true;
  }
});
