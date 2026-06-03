/* ============================================================
   LYTARY v3.0 — js/app.js
   Full application logic
   New in v3: Dashboard Analytics, Search, User Management, Activity Log
   ============================================================ */
'use strict';

// ── CONFIG ────────────────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwIPmYU39Vi2U2aROas1kB-cku8cH7Qxp9S8_nZcr59KAWio7SqGb0r81ViPS-dAnjZ7w/exec';

const SHEET_META = {
  Dok_Akademik:   { label: 'Akademik',  badge: 'badge-cyan',   stripe: 'stripe-cyan',   icon: '📚', barColor: '#14b8a6' },
  Dok_SOP:        { label: 'SOP',       badge: 'badge-green',  stripe: 'stripe-green',  icon: '📋', barColor: '#10b981' },
  Surat_Tugas:    { label: 'S. Tugas',  badge: 'badge-yellow', stripe: 'stripe-yellow', icon: '📜', barColor: '#f59e0b' },
  Surat_Undangan: { label: 'Undangan',  badge: 'badge-purple', stripe: 'stripe-purple', icon: '📨', barColor: '#8b5cf6' },
};

const LOG_ACTION_MAP = {
  LOGIN:             { label: 'Login',        cls: 'badge-login'   },
  ADD_DOKUMEN:       { label: 'Tambah Dok',   cls: 'badge-dokumen' },
  DELETE_DOKUMEN:    { label: 'Hapus Dok',    cls: 'badge-dokumen' },
  GENERATE_SURAT:    { label: 'Gen. Surat',   cls: 'badge-surat'   },
  ADD_USER:          { label: 'Tambah User',  cls: 'badge-user'    },
  UPDATE_USER:       { label: 'Edit User',    cls: 'badge-user'    },
  ACTIVATE_USER:     { label: 'Aktifkan',     cls: 'badge-user'    },
  DEACTIVATE_USER:   { label: 'Nonaktifkan',  cls: 'badge-user'    },
  DELETE_USER:       { label: 'Hapus User',   cls: 'badge-user'    },
  CHANGE_PASSWORD:   { label: 'Ganti Pass',   cls: 'badge-user'    },
};

// ── STATE ─────────────────────────────────────────────────────
const state = {
  user:       null,
  allDokumen: {},
  activeTab:  null,
  score:      0,
  users:      [],
  logs:       [],
};

// ============================================================
//  UTILITIES
// ============================================================

async function gasCall(params) {
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function addScore(pts) {
  state.score += pts;
  document.getElementById('score-counter').textContent = String(state.score).padStart(6, '0');
}

function fmtDate(raw) {
  if (!raw) return '—';
  if (typeof raw === 'number') {
    return new Date((raw - 25569) * 86400 * 1000).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  const s = String(raw);
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(s).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  return s;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

function showResult(el, type, html) {
  el.className = `alert alert-${type}`;
  el.innerHTML = html;
  el.classList.remove('hidden');
}

// ── CLOCK ────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('hud-clock');
  const tick = () => { el.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }); };
  tick();
  setInterval(tick, 1000);
}

// ============================================================
//  SCREEN: TITLE
// ============================================================
document.getElementById('btn-goto-login').addEventListener('click', () => {
  showScreen('screen-login');
  document.getElementById('input-nidn').focus();
});

// ============================================================
//  SCREEN: LOGIN
// ============================================================
document.getElementById('btn-back-title').addEventListener('click', () => showScreen('screen-title'));
document.getElementById('btn-login-back').addEventListener('click', () => showScreen('screen-title'));
document.getElementById('input-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
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
  btn.disabled    = true;
  btn.textContent = '⏳ LOADING...';

  try {
    const data = await gasCall({ action: 'login', nidn, password });
    if (data.status === 'SUCCESS') {
      state.user = data.user;
      mountDashboard();
      showScreen('screen-dashboard');
      // Load dashboard data immediately
      loadDashboard();
      loadAllDokumen();
      addScore(100);
      showToast(`🎮 WELCOME, ${state.user.nama}!`);
    } else {
      errEl.textContent = data.message === 'AKUN DINONAKTIFKAN'
        ? '🚫 Akun kamu dinonaktifkan. Hubungi admin.'
        : '❌ NIDN atau password salah!';
      errEl.classList.remove('hidden');
      document.getElementById('input-password').value = '';
    }
  } catch (err) {
    errEl.textContent = '⚠️ Gagal terhubung ke server.';
    errEl.classList.remove('hidden');
    console.error(err);
  } finally {
    btn.disabled    = false;
    btn.textContent = '► CONTINUE';
  }
}

