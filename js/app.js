/* ============================================================
   LYTARY v2.0 — js/app.js
   Full application logic: auth, routing, data, UI
   ============================================================ */

'use strict';

// ── CONFIG ────────────────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwIPmYU39Vi2U2aROas1kB-cku8cH7Qxp9S8_nZcr59KAWio7SqGb0r81ViPS-dAnjZ7w/exec';

// Sheet → badge/stripe style mapping
const SHEET_META = {
  Dok_Akademik:   { label: 'Akademik',  badge: 'badge-cyan',   stripe: 'stripe-cyan',   icon: '📚' },
  Dok_SOP:        { label: 'SOP',       badge: 'badge-green',  stripe: 'stripe-green',  icon: '📋' },
  Surat_Tugas:    { label: 'S. Tugas',  badge: 'badge-yellow', stripe: 'stripe-yellow', icon: '📜' },
  Surat_Undangan: { label: 'Undangan',  badge: 'badge-purple', stripe: 'stripe-purple', icon: '📨' },
};

// ── STATE ─────────────────────────────────────────────────────
const state = {
  user:        null,          // logged-in user object
  allDokumen:  {},            // { sheetName: [...] }
  activeTab:   null,          // current repo tab key
  score:       0,
};

// ── HELPERS ──────────────────────────────────────────────────

/**
 * Call GAS Web App with query params.
 * Always uses GET + URLSearchParams because GAS fetch-as-GET is most reliable.
 */
async function gasCall(params) {
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Show a screen by id, hide all others */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/** Flash a toast message */
let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

/** Increment score */
function addScore(pts) {
  state.score += pts;
  document.getElementById('score-counter').textContent =
    String(state.score).padStart(6, '0');
}

/** Format Excel serial date or ISO string to readable date */
function fmtDate(raw) {
  if (!raw) return '—';
  // Excel serial number (days since 1900-01-01, with Lotus 1-2-3 leap-year bug)
  if (typeof raw === 'number') {
    const ms = (raw - 25569) * 86400 * 1000;
    return new Date(ms).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  if (typeof raw === 'string' && raw.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(raw).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  return raw;
}

// ── CLOCK ────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('hud-clock');
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

// ── SCREEN: TITLE ────────────────────────────────────────────
document.getElementById('btn-goto-login').addEventListener('click', () => {
  showScreen('screen-login');
  document.getElementById('input-nidn').focus();
});

// ── SCREEN: LOGIN ────────────────────────────────────────────
document.getElementById('btn-back-title').addEventListener('click', () => showScreen('screen-title'));
document.getElementById('btn-login-back').addEventListener('click', () => showScreen('screen-title'));

document.getElementById('input-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('btn-login').addEventListener('click', doLogin);

async function doLogin() {
  const nidn     = document.getElementById('input-nidn').value.trim();
  const password = document.getElementById('input-password').value.trim();
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('btn-login');

  if (!nidn || !password) {
    errEl.textContent = '⚠️ NIDN dan password wajib diisi!';
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ LOADING...';

  try {
    const data = await gasCall({ action: 'login', nidn, password });

    if (data.status === 'SUCCESS') {
      state.user = data.user;
      mountDashboard();
      showScreen('screen-dashboard');
      loadAllDokumen();
      addScore(100);
      showToast(`🎮 WELCOME, ${state.user.nama}!`);
    } else {
      errEl.textContent = '❌ ACCESS DENIED! WRONG CODE!';
      errEl.classList.remove('hidden');
      document.getElementById('input-password').value = '';
      document.getElementById('input-password').focus();
    }
  } catch (err) {
    errEl.textContent = '⚠️ Gagal terhubung ke server. Cek koneksi internet.';
    errEl.classList.remove('hidden');
    console.error('Login error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = '► CONTINUE';
  }
}

// ── DASHBOARD: MOUNT ─────────────────────────────────────────
function mountDashboard() {
  const u = state.user;
  document.getElementById('sidebar-nama').textContent = u.nama;
  document.getElementById('sidebar-role').textContent = `ROLE: ${u.role.toUpperCase()}`;
  document.getElementById('sidebar-nidn').textContent = `ID: ${u.nidn}`;
  document.getElementById('hud-role-badge').textContent = u.role.toUpperCase();
  startClock();

  // Show/hide admin-only elements
  const isAdmin = u.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin);
  });
}

// ── PANEL NAVIGATION ─────────────────────────────────────────
document.querySelectorAll('.nav-item[data-panel]').forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.dataset.panel;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    document.getElementById('hud-panel-name').textContent =
      btn.textContent.trim().replace(/^[^\w]+/, '').trim();

    // Lazy-load surat when switching to that panel
    if (panelId === 'panel-surat' && state.user) loadSuratDosen();
  });
});

