// Options script
document.addEventListener('DOMContentLoaded', () => {
  const autoRadar = document.getElementById('autoRadar');
  const autoDownload = document.getElementById('autoDownload');
  const soundEffects = document.getElementById('soundEffects');
  const saveBtn = document.getElementById('saveOptionsBtn');

  // Load saved preferences
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['autoRadar', 'autoDownload', 'soundEffects'], (res) => {
      if (res.autoRadar !== undefined) autoRadar.checked = res.autoRadar;
      if (res.autoDownload !== undefined) autoDownload.checked = res.autoDownload;
      if (res.soundEffects !== undefined) soundEffects.checked = res.soundEffects;
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const prefs = {
        autoRadar: autoRadar ? autoRadar.checked : true,
        autoDownload: autoDownload ? autoDownload.checked : true,
        soundEffects: soundEffects ? soundEffects.checked : true
      };

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(prefs, () => {
          saveBtn.textContent = '✓ Saved!';
          setTimeout(() => {
            saveBtn.textContent = 'Save Preferences';
          }, 2000);
        });
      } else {
        localStorage.setItem('beamdrop_prefs', JSON.stringify(prefs));
        saveBtn.textContent = '✓ Saved!';
        setTimeout(() => {
          saveBtn.textContent = 'Save Preferences';
        }, 2000);
      }
    });
  }
});