// ============================================================
//  DASHBOARD MOUNT
// ============================================================
function mountDashboard() {
  const u = state.user;
  document.getElementById('sidebar-nama').textContent = u.nama;
  document.getElementById('sidebar-role').textContent = `ROLE: ${u.role.toUpperCase()}`;
  document.getElementById('sidebar-nidn').textContent = `ID: ${u.nidn}`;
  document.getElementById('hud-role-badge').textContent = u.role.toUpperCase();
  startClock();

  const isAdmin = u.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));

  // Default panel based on role
  switchPanel(isAdmin ? 'panel-dashboard' : 'panel-repositori');
}

// ── LOGOUT ───────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  state.user = null; state.allDokumen = {}; state.score = 0; state.users = []; state.logs = [];
  document.getElementById('input-nidn').value = '';
  document.getElementById('input-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
  showScreen('screen-title');
  showToast('👋 Logged out.', 'info');
});

// ── PANEL NAVIGATION ─────────────────────────────────────────
function switchPanel(panelId) {
  document.querySelectorAll('.nav-item[data-panel]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-panel="${panelId}"]`);
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');

  const labels = {
    'panel-dashboard': 'DASHBOARD', 'panel-repositori': 'REPOSITORI DOKUMEN',
    'panel-surat': 'SURAT & UNDANGAN', 'panel-users': 'MANAJEMEN USER',
    'panel-log': 'LOG AKTIVITAS', 'panel-admin': 'ADMIN PANEL',
  };
  document.getElementById('hud-panel-name').textContent = labels[panelId] || '';

  // Lazy loads
  if (panelId === 'panel-surat') loadSuratDosen();
  if (panelId === 'panel-log')   loadActivityLog();
  if (panelId === 'panel-users') loadUsers();
}

document.querySelectorAll('.nav-item[data-panel]').forEach(btn => {
  btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
});

// ── SUB-TABS ─────────────────────────────────────────────────
document.querySelectorAll('.sub-tab[data-subtab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId    = btn.dataset.subtab;
    const container = btn.closest('.sub-tabs');
    container.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    btn.closest('.panel').querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
  });
});

// ============================================================
//  MODULE: DASHBOARD ANALYTICS
// ============================================================
async function loadDashboard() {
  // Show skeletons
  document.getElementById('stat-total-dok').textContent   = '…';
  document.getElementById('stat-total-users').textContent = '…';
  document.getElementById('stat-st-bulan').textContent    = '…';
  document.getElementById('stat-su-bulan').textContent    = '…';
  document.getElementById('dash-dok-breakdown').innerHTML = '<div class="state-loading"><p>Loading...</p></div>';
  document.getElementById('dash-recent-log').innerHTML    = '<div class="state-loading"><p>Loading...</p></div>';

  try {
    const data = await gasCall({ action: 'getDashboardStats' });
    if (data.status !== 'SUCCESS') throw new Error(data.message);
    const d = data.data;

    // Stat cards
    document.getElementById('stat-total-dok').textContent   = d.total_dokumen;
    document.getElementById('stat-total-users').textContent = `${d.active_users}/${d.total_users}`;
    document.getElementById('stat-st-bulan').textContent    = d.surat_tugas_bulan;
    document.getElementById('stat-su-bulan').textContent    = d.surat_undangan_bulan;

    // Breakdown bars
    const maxCount = Math.max(1, ...Object.values(d.dokumen_per_sheet));
    const breakdownHtml = Object.entries(SHEET_META).map(([sheet, meta]) => {
      const count = d.dokumen_per_sheet[sheet] || 0;
      const pct   = Math.round((count / maxCount) * 100);
      return `
        <div class="breakdown-row">
          <div class="breakdown-label">${meta.icon} ${meta.label}</div>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar" style="width:${pct}%;background:${meta.barColor}"></div>
          </div>
          <div class="breakdown-count">${count}</div>
        </div>`;
    }).join('');
    document.getElementById('dash-dok-breakdown').innerHTML = breakdownHtml || '<div class="state-empty">Belum ada data.</div>';

    // Recent log
    const logHtml = (d.recent_activity || []).length
      ? d.recent_activity.map(l => renderMiniLog(l)).join('')
      : '<div class="search-empty">Belum ada aktivitas tercatat.</div>';
    document.getElementById('dash-recent-log').innerHTML = logHtml;

  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('Gagal load dashboard', 'error');
  }
}