// ── LOGOUT ───────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  state.user = null;
  state.allDokumen = {};
  state.score = 0;
  document.getElementById('input-nidn').value = '';
  document.getElementById('input-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
  showScreen('screen-title');
  showToast('👋 Logged out.', 'info');
});

// ── SUB-TABS ─────────────────────────────────────────────────
document.querySelectorAll('.sub-tab[data-subtab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.subtab;
    // Only within the same .sub-tabs container
    const container = btn.closest('.sub-tabs');
    container.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Hide all sub-panels that share the same parent panel
    const panel = btn.closest('.panel');
    panel.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
  });
});

// ============================================================
//  MODULE: REPOSITORI DOKUMEN
// ============================================================

document.getElementById('btn-refresh-dok').addEventListener('click', loadAllDokumen);

async function loadAllDokumen() {
  const contentEl = document.getElementById('repo-content');
  contentEl.innerHTML = '<div class="state-loading"><p>LOADING DOKUMEN...</p></div>';
  document.getElementById('repo-tabs').innerHTML = '';

  try {
    const data = await gasCall({ action: 'getAllDokumen' });
    if (data.status !== 'SUCCESS') throw new Error(data.message);

    state.allDokumen = data.data;
    addScore(50);
    renderRepoTabs();
  } catch (err) {
    contentEl.innerHTML = `<div class="state-empty">⚠️ Gagal memuat dokumen.<br>${err.message}</div>`;
    showToast('Gagal memuat dokumen', 'error');
  }
}

function renderRepoTabs() {
  const tabsEl   = document.getElementById('repo-tabs');
  const sheets   = Object.keys(state.allDokumen);

  // Build "ALL" tab + per-sheet tabs
  const tabs = [
    { key: '__ALL__', label: 'ALL', icon: '🗂️' },
    ...sheets.map(k => ({ key: k, label: SHEET_META[k]?.label || k, icon: SHEET_META[k]?.icon || '📄' })),
  ];

  tabsEl.innerHTML = '';
  tabs.forEach(({ key, label, icon }) => {
    const count = key === '__ALL__'
      ? sheets.reduce((s, k) => s + (state.allDokumen[k]?.length || 0), 0)
      : (state.allDokumen[key]?.length || 0);

    const btn = document.createElement('button');
    btn.className = `repo-tab${state.activeTab === key || (!state.activeTab && key === '__ALL__') ? ' active' : ''}`;
    btn.innerHTML = `${icon} ${label} <span class="tab-count">${count}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.repo-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = key;
      renderRepoDocs(key);
    });
    tabsEl.appendChild(btn);
  });

  // Default to ALL
  state.activeTab = '__ALL__';
  renderRepoDocs('__ALL__');
}

function renderRepoDocs(tabKey) {
  const el = document.getElementById('repo-content');
  let docs = [];

  if (tabKey === '__ALL__') {
    Object.entries(state.allDokumen).forEach(([sheet, list]) => {
      list.forEach(d => docs.push({ ...d, _sheet: sheet }));
    });
  } else {
    docs = (state.allDokumen[tabKey] || []).map(d => ({ ...d, _sheet: tabKey }));
  }

  if (!docs.length) {
    el.innerHTML = '<div class="state-empty">Belum ada dokumen di sini.</div>';
    return;
  }

  el.innerHTML = docs.map(d => {
    const meta   = SHEET_META[d._sheet] || {};
    const isPlaceholder = !d.drive_file_id || d.drive_file_id.startsWith('GANTI');
    const previewUrl    = isPlaceholder ? '#' : `https://drive.google.com/file/d/${d.drive_file_id}/preview`;
    const downloadUrl   = isPlaceholder ? '#' : `https://drive.google.com/uc?export=download&id=${d.drive_file_id}`;

    return `
      <div class="doc-card">
        <div class="doc-card-stripe ${meta.stripe || 'stripe-cyan'}"></div>
        <div class="doc-card-body">
          <span class="doc-badge ${meta.badge || 'badge-cyan'}">${d.kategori || meta.label || '—'}</span>
          <div class="doc-title">${d.judul || '(Tanpa Judul)'}</div>
          <div class="doc-desc">${d.deskripsi || '—'}</div>
          <div class="doc-date">📅 ${fmtDate(d.tanggal_upload)}</div>
          <div class="doc-actions">
            ${isPlaceholder
              ? `<span style="font-size:.72rem;color:#94a3b8;">File belum tersedia</span>`
              : `<button class="btn btn-primary btn-sm" onclick="openPreview('${d.drive_file_id}','${escHtml(d.judul)}')">👁 PREVIEW</button>
                 <a class="btn btn-cyan btn-sm" href="${downloadUrl}" target="_blank">⬇ DOWNLOAD</a>`
            }
          </div>
        </div>
      </div>`;
  }).join('');
}

