/**
 * BeamDrop Background Service Worker (Manifest V3)
 * Handles context menus, OTA background update checks, and toolbar notification badges.
 */

const DEFAULT_VERCEL_URL = "https://beam-drop-mu.vercel.app";
const UPDATE_ALARM_NAME = "beamdrop_periodic_update_check";

// Initialize on installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "beamdrop_send_selection",
    title: "BeamDrop: Send selection to Phone",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_link",
    title: "BeamDrop: Send link to Phone",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_image",
    title: "BeamDrop: Send image URL to Phone",
    contexts: ["image"]
  });

  // Setup periodic background check for updates (every 30 mins)
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

// Context Menu actions
chrome.contextMenus.onClicked.addListener((info) => {
  let contentToSend = "";
  if (info.menuItemId === "beamdrop_send_selection" && info.selectionText) {
    contentToSend = info.selectionText;
  } else if (info.menuItemId === "beamdrop_send_link" && info.linkUrl) {
    contentToSend = info.linkUrl;
  } else if (info.menuItemId === "beamdrop_send_image" && info.srcUrl) {
    contentToSend = info.srcUrl;
  }

  if (contentToSend && chrome.storage) {
    chrome.storage.local.set({ pendingShareText: contentToSend }, () => {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "BeamDrop Ready",
        message: "Text ready to beam! Click BeamDrop in your toolbar to generate your QR portal."
      });
    });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check_updates_now') {
    checkCloudForUpdates().then((res) => sendResponse(res));
    return true;
  }
  if (message.action === 'clear_update_badge') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ cleared: true });
  }
});

// Background Cloud Updater Check
async function checkCloudForUpdates() {
  try {
    const installedVer = chrome.runtime.getManifest().version || '1.2.0';

    // Retrieve custom server or repo if set
    let targetBaseUrl = DEFAULT_VERCEL_URL;
    if (chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['custom_update_server']);
      if (stored && stored.custom_update_server) {
        targetBaseUrl = stored.custom_update_server.replace(/\/$/, '');
      }
    }

    const endpoint = `${targetBaseUrl}/version.json?_t=${Date.now()}`;
    const resp = await fetch(endpoint, { cache: 'no-store' });
    if (!resp.ok) return { hasUpdate: false };

    const data = await resp.json();
    const remoteVer = data.version || '1.3.0';

    const isNewer = compareSemver(remoteVer, installedVer) > 0;
    if (isNewer) {
      // Set badge on toolbar icon
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' }); // Glowing cyan
      chrome.action.setTitle({ title: `BeamDrop Update Available (v${remoteVer})! Click to update.` });

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          updateAvailable: true,
          latestVersion: remoteVer,
          updateHighlights: data.highlights || [],
          updateChangelog: data.changelog || [],
          lastCheckedTimestamp: Date.now()
        });
      }
      return { hasUpdate: true, version: remoteVer };
    } else {
      chrome.action.setBadgeText({ text: '' });
      return { hasUpdate: false, version: remoteVer };
    }
  } catch (err) {
    console.debug('Background update check skipped/failed:', err);
    return { hasUpdate: false };
  }
}

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
