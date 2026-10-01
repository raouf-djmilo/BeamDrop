/**
 * BeamDrop Background Service Worker (Manifest V3)
 * Universal Device Bridge: Context Menus, Clipboard Relaying,
 * OTA Background Update Engine, Toolbar Badges, and Direct Package Downloads.
 */

const DEFAULT_VERCEL_URL = "https://beam-drop-mu.vercel.app";
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/raouf-djmilo/BeamDrop/main/public/version.json";
const UPDATE_ALARM_NAME = "beamdrop_periodic_update_check";

// Initialize on installed
chrome.runtime.onInstalled.addListener(() => {
  // Setup Context Menus
  chrome.contextMenus.create({
    id: "beamdrop_send_selection",
    title: "⚡ BeamDrop: Beam text to Phone",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_link",
    title: "⚡ BeamDrop: Beam link to Phone",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_image",
    title: "⚡ BeamDrop: Beam image URL to Phone",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_open_sidepanel",
    title: "⚡ BeamDrop: Open Side Panel (Persistent)",
    contexts: ["action"]
  });

  // Setup periodic background check for updates (every 30 mins, with immediate 1-min initial check)
  chrome.alarms.create(UPDATE_ALARM_NAME, {
    periodInMinutes: 30,
    delayInMinutes: 1
  });

  // Check immediately on install
  checkCloudForUpdates();
});

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

// Context Menu actions
chrome.contextMenus.onClicked.addListener((info, tab) => {
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

  let contentToSend = "";
  let contentType = "text";

  if (info.menuItemId === "beamdrop_send_selection" && info.selectionText) {
    contentToSend = info.selectionText;
    contentType = "text";
  } else if (info.menuItemId === "beamdrop_send_link" && info.linkUrl) {
    contentToSend = info.linkUrl;
    contentType = "link";
  } else if (info.menuItemId === "beamdrop_send_image" && info.srcUrl) {
    contentToSend = info.srcUrl;
    contentType = "link";
  }

  if (contentToSend && chrome.storage && chrome.storage.local) {
    const payload = {
      type: contentType,
      content: contentToSend,
      timestamp: Date.now()
    };

    chrome.storage.local.set({ pendingSharePayload: payload }, () => {
      // Try to open side panel or popup immediately if supported
      if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.id) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      } else if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup().catch(() => {});
      }

      if (chrome.notifications && chrome.notifications.create) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "BeamDrop: Ready to Beam!",
          message: `${contentType === 'link' ? 'Link' : 'Text'} ready to transfer. Click BeamDrop in your toolbar to scan QR.`
        });
      }
    });
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

  if (message.action === 'check_updates_now') {
    checkCloudForUpdates().then((res) => sendResponse(res));
    return true;
  }

  if (message.action === 'clear_update_badge') {
    chrome.action.setBadgeText({ text: '' });
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
      // Set badge on toolbar icon
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' }); // Glowing cyan
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
      chrome.action.setBadgeText({ text: '' });
      return { hasUpdate: false, version: remoteVer, data };
    }
  } catch (err) {
    console.debug('Background update check skipped/failed:', err);
    return { hasUpdate: false };
  }
}

// External message listener for Web-to-Extension Auth & Quota Bridge
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
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
      chrome.storage.local.get(['beamdrop_user', 'beamdrop_daily_usage'], (res) => {
        sendResponse({
          success: true,
          user: res.beamdrop_user || null,
          dailyUsage: res.beamdrop_daily_usage || null
        });
      });
      return true;
    }
  }
});
