/* ============================================================
   LYTARY — Layanan Terpadu Akademik Repository
   Frontend App Logic: app.js  v2.0 — Multi-sheet
   ============================================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwIPmYU39Vi2U2aROas1kB-cku8cH7Qxp9S8_nZcr59KAWio7SqGb0r81ViPS-dAnjZ7w/exec';

// ── Definisi tab repositori (sheet name → label UI) ──────────
const REPO_TABS = [
  { sheet: 'Dok_Akademik',   label: '📚 DOK. AKADEMIK', color: 'cyan'    },
  { sheet: 'Dok_SOP',        label: '📋 SOP',           color: 'green'   },
  { sheet: 'Surat_Tugas',    label: '📜 SURAT TUGAS',   color: 'yellow'  },
  { sheet: 'Surat_Undangan', label: '📨 UNDANGAN',      color: 'magenta' }
];

// ── State ────────────────────────────────────────────────────
let currentUser  = null;
let scoreCounter = 0;
let repoData     = {};          // { sheetName: [...docs] }
let activeSheet  = 'Dok_Akademik';

// ============================================================
//  API HELPERS
// ============================================================
async function apiGet(params) {
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ============================================================
//  UTILITIES
// ============================================================
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  const icon = type === 'error' ? '✖' : type === 'info' ? 'ℹ' : '✔';
  t.textContent = icon + ' ' + msg;
  t.className = 'toast' + (type !== 'success' ? ' ' + type : '');
  t.classList.remove('hidden');
  if (type === 'success') addScore(100);
  setTimeout(() => t.classList.add('hidden'), 3500);
}

function addScore(pts) {
  scoreCounter += pts;
  const el = document.getElementById('score-counter');
  if (el) el.textContent = String(scoreCounter).padStart(6, '0');
}

function startClock() {
  setInterval(() => {
    const n = new Date();
    const p = v => String(v).padStart(2, '0');
    const el = document.getElementById('hud-clock');
    if (el) el.textContent = p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds());
  }, 1000);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function showPanel(panelId, hudName) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(panelId)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-panel="${panelId}"]`)?.classList.add('active');
  const hudEl = document.getElementById('hud-panel-name');
  if (hudEl && hudName) hudEl.textContent = hudName;

  if (panelId === 'panel-repositori') renderRepoTabs();
  if (panelId === 'panel-surat')      loadSuratDosen();
  if (panelId === 'panel-admin')      renderAdminSheetSelector();
}

// ============================================================
//  AUTH
// ============================================================
async function handleLogin() {
  const nidn = document.getElementById('input-nidn').value.trim();
  const pass = document.getElementById('input-password').value.trim();
  const errEl = document.getElementById('login-error');

  if (!nidn || !pass) {
    errEl.classList.remove('hidden');
    errEl.textContent = '⚠ SEMUA FIELD HARUS DIISI!';
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.textContent = '⌛ LOADING...';
  btn.disabled = true;

  try {
    const res = await apiPost({ action: 'login', nidn, password: pass });
    if (res.status === 'SUCCESS') {
      currentUser = res.user;
      errEl.classList.add('hidden');
      setupDashboard();
      showScreen('screen-dashboard');
      loadAllDokumen();
      startClock();
      addScore(500);
      showToast('WELCOME, ' + currentUser.nama.toUpperCase() + '!');
    } else {
      errEl.classList.remove('hidden');
      errEl.textContent = '❌ ACCESS DENIED! WRONG CODE!';
      document.getElementById('input-password').value = '';
    }
  } catch (err) {
    errEl.classList.remove('hidden');
    errEl.textContent = '⚠ CONNECTION ERROR! CHECK API URL.';
  }

  btn.textContent = '► CONTINUE';
  btn.disabled = false;
}

function setupDashboard() {
  document.getElementById('sidebar-nama').textContent  = currentUser.nama.toUpperCase();
  document.getElementById('sidebar-role').textContent  = 'ROLE: ' + currentUser.role.toUpperCase();
  document.getElementById('sidebar-nidn').textContent  = 'ID: '   + currentUser.nidn;
  document.getElementById('hud-role-badge').textContent = currentUser.role.toUpperCase();

  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', currentUser.role !== 'admin');
  });
}

function handleLogout() {
  currentUser = null; repoData = {}; scoreCounter = 0;
  document.getElementById('input-nidn').value = '';
  document.getElementById('input-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
  showScreen('screen-login');
}

// ============================================================
//  REPOSITORI — MULTI-SHEET TABS
// ============================================================

// Preload semua sheet sekaligus saat login
async function loadAllDokumen() {
  try {
    const res = await apiGet({ action: 'getAllDokumen' });
    if (res.status === 'SUCCESS') {
      repoData = res.data;
      renderRepoTabs();
      addScore(50);
    }
  } catch (err) {
    console.error('loadAllDokumen error:', err);
  }
}

// Buat tab navigasi repositori secara dinamis
function renderRepoTabs() {
  const container = document.getElementById('repo-tab-container');
  const content   = document.getElementById('repo-tab-content');

  // Build tab buttons
  container.innerHTML = REPO_TABS.map(t => `
    <button class="repo-tab ${t.color} ${activeSheet === t.sheet ? 'active' : ''}"
            data-sheet="${t.sheet}">
      ${t.label}
      <span class="repo-tab-count">${(repoData[t.sheet] || []).length}</span>
    </button>
  `).join('');

  // Attach events
  container.querySelectorAll('.repo-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSheet = btn.dataset.sheet;
      renderRepoTabs(); // re-render untuk update active state
    });
  });

  // Render isi tab aktif
  renderDokumenGrid(repoData[activeSheet] || [], activeSheet);
}

function renderDokumenGrid(docs, sheetName) {
  const grid = document.getElementById('repo-tab-content');

  if (!docs || docs.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      ░░ NO ITEMS FOUND ░░<br/><br/>
      INVENTORY IS EMPTY.<br/>ADMIN CAN ADD VIA ADMIN PANEL.
    </div>`;
    return;
  }

  const isAdminUser = currentUser && currentUser.role === 'admin';
  // Warna aksen per sheet
  const accentMap = {
    'Dok_Akademik':   'cyan',
    'Dok_SOP':        'green',
    'Surat_Tugas':    'yellow',
    'Surat_Undangan': 'magenta'
  };
  const accent = accentMap[sheetName] || 'green';

  grid.innerHTML = docs.map(doc => `
    <div class="dokumen-card accent-${accent}">
      <div class="dokumen-card-body">
        <div class="dokumen-badge badge-${accent}">${escHtml(doc.kategori || sheetName)}</div>
        <div class="dokumen-title">${escHtml(doc.judul)}</div>
        <div class="dokumen-desc">${escHtml(doc.deskripsi || '---')}</div>
        <div class="dokumen-date">📅 ${escHtml(String(doc.tanggal_upload))}</div>
        <div class="dokumen-actions">
          <button class="pixel-btn btn-${accent} btn-sm"
            onclick="openPreview('${escHtml(doc.drive_file_id)}','${escHtml(doc.judul)}','${escHtml(doc.download_url)}')">
            👁 PREVIEW
          </button>
          <a href="${escHtml(doc.download_url)}" target="_blank"
             class="pixel-btn btn-green btn-sm">⬇ DL</a>
          ${isAdminUser ? `
          <button class="pixel-btn btn-red btn-sm"
            onclick="handleDeleteDok('${escHtml(sheetName)}','${escHtml(doc.id)}')">🗑</button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ── Refresh salah satu sheet ──────────────────────────────────
async function refreshSheet(sheetName) {
  try {
    const res = await apiGet({ action: 'getDokumen', sheet: sheetName });
    if (res.status === 'SUCCESS') {
      repoData[sheetName] = res.data;
      if (activeSheet === sheetName) renderRepoTabs();
      showToast('RELOADED: ' + sheetName, 'info');
    }
  } catch (err) {
    showToast('CONNECTION ERROR', 'error');
  }
}

// ── Delete ────────────────────────────────────────────────────
async function handleDeleteDok(sheetName, id) {
  if (!confirm('DELETE ' + id + ' FROM ' + sheetName + '?')) return;
  try {
    const res = await apiPost({ action: 'deleteDokumen', sheet: sheetName, id });
    if (res.status === 'SUCCESS') {
      showToast('DELETED: ' + id);
      await refreshSheet(sheetName);
    } else {
      showToast(res.message, 'error');
    }
  } catch (err) { showToast('CONNECTION ERROR', 'error'); }
}

// ============================================================
//  ADMIN — TAMBAH DOKUMEN (pilih sheet tujuan)
// ============================================================
function renderAdminSheetSelector() {
  const sel = document.getElementById('adm-sheet-select');
  if (!sel) return;
  sel.innerHTML = REPO_TABS.map(t =>
    `<option value="${t.sheet}">${t.label.replace(/📚|📋|📜|📨/g,'').trim()}</option>`
  ).join('');
}

async function handleAddDokumen() {
  const sheetName  = document.getElementById('adm-sheet-select').value;
  const judul      = document.getElementById('adm-judul').value.trim();
  const kategori   = document.getElementById('adm-kategori').value.trim();
  const fileid     = document.getElementById('adm-fileid').value.trim();
  const deskripsi  = document.getElementById('adm-deskripsi').value.trim();
  const resultEl   = document.getElementById('adm-result');

  if (!judul || !fileid) { showToast('JUDUL & FILE ID WAJIB DIISI!', 'error'); return; }

  const btn = document.getElementById('btn-add-dokumen');
  btn.textContent = '⌛ SAVING...';
  btn.disabled = true;

  try {
    const res = await apiPost({
      action: 'addDokumen',
      sheet: sheetName,
      data: { judul, kategori, drive_file_id: fileid, deskripsi }
    });
    resultEl.classList.remove('hidden');
    if (res.status === 'SUCCESS') {
      resultEl.textContent = '✔ BERHASIL! ID: ' + res.id + ' → ' + res.sheet;
      resultEl.style.cssText = 'border-color:var(--green);color:var(--green)';
      showToast('+100 ITEM ADDED!');
      document.getElementById('adm-judul').value   = '';
      document.getElementById('adm-fileid').value  = '';
      document.getElementById('adm-deskripsi').value = '';
      // Refresh sheet yang baru ditambah
      await refreshSheet(sheetName);
    } else {
      resultEl.textContent = '✖ ERROR: ' + res.message;
      resultEl.style.cssText = 'border-color:var(--red);color:var(--red)';
      showToast(res.message, 'error');
    }
  } catch (err) { showToast('CONNECTION ERROR', 'error'); }

  btn.textContent = '+ ADD TO INVENTORY';
  btn.disabled = false;
}

// ============================================================
//  SURAT: INBOX DOSEN
// ============================================================
async function loadSuratDosen() {
  const stEl = document.getElementById('list-surat-tugas');
  const suEl = document.getElementById('list-surat-undangan');
  if (stEl) stEl.innerHTML = '<div class="loading-state"><p>FETCHING MAIL...</p></div>';
  if (suEl) suEl.innerHTML = '<div class="loading-state"><p>FETCHING MAIL...</p></div>';

  try {
    const res = await apiGet({ action: 'getSuratDosen', nidn: currentUser.nidn });
    if (res.status === 'SUCCESS') {
      renderSuratList('list-surat-tugas',    res.data.surat_tugas,    'ST');
      renderSuratList('list-surat-undangan', res.data.surat_undangan, 'SU');
    }
  } catch (err) {
    if (stEl) stEl.innerHTML = '<div class="empty-state">⚠ CONNECTION ERROR</div>';
  }
}

function renderSuratList(containerId, arr, tipe) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!arr || arr.length === 0) {
    el.innerHTML = `<div class="empty-state">📭 NO MAIL IN INBOX.<br/>ADMIN CAN GENERATE LETTERS.</div>`;
    return;
  }
  el.innerHTML = arr.map(s => `
    <div class="surat-card">
      <div class="surat-nomor">[${tipe}]<br/>${escHtml(s.nomor_surat)}</div>
      <div class="surat-info">
        <div class="surat-perihal">${escHtml(s.perihal)}</div>
        <div class="surat-meta">👤 ${escHtml(s.nama_dosen)} | 📅 ${escHtml(String(s.tanggal))} | ◈ ${escHtml(s.status)}</div>
      </div>
      <div class="surat-actions">
        <button class="pixel-btn btn-cyan btn-sm"
          onclick="openPreview('${escHtml(s.pdf_file_id)}','${escHtml(s.nomor_surat)}','${escHtml(s.download_url)}')">
          👁 VIEW
        </button>
        <a href="${escHtml(s.download_url)}" target="_blank"
           class="pixel-btn btn-green btn-sm">⬇</a>
      </div>
    </div>
  `).join('');
}

// ============================================================
//  GENERATE SURAT
// ============================================================
async function handleGenerateSurat(tipe) {
  const prefix   = tipe === 'ST' ? 'st' : 'su';
  const resultId = prefix + '-result';
  const btnId    = 'btn-generate-' + prefix;
  const action   = tipe === 'ST' ? 'generateSuratTugas' : 'generateSuratUndangan';

  const getData = id => document.getElementById(prefix + '-' + id)?.value.trim() || '';
  const resultEl = document.getElementById(resultId);
  resultEl?.classList.add('hidden');

  const namaDosen = getData('nama-dosen');
  const nidnDosen = getData('nidn-dosen');
  const perihal   = getData('perihal');

  if (!namaDosen || !nidnDosen || !perihal) {
    showToast('NAMA, NIDN, & PERIHAL WAJIB DIISI!', 'error'); return;
  }

  const btn = document.getElementById(btnId);
  const origText = btn.textContent;
  btn.textContent = '⌛ GENERATING...';
  btn.disabled = true;

  try {
    const res = await apiPost({
      action,
      data: {
        nama_dosen:         namaDosen,
        nidn_dosen:         nidnDosen,
        jabatan_dosen:      getData('jabatan'),
        program_studi:      getData('prodi'),
        perihal,
        nama_penandatangan: getData('penandatangan'),
        nidn_penandatangan: getData('nidn-ttd'),
        keterangan_tambahan:getData('keterangan')
      }
    });

    if (resultEl) resultEl.classList.remove('hidden');
    if (res.status === 'SUCCESS') {
      const d = res.data;
      if (resultEl) {
        resultEl.innerHTML = `✔ SURAT BERHASIL!<br/><br/>
          📋 NOMOR : ${escHtml(d.nomor_surat)}<br/>
          📄 FILE  : ${escHtml(d.nama_file)}<br/><br/>
          <a href="${escHtml(d.preview_url)}" target="_blank">👁 PREVIEW</a> &nbsp;|&nbsp;
          <a href="${escHtml(d.download_url)}" target="_blank">⬇ DOWNLOAD</a>`;
        resultEl.style.cssText = 'border-color:var(--green);color:var(--green)';
      }
      showToast('SURAT ' + d.nomor_surat + ' DIBUAT!');
      addScore(1000);
      // Refresh sheet surat terkait
      await refreshSheet(tipe === 'ST' ? 'Surat_Tugas' : 'Surat_Undangan');
    } else {
      if (resultEl) {
        resultEl.innerHTML = '✖ ERROR: ' + escHtml(res.message);
        resultEl.style.cssText = 'border-color:var(--red);color:var(--red)';
      }
      showToast(res.message, 'error');
    }
  } catch (err) { showToast('CONNECTION ERROR', 'error'); }

  btn.textContent = origText;
  btn.disabled = false;
}

// ============================================================
//  PREVIEW MODAL
// ============================================================
function openPreview(fileId, title, downloadUrl) {
  document.getElementById('modal-title').textContent = String(title).toUpperCase();
  document.getElementById('preview-iframe').src = 'https://drive.google.com/file/d/' + fileId + '/preview';
  document.getElementById('modal-download-btn').href = downloadUrl;
  document.getElementById('modal-preview').classList.remove('hidden');
  addScore(10);
}

function closePreview() {
  document.getElementById('modal-preview').classList.add('hidden');
  document.getElementById('preview-iframe').src = '';
}

// ============================================================
//  SUB-TABS (Inbox / Generate)
// ============================================================
function initSubTabs() {
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const container = tab.closest('.panel');
      container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.subtab)?.classList.add('active');
    });
  });
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // Title
  document.getElementById('btn-goto-login')
    .addEventListener('click', () => showScreen('screen-login'));

  // Login
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('btn-login-back').addEventListener('click', () => showScreen('screen-title'));
  document.getElementById('btn-back-title').addEventListener('click', () => showScreen('screen-title'));
  document.getElementById('input-password')
    .addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('input-nidn')
    .addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('input-password').focus(); });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Sidebar nav
  const hudNames = {
    'panel-repositori': 'REPOSITORI DOKUMEN',
    'panel-surat':      'SURAT & UNDANGAN',
    'panel-admin':      'ADMIN PANEL'
  };
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => showPanel(item.dataset.panel, hudNames[item.dataset.panel]));
  });

  // Refresh button
  document.getElementById('btn-refresh-dok')
    ?.addEventListener('click', () => loadAllDokumen());

  // Generate surat
  document.getElementById('btn-generate-st')
    ?.addEventListener('click', () => handleGenerateSurat('ST'));
  document.getElementById('btn-generate-su')
    ?.addEventListener('click', () => handleGenerateSurat('SU'));

  // Admin add dokumen
  document.getElementById('btn-add-dokumen')
    ?.addEventListener('click', handleAddDokumen);

  // Modal
  document.getElementById('modal-close-btn')?.addEventListener('click', closePreview);
  document.getElementById('modal-close-overlay')?.addEventListener('click', closePreview);

  initSubTabs();
  showScreen('screen-title');
});
