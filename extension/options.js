// BeamDrop Extension Options & Permission Bridge Script
document.addEventListener('DOMContentLoaded', () => {
  const sidePanelEnabled = document.getElementById('sidePanelEnabled');
  const autoRadar = document.getElementById('autoRadar');
  const autoDownload = document.getElementById('autoDownload');
  const soundEffects = document.getElementById('soundEffects');
  const saveBtn = document.getElementById('saveOptionsBtn');
  const cameraStatusBadge = document.getElementById('cameraStatusBadge');
  const btnTestCamera = document.getElementById('btnTestCamera');

  // Camera Grant Banner Elements
  const grantCameraBanner = document.getElementById('grantCameraBanner');
  const btnGrantCameraNow = document.getElementById('btnGrantCameraNow');
  const btnCloseGrantTab = document.getElementById('btnCloseGrantTab');
  const cameraGrantStatus = document.getElementById('cameraGrantStatus');

  const urlParams = new URLSearchParams(window.location.search);
  const isGrantCameraIntent = urlParams.get('grant') === 'camera';

  if (isGrantCameraIntent && grantCameraBanner) {
    grantCameraBanner.style.display = 'flex';
  }

  // 1. Update Camera Permission Indicator
  async function refreshCameraPermissionStatus() {
    if (!navigator.permissions || !navigator.permissions.query) {
      if (cameraStatusBadge) {
        cameraStatusBadge.textContent = 'Supported';
        cameraStatusBadge.className = 'perm-badge granted';
      }
      return;
    }

    try {
      const status = await navigator.permissions.query({ name: 'camera' });
      updateCameraBadge(status.state);
      status.onchange = () => {
        updateCameraBadge(status.state);
      };
    } catch (_) {
      if (cameraStatusBadge) {
        cameraStatusBadge.textContent = 'Ready';
        cameraStatusBadge.className = 'perm-badge prompt';
      }
    }
  }

  function updateCameraBadge(state) {
    if (!cameraStatusBadge) return;
    if (state === 'granted') {
      cameraStatusBadge.textContent = '✓ Granted';
      cameraStatusBadge.className = 'perm-badge granted';
      if (btnTestCamera) btnTestCamera.textContent = 'Verified';
    } else if (state === 'denied') {
      cameraStatusBadge.textContent = '✕ Denied';
      cameraStatusBadge.className = 'perm-badge denied';
      if (btnTestCamera) btnTestCamera.textContent = 'Re-check';
    } else {
      cameraStatusBadge.textContent = 'Prompt Needed';
      cameraStatusBadge.className = 'perm-badge prompt';
      if (btnTestCamera) btnTestCamera.textContent = 'Enable Access';
    }
  }

  // 2. Request Camera Access
  async function requestCameraAccess(isDedicatedFlow = false) {
    if (cameraGrantStatus) {
      cameraGrantStatus.style.display = 'none';
      cameraGrantStatus.className = 'status-alert';
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // Stop all tracks immediately once verified
      stream.getTracks().forEach((track) => track.stop());

      updateCameraBadge('granted');

      if (cameraGrantStatus) {
        cameraGrantStatus.textContent = '✓ Camera permission granted successfully! You can now scan QR codes inside the Side Panel.';
        cameraGrantStatus.className = 'status-alert success';
        cameraGrantStatus.style.display = 'block';
      }

      if (btnCloseGrantTab) {
        btnCloseGrantTab.style.display = 'inline-flex';
      }

      if (btnGrantCameraNow) {
        btnGrantCameraNow.style.display = 'none';
      }

      // Notify background / storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ beamdrop_camera_granted: true });
      }

      if (isDedicatedFlow) {
        setTimeout(() => {
          // If opened in separate window/tab by extension, close tab
          try {
            window.close();
          } catch (_) {}
        }, 1800);
      }
    } catch (err) {
      console.warn('[BeamDrop Camera Bridge] Error:', err);
      updateCameraBadge('denied');
      if (cameraGrantStatus) {
        cameraGrantStatus.textContent = 'Please click the lock icon in the browser address bar to allow camera access for BeamDrop.';
        cameraGrantStatus.className = 'status-alert';
        cameraGrantStatus.style.backgroundColor = '#fef2f2';
        cameraGrantStatus.style.color = '#b91c1c';
        cameraGrantStatus.style.borderColor = '#fecaca';
        cameraGrantStatus.style.display = 'block';
      }
    }
  }

  if (btnTestCamera) {
    btnTestCamera.addEventListener('click', () => {
      requestCameraAccess(false);
    });
  }

  if (btnGrantCameraNow) {
    btnGrantCameraNow.addEventListener('click', () => {
      requestCameraAccess(true);
    });
  }

  if (btnCloseGrantTab) {
    btnCloseGrantTab.addEventListener('click', () => {
      // Try opening sidepanel before closing
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'open_side_panel' }, () => {
          window.close();
        });
      } else {
        window.close();
      }
    });
  }

  // If opened specifically for grant, trigger request automatically on initial user interaction or focus
  if (isGrantCameraIntent) {
    requestCameraAccess(true);
  }

  refreshCameraPermissionStatus();

  // 3. Load saved preferences
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sidePanelEnabled', 'autoRadar', 'autoDownload', 'soundEffects'], (res) => {
      if (sidePanelEnabled && res.sidePanelEnabled !== undefined) {
        sidePanelEnabled.checked = res.sidePanelEnabled;
      }
      if (autoRadar && res.autoRadar !== undefined) {
        autoRadar.checked = res.autoRadar;
      }
      if (autoDownload && res.autoDownload !== undefined) {
        autoDownload.checked = res.autoDownload;
      }
      if (soundEffects && res.soundEffects !== undefined) {
        soundEffects.checked = res.soundEffects;
      }
    });
  }

  // 4. Save Preferences
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const isSidePanel = sidePanelEnabled ? sidePanelEnabled.checked : true;
      const prefs = {
        sidePanelEnabled: isSidePanel,
        autoRadar: autoRadar ? autoRadar.checked : true,
        autoDownload: autoDownload ? autoDownload.checked : true,
        soundEffects: soundEffects ? soundEffects.checked : true
      };

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'set_side_panel_behavior',
          enabled: isSidePanel
        }).catch(() => {});
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(prefs, () => {
          saveBtn.textContent = '✓ Saved Preferences';
          setTimeout(() => {
            saveBtn.textContent = 'Save Preferences';
          }, 2000);
        });
      } else {
        try {
          localStorage.setItem('beamdrop_prefs', JSON.stringify(prefs));
        } catch (_) {}
        saveBtn.textContent = '✓ Saved Preferences';
        setTimeout(() => {
          saveBtn.textContent = 'Save Preferences';
        }, 2000);
      }
    });
  }
});