function renderMiniLog(l) {
  const meta = LOG_ACTION_MAP[l.action] || { label: l.action, cls: 'badge-default' };
  return `
    <div class="mini-log-item">
      <span class="log-action-badge ${meta.cls}">${meta.label}</span>
      <div class="mini-log-detail">
        <div class="mini-log-who">${escHtml(l.user_nama || '—')}</div>
        <div class="mini-log-what">${escHtml(l.detail || '')}</div>
      </div>
      <div class="mini-log-when">${String(l.timestamp || '').substring(11,16)}</div>
    </div>`;
}

// ============================================================
//  MODULE: SEARCH
// ============================================================
const searchInput    = document.getElementById('search-input');
const searchDropdown = document.getElementById('search-results');
let   searchTimer    = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (!q) { searchDropdown.classList.add('hidden'); return; }
  searchTimer = setTimeout(() => doSearch(q), 350);
});

searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim()) searchDropdown.classList.remove('hidden');
});

document.addEventListener('click', e => {
  if (!document.getElementById('search-box').contains(e.target)) {
    searchDropdown.classList.add('hidden');
  }
});

async function doSearch(q) {
  searchDropdown.innerHTML = '<div class="search-empty">⏳ Mencari...</div>';
  searchDropdown.classList.remove('hidden');

  try {
    const data = await gasCall({ action: 'searchDokumen', q });
    if (!data.data || !data.data.length) {
      searchDropdown.innerHTML = `<div class="search-empty">Tidak ada hasil untuk "<strong>${escHtml(q)}</strong>"</div>`;
      return;
    }

    searchDropdown.innerHTML = data.data.slice(0, 8).map(d => {
      const meta = SHEET_META[d._sheet] || {};
      const isPlaceholder = !d.drive_file_id || d.drive_file_id.startsWith('GANTI');
      return `
        <div class="search-result-item" onclick="${isPlaceholder ? '' : `openPreview('${d.drive_file_id}','${escHtml(d.judul)}')`}" style="${isPlaceholder ? 'cursor:default' : ''}">
          <div class="search-result-icon">${meta.icon || '📄'}</div>
          <div>
            <div class="search-result-title">${escHtml(d.judul)}</div>
            <div class="search-result-meta">${meta.label || d._sheet} · ${escHtml(d.kategori || '—')}</div>
          </div>
        </div>`;
    }).join('');

    if (data.data.length > 8) {
      searchDropdown.innerHTML += `<div class="search-empty" style="border-top:1px solid var(--slate-100)">+${data.data.length - 8} hasil lainnya</div>`;
    }
  } catch (err) {
    searchDropdown.innerHTML = '<div class="search-empty">⚠️ Gagal mencari.</div>';
  }
}

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { searchDropdown.classList.add('hidden'); searchInput.blur(); }
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
  const tabsEl = document.getElementById('repo-tabs');
  const sheets = Object.keys(state.allDokumen);

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
    btn.className = `repo-tab${(!state.activeTab && key === '__ALL__') || state.activeTab === key ? ' active' : ''}`;
    btn.innerHTML  = `${icon} ${label} <span class="tab-count">${count}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.repo-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = key;
      renderRepoDocs(key);
    });
    tabsEl.appendChild(btn);
  });

  state.activeTab = '__ALL__';
  renderRepoDocs('__ALL__');
}

function renderRepoDocs(tabKey) {
  const el   = document.getElementById('repo-content');
  let   docs = [];

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
    const meta          = SHEET_META[d._sheet] || {};
    const isPlaceholder = !d.drive_file_id || d.drive_file_id.startsWith('GANTI');
    const downloadUrl   = isPlaceholder ? '#' : `https://drive.google.com/uc?export=download&id=${d.drive_file_id}`;
    return `
      <div class="doc-card">
        <div class="doc-card-stripe ${meta.stripe || 'stripe-cyan'}"></div>
        <div class="doc-card-body">
          <span class="doc-badge ${meta.badge || 'badge-cyan'}">${escHtml(d.kategori || meta.label || '—')}</span>
          <div class="doc-title">${escHtml(d.judul || '(Tanpa Judul)')}</div>
          <div class="doc-desc">${escHtml(d.deskripsi || '—')}</div>
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
    const msg = `<div class="state-empty">⚠️ ${escHtml(err.message)}</div>`;
    stEl.innerHTML = msg; suEl.innerHTML = msg;
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
        <div class="surat-nomor">${escHtml(s.nomor_surat || '—')}</div>
        <div class="surat-info">
          <div class="surat-perihal">${escHtml(s.perihal || '(Tanpa Perihal)')}</div>
          <div class="surat-meta">📅 ${fmtDate(s.tanggal)} &nbsp;|&nbsp; ${escHtml(s.status || '—')}</div>
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

// ── Generate Surat ──────────────────────────────────────────
document.getElementById('btn-gen-st').addEventListener('click', () => generateSurat('ST'));
document.getElementById('btn-gen-su').addEventListener('click', () => generateSurat('SU'));

async function generateSurat(type) {
  const p        = type === 'ST' ? 'st' : 'su';
  const resultEl = document.getElementById(`${p}-result`);
  const btn      = document.getElementById(`btn-gen-${p}`);

  const fields = {
    nama_dosen:          document.getElementById(`${p}-nama`).value.trim(),
    nidn_dosen:          document.getElementById(`${p}-nidn`).value.trim(),
    jabatan:             document.getElementById(`${p}-jabatan`).value.trim(),
    prodi:               document.getElementById(`${p}-prodi`).value.trim(),
    perihal:             document.getElementById(`${p}-perihal`).value.trim(),
    penandatangan:       document.getElementById(`${p}-penandatangan`).value.trim(),
    nidn_penandatangan:  document.getElementById(`${p}-nidn-ttd`).value.trim(),
    keterangan:          document.getElementById(`${p}-keterangan`).value.trim(),
    _nidn: state.user?.nidn || '',
    _nama: state.user?.nama || '',
  };

  if (!fields.nama_dosen || !fields.nidn_dosen || !fields.perihal) {
    showResult(resultEl, 'error', '⚠️ Nama dosen, NIDN, dan perihal wajib diisi.');
    return;
  }

  btn.disabled = true; btn.textContent = '⏳ Generating...'; resultEl.classList.add('hidden');

  try {
    const action = type === 'ST' ? 'generateSuratTugas' : 'generateSuratUndangan';
    const data   = await gasCall({ action, data: encodeURIComponent(JSON.stringify(fields)) });

    if (data.status === 'SUCCESS') {
      const d = data.data;
      showResult(resultEl, 'success',
        `✅ Surat berhasil digenerate!<br>📋 Nomor: <strong>${d.nomor_surat}</strong><br>
         <a href="${d.preview_url}" target="_blank" class="btn btn-primary btn-sm" style="margin-top:.5rem;display:inline-flex;">👁 PREVIEW</a>
         &nbsp;<a href="${d.download_url}" target="_blank" class="btn btn-cyan btn-sm" style="margin-top:.5rem;display:inline-flex;">⬇ DOWNLOAD</a>`
      );
      addScore(200);
      showToast('✅ Surat berhasil digenerate!');
    } else {
      showResult(resultEl, 'error', `❌ ${escHtml(data.message)}`);
    }
  } catch (err) {
    showResult(resultEl, 'error', `⚠️ Error: ${escHtml(err.message)}`);
  } finally {
    btn.disabled = false;
    btn.textContent = type === 'ST' ? '⚡ GENERATE SURAT TUGAS' : '⚡ GENERATE SURAT UNDANGAN';
  }
}

// ── Admin: Add Dokumen ───────────────────────────────────────
document.getElementById('btn-add-dok').addEventListener('click', addDokumen);

async function addDokumen() {
  const resultEl = document.getElementById('adm-result');
  const btn      = document.getElementById('btn-add-dok');
  const sheet    = document.getElementById('adm-sheet').value;
  const judul    = document.getElementById('adm-judul').value.trim();
  const kategori = document.getElementById('adm-kategori').value.trim();
  const fileid   = document.getElementById('adm-fileid').value.trim();
  const deskripsi= document.getElementById('adm-deskripsi').value.trim();

  if (!judul || !fileid) { showResult(resultEl, 'error', '⚠️ Judul dan File ID wajib diisi.'); return; }

  btn.disabled = true; btn.textContent = '⏳ Saving...'; resultEl.classList.add('hidden');

  try {
    const docData = {
      judul, kategori, deskripsi, drive_file_id: fileid,
      _nidn: state.user?.nidn || '', _nama: state.user?.nama || '',
    };
    const data = await gasCall({ action: 'addDokumen', sheet, data: encodeURIComponent(JSON.stringify(docData)) });
    if (data.status === 'SUCCESS') {
      showResult(resultEl, 'success', `✅ Dokumen ditambahkan! ID: <strong>${data.id}</strong>`);
      ['adm-judul','adm-kategori','adm-fileid','adm-deskripsi'].forEach(id => { document.getElementById(id).value = ''; });
      addScore(150);
      showToast('✅ Dokumen ditambahkan!');
      loadAllDokumen();
      loadDashboard();
    } else {
      showResult(resultEl, 'error', `❌ ${escHtml(data.message)}`);
    }
  } catch (err) {
    showResult(resultEl, 'error', `⚠️ ${escHtml(err.message)}`);
  } finally {
    btn.disabled = false; btn.textContent = '+ ADD TO INVENTORY';
  }
}

// ============================================================
//  MODULE: USER MANAGEMENT (NEW)
// ============================================================
document.getElementById('btn-refresh-users').addEventListener('click', loadUsers);
document.getElementById('btn-show-add-user').addEventListener('click', openAddUserForm);
document.getElementById('btn-cancel-user').addEventListener('click', closeUserForm);
document.getElementById('btn-save-user').addEventListener('click', saveUser);

async function loadUsers() {
  const wrap = document.getElementById('users-table-wrap');
  wrap.innerHTML = '<div class="state-loading"><p>Loading users...</p></div>';
  try {
    const data = await gasCall({ action: 'getUsers' });
    if (data.status !== 'SUCCESS') throw new Error(data.message);
    state.users = data.data;
    renderUsersTable(data.data);
  } catch (err) {
    wrap.innerHTML = `<div class="state-empty">⚠️ ${escHtml(err.message)}</div>`;
  }
}

function renderUsersTable(users) {
  const wrap = document.getElementById('users-table-wrap');
  if (!users.length) {
    wrap.innerHTML = '<div class="state-empty">Belum ada user.</div>';
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>USER</th><th>NIDN</th><th>ROLE</th><th>PRODI</th><th>STATUS</th><th>AKSI</th>
      </tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>
              <span class="user-avatar-sm">${u.role === 'admin' ? '⚙️' : '👤'}</span>
              <strong>${escHtml(u.nama)}</strong>
              ${u.email ? `<br><span style="font-size:.68rem;color:#94a3b8;">${escHtml(u.email)}</span>` : ''}
            </td>
            <td style="font-family:var(--font-mono);font-size:.75rem">${escHtml(u.nidn)}</td>
            <td><span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-dosen'}">${u.role}</span></td>
            <td style="font-size:.78rem;color:#64748b">${escHtml(u.prodi || '—')}</td>
            <td>
              <span class="status-dot ${u.active ? 'dot-active' : 'dot-inactive'}"></span>
              ${u.active ? 'Aktif' : 'Nonaktif'}
            </td>
            <td>
              <div class="table-actions">
                <button class="btn btn-cyan btn-sm" onclick="openEditUserForm('${escHtml(u.id)}')">✏️ Edit</button>
                <button class="btn btn-sm" style="background:${u.active ? '#fef2f2' : '#ecfdf5'};color:${u.active ? '#dc2626' : '#059669'};border:1px solid ${u.active ? '#fecaca' : '#a7f3d0'}"
                  onclick="toggleUserActive('${escHtml(u.id)}', ${!u.active})">
                  ${u.active ? '🚫 Nonaktifkan' : '✅ Aktifkan'}
                </button>
                ${u.role !== 'admin' ? `<button class="btn btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca" onclick="deleteUser('${escHtml(u.id)}','${escHtml(u.nama)}')">🗑</button>` : ''}
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function openAddUserForm() {
  document.getElementById('uf-id').value       = '';
  document.getElementById('uf-nama').value     = '';
  document.getElementById('uf-nidn').value     = '';
  document.getElementById('uf-password').value = '';
  document.getElementById('uf-role').value     = 'dosen';
  document.getElementById('uf-prodi').value    = '';
  document.getElementById('uf-email').value    = '';
  document.getElementById('uf-result').classList.add('hidden');
  document.getElementById('user-form-title').textContent = '👤 TAMBAH USER BARU';
  document.getElementById('uf-password').placeholder     = 'Password (wajib untuk user baru)';
  document.getElementById('user-form-wrap').classList.remove('hidden');
  document.getElementById('uf-nama').focus();
}

window.openEditUserForm = function(userId) {
  const u = state.users.find(x => x.id === userId);
  if (!u) return;
  document.getElementById('uf-id').value       = u.id;
  document.getElementById('uf-nama').value     = u.nama;
  document.getElementById('uf-nidn').value     = u.nidn;
  document.getElementById('uf-password').value = '';
  document.getElementById('uf-role').value     = u.role;
  document.getElementById('uf-prodi').value    = u.prodi || '';
  document.getElementById('uf-email').value    = u.email || '';
  document.getElementById('uf-result').classList.add('hidden');
  document.getElementById('user-form-title').textContent = `✏️ EDIT USER — ${u.nama}`;
  document.getElementById('uf-password').placeholder     = 'Kosongkan jika tidak ingin mengubah password';
  document.getElementById('user-form-wrap').classList.remove('hidden');
  document.getElementById('uf-nama').focus();
  document.getElementById('user-form-wrap').scrollIntoView({ behavior: 'smooth' });
};

function closeUserForm() {
  document.getElementById('user-form-wrap').classList.add('hidden');
}

async function saveUser() {
  const id       = document.getElementById('uf-id').value;
  const isEdit   = !!id;
  const resultEl = document.getElementById('uf-result');
  const btn      = document.getElementById('btn-save-user');

  const userData = {
    id:       id,
    nama:     document.getElementById('uf-nama').value.trim(),
    nidn:     document.getElementById('uf-nidn').value.trim(),
    password: document.getElementById('uf-password').value.trim(),
    role:     document.getElementById('uf-role').value,
    prodi:    document.getElementById('uf-prodi').value.trim(),
    email:    document.getElementById('uf-email').value.trim(),
  };

  if (!userData.nama || !userData.nidn) {
    showResult(resultEl, 'error', '⚠️ Nama dan NIDN wajib diisi.'); return;
  }
  if (!isEdit && !userData.password) {
    showResult(resultEl, 'error', '⚠️ Password wajib diisi untuk user baru.'); return;
  }

  btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; resultEl.classList.add('hidden');

  try {
    const action = isEdit ? 'updateUser' : 'addUser';
    const data   = await gasCall({ action, data: encodeURIComponent(JSON.stringify(userData)) });

    if (data.status === 'SUCCESS') {
      showResult(resultEl, 'success', `✅ ${data.message}`);
      showToast(data.message);
      addScore(isEdit ? 50 : 100);
      setTimeout(() => { closeUserForm(); loadUsers(); loadDashboard(); }, 1200);
    } else {
      showResult(resultEl, 'error', `❌ ${escHtml(data.message)}`);
    }
  } catch (err) {
    showResult(resultEl, 'error', `⚠️ ${escHtml(err.message)}`);
  } finally {
    btn.disabled = false; btn.textContent = '💾 SIMPAN USER';
  }
}

window.toggleUserActive = async function(id, active) {
  const label = active ? 'mengaktifkan' : 'menonaktifkan';
  if (!confirm(`Yakin ingin ${label} user ini?`)) return;
  try {
    const data = await gasCall({ action: 'toggleUser', id, active: String(active) });
    if (data.status === 'SUCCESS') {
      showToast(`✅ User berhasil ${active ? 'diaktifkan' : 'dinonaktifkan'}`);
      loadUsers(); loadDashboard();
    } else {
      showToast(`❌ ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`⚠️ ${err.message}`, 'error');
  }
};

