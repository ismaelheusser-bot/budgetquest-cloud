(function (global) {
  'use strict';

  function installBackupExportUi() {
    const box = document.getElementById('icloudCloudNote');
    if (!box || box.dataset.backupExportReady === '1') return;
    if (!box.querySelector('#icloudFolder') && !box.textContent.includes('iCloud')) return;

    box.dataset.backupExportReady = '1';
    box.classList.add('backup-export-box');

    const existing = document.createElement('div');
    while (box.firstChild) existing.appendChild(box.firstChild);

    const heading = existing.querySelector('strong');
    if (heading) heading.textContent = 'Manuelles Datei-Backup';

    const introduction = existing.querySelector('p');
    if (introduction) {
      introduction.textContent = 'Optionaler Export als JSON-Datei, zum Beispiel nach iCloud Drive. Die laufende gemeinsame Speicherung erfolgt automatisch über Firebase Cloud.';
    }

    const details = document.createElement('details');
    details.className = 'backup-export-details';
    details.innerHTML = '<summary><span>🗄️ Backup & Export</span><small>Optional · manuelle Sicherungsdatei</small></summary>';
    details.appendChild(existing);

    box.innerHTML = '<div class="backup-primary-note"><strong>☁️ Firebase Cloud ist die Hauptspeicherung</strong><p>Änderungen werden im gemeinsamen Haushalt automatisch synchronisiert. Ein Datei-Backup ist für den normalen Betrieb nicht erforderlich.</p></div>';
    box.appendChild(details);
  }

  function installStyles() {
    if (document.getElementById('backupExportUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'backupExportUiStyles';
    style.textContent = `
      .backup-export-box{display:grid;gap:12px}
      .backup-primary-note{padding:14px;border:1px solid #5de29a55;border-radius:14px;background:#0c2b24}
      .backup-primary-note p{margin:7px 0 0;color:var(--muted);line-height:1.45}
      .backup-export-details{border:1px solid var(--line);border-radius:14px;background:#0b1425;overflow:hidden}
      .backup-export-details>summary{cursor:pointer;list-style:none;display:grid;gap:3px;padding:14px;font-weight:800}
      .backup-export-details>summary::-webkit-details-marker{display:none}
      .backup-export-details>summary:after{content:'›';grid-row:1/3;grid-column:2;align-self:center;justify-self:end;font-size:24px;transform:rotate(90deg);transition:transform .2s}
      .backup-export-details[open]>summary:after{transform:rotate(-90deg)}
      .backup-export-details>summary small{font-weight:400;color:var(--muted)}
      .backup-export-details>div{padding:0 14px 14px}
    `;
    document.head.appendChild(style);
  }

  const start = () => {
    installStyles();
    installBackupExportUi();
    new MutationObserver(() => global.setTimeout(installBackupExportUi, 0))
      .observe(document.documentElement, { childList: true, subtree: true });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once: true })
    : start();
})(window);