function escHtml(str) {
  return String(str).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// ============================================================
//  MODULE: SURAT DOSEN
// ============================================================

async function loadSuratDosen() {
  if (!state.user) return;
  const stEl = document.getElementById('list-surat-tugas');
  const suEl = document.getElementById('list-surat-undangan');
  stEl.innerHTML = '<div class="state-loading"><p>FETCHING MAIL...</p></div>';
  suEl.innerHTML = '<div class="state-loading"><p>FETCHING MAIL...</p></div>';

  try {
    const data = await gasCall({ action: 'getSuratDosen', nidn: state.user.nidn });
    if (data.status !== 'SUCCESS') throw new Error(data.message);

    renderSuratList(stEl, data.data.surat_tugas   || []);
    renderSuratList(suEl, data.data.surat_undangan || []);
  } catch (err) {
    stEl.innerHTML = `<div class="state-empty">⚠️ ${err.message}</div>`;
    suEl.innerHTML = `<div class="state-empty">⚠️ ${err.message}</div>`;
  }
}

function renderSuratList(containerEl, list) {
  if (!list.length) {
    containerEl.innerHTML = '<div class="state-empty">Belum ada surat.</div>';
    return;
  }

  containerEl.innerHTML = list.map(s => {
    const hasFile = s.pdf_file_id && !s.pdf_file_id.startsWith('GANTI');
    return `
      <div class="surat-card">
        <div class="surat-nomor">${s.nomor_surat || '—'}</div>
        <div class="surat-info">
          <div class="surat-perihal">${s.perihal || '(Tanpa Perihal)'}</div>
          <div class="surat-meta">📅 ${fmtDate(s.tanggal)} &nbsp;|&nbsp; ${s.status || '—'}</div>
        </div>
        <div class="surat-actions">
          ${hasFile
            ? `<button class="btn btn-primary btn-sm" onclick="openPreview('${s.pdf_file_id}','${escHtml(s.nomor_surat)}')">👁 VIEW</button>
               <a class="btn btn-cyan btn-sm" href="https://drive.google.com/uc?export=download&id=${s.pdf_file_id}" target="_blank">⬇</a>`
            : `<span style="font-size:.72rem;color:#94a3b8;">—</span>`
          }
        </div>
      </div>`;
  }).join('');
}

// ============================================================
//  MODULE: GENERATE SURAT (Admin)
// ============================================================

document.getElementById('btn-gen-st').addEventListener('click', () => generateSurat('ST'));
document.getElementById('btn-gen-su').addEventListener('click', () => generateSurat('SU'));

async function generateSurat(type) {
  const prefix  = type === 'ST' ? 'st' : 'su';
  const resultEl = document.getElementById(`${prefix}-result`);
  const btn      = document.getElementById(`btn-gen-${prefix.toLowerCase()}`);

  const fields = {
    nama_dosen:      document.getElementById(`${prefix}-nama`).value.trim(),
    nidn_dosen:      document.getElementById(`${prefix}-nidn`).value.trim(),
    jabatan:         document.getElementById(`${prefix}-jabatan`).value.trim(),
    prodi:           document.getElementById(`${prefix}-prodi`).value.trim(),
    perihal:         document.getElementById(`${prefix}-perihal`).value.trim(),
    penandatangan:   document.getElementById(`${prefix}-penandatangan`).value.trim(),
    nidn_penandatangan: document.getElementById(`${prefix}-nidn-ttd`).value.trim(),
    keterangan:      document.getElementById(`${prefix}-keterangan`).value.trim(),
  };

  if (!fields.nama_dosen || !fields.nidn_dosen || !fields.perihal) {
    showResult(resultEl, 'error', '⚠️ Nama dosen, NIDN, dan perihal wajib diisi.');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  resultEl.classList.add('hidden');

  try {
    const action = type === 'ST' ? 'generateSuratTugas' : 'generateSuratUndangan';
    const data   = await gasCall({ action, data: encodeURIComponent(JSON.stringify(fields)) });

    if (data.status === 'SUCCESS') {
      const d = data.data;
      showResult(resultEl, 'success',
        `✅ Surat berhasil digenerate!<br>
         📋 Nomor: <strong>${d.nomor_surat}</strong><br>
         📄 File: ${d.nama_file}<br>
         <a href="${d.preview_url}" target="_blank" class="btn btn-primary btn-sm" style="margin-top:.5rem;display:inline-flex;">👁 PREVIEW</a>
         &nbsp;
         <a href="${d.download_url}" target="_blank" class="btn btn-cyan btn-sm" style="margin-top:.5rem;display:inline-flex;">⬇ DOWNLOAD</a>`
      );
      addScore(200);
      showToast('✅ Surat berhasil digenerate!');
    } else {
      showResult(resultEl, 'error', `❌ ${data.message}`);
    }
  } catch (err) {
    showResult(resultEl, 'error', `⚠️ Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = type === 'ST' ? '⚡ GENERATE SURAT TUGAS' : '⚡ GENERATE SURAT UNDANGAN';
  }
}

function showResult(el, type, html) {
  el.className = `alert alert-${type}`;
  el.innerHTML = html;
  el.classList.remove('hidden');
}

// ============================================================
//  MODULE: ADMIN — ADD DOKUMEN
// ============================================================

document.getElementById('btn-add-dok').addEventListener('click', addDokumen);

async function addDokumen() {
  const resultEl = document.getElementById('adm-result');
  const btn      = document.getElementById('btn-add-dok');

  const sheet    = document.getElementById('adm-sheet').value;
  const judul    = document.getElementById('adm-judul').value.trim();
  const kategori = document.getElementById('adm-kategori').value.trim();
  const fileid   = document.getElementById('adm-fileid').value.trim();
  const deskripsi= document.getElementById('adm-deskripsi').value.trim();

  if (!judul || !fileid) {
    showResult(resultEl, 'error', '⚠️ Judul dan File ID wajib diisi.');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Saving...';
  resultEl.classList.add('hidden');

  try {
    const docData = { judul, kategori, deskripsi, drive_file_id: fileid };
    const data = await gasCall({
      action: 'addDokumen',
      sheet,
      data: encodeURIComponent(JSON.stringify(docData)),
    });

    if (data.status === 'SUCCESS') {
      showResult(resultEl, 'success', `✅ Dokumen berhasil ditambahkan! ID: <strong>${data.id}</strong>`);
      // Clear form
      ['adm-judul','adm-kategori','adm-fileid','adm-deskripsi'].forEach(id => {
        document.getElementById(id).value = '';
      });
      addScore(150);
      showToast('✅ Dokumen ditambahkan!');
      // Refresh repo data in background
      loadAllDokumen();
    } else {
      showResult(resultEl, 'error', `❌ ${data.message}`);
    }
  } catch (err) {
    showResult(resultEl, 'error', `⚠️ Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '+ ADD TO INVENTORY';
  }
}

// ============================================================
//  MODAL: DOCUMENT PREVIEW
// ============================================================

window.openPreview = function(fileId, title) {
  document.getElementById('modal-title').textContent  = title || 'DOCUMENT VIEWER';
  document.getElementById('modal-iframe').src         = `https://drive.google.com/file/d/${fileId}/preview`;
  document.getElementById('modal-download').href      = `https://drive.google.com/uc?export=download&id=${fileId}`;
  document.getElementById('modal-preview').classList.remove('hidden');
};

function closeModal() {
  document.getElementById('modal-preview').classList.add('hidden');
  document.getElementById('modal-iframe').src = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
