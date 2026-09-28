/**
 * BeamDrop Background Service Worker (Manifest V3)
 */

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

  console.log("BeamDrop Service Worker registered.");
});

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
        message: "Text ready to beam! Click BeamDrop to generate your QR portal."
      });
    });
  }
});