window.deleteUser = async function(id, nama) {
  if (!confirm(`Yakin ingin MENGHAPUS user "${nama}"?\n\nTindakan ini tidak bisa dibatalkan!`)) return;
  try {
    const data = await gasCall({ action: 'deleteUser', id });
    if (data.status === 'SUCCESS') {
      showToast('🗑 User berhasil dihapus');
      loadUsers(); loadDashboard();
    } else {
      showToast(`❌ ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`⚠️ ${err.message}`, 'error');
  }
};

// ============================================================
//  MODULE: ACTIVITY LOG (NEW)
// ============================================================
document.getElementById('btn-refresh-log').addEventListener('click', loadActivityLog);
document.getElementById('log-filter').addEventListener('change', renderLogTable);

async function loadActivityLog() {
  const wrap = document.getElementById('log-table-wrap');
  wrap.innerHTML = '<div class="state-loading"><p>Loading log...</p></div>';
  try {
    const data = await gasCall({ action: 'getActivityLog', limit: 200 });
    if (data.status !== 'SUCCESS') throw new Error(data.message);
    state.logs = data.data;
    renderLogTable();
  } catch (err) {
    wrap.innerHTML = `<div class="state-empty">⚠️ ${escHtml(err.message)}</div>`;
  }
}

function renderLogTable() {
  const wrap      = document.getElementById('log-table-wrap');
  const filterVal = document.getElementById('log-filter').value;
  const logs      = filterVal ? state.logs.filter(l => l.action === filterVal) : state.logs;

  if (!logs.length) {
    wrap.innerHTML = '<div class="state-empty">Belum ada log aktivitas.</div>';
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>WAKTU</th><th>AKTIVITAS</th><th>USER</th><th>NIDN</th><th>DETAIL</th>
      </tr></thead>
      <tbody>
        ${logs.map(l => {
          const meta = LOG_ACTION_MAP[l.action] || { label: l.action, cls: 'badge-default' };
          return `<tr>
            <td class="log-ts">${escHtml(l.timestamp || '—')}</td>
            <td><span class="log-action-badge ${meta.cls}">${meta.label}</span></td>
            <td style="font-weight:600">${escHtml(l.user_nama || '—')}</td>
            <td style="font-family:var(--font-mono);font-size:.72rem;color:#64748b">${escHtml(l.user_nidn || '—')}</td>
            <td style="color:#64748b;font-size:.78rem">${escHtml(l.detail || '—')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ============================================================
//  MODAL: DOCUMENT PREVIEW
// ============================================================
window.openPreview = function(fileId, title) {
  document.getElementById('modal-title').textContent = title || 'DOCUMENT VIEWER';
  document.getElementById('modal-iframe').src        = `https://drive.google.com/file/d/${fileId}/preview`;
  document.getElementById('modal-download').href     = `https://drive.google.com/uc?export=download&id=${fileId}`;
  document.getElementById('modal-preview').classList.remove('hidden');
  // Close search dropdown if open
  document.getElementById('search-results').classList.add('hidden');
  document.getElementById('search-input').value = '';
};

function closeModal() {
  document.getElementById('modal-preview').classList.add('hidden');
  document.getElementById('modal-iframe').src = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
