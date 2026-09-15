/**
 * components.js — eVoting OSIM/S
 * ============================================================
 * Reusable UI components: Toast, Modal, Sidebar, Topbar.
 * ============================================================
 */

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

const Toast = (() => {
  // FIX #6: batas maksimum toast bersamaan
  const MAX_TOASTS = 5;

  // FIX #1: tidak cache container — selalu cari fresh dari DOM
  function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.classList.add('toast-container--empty');
      document.body.appendChild(container);
    }
    return container;
  }

  // FIX #14: icon + ARIA role per tipe
  const CONFIG = {
    success: {
      icon:     'fa-circle-check',
      iconCls:  'text-green-500',
      role:     'status',       // non-assertive, tidak interupsi screen reader
      ariaLive: 'polite',
    },
    error: {
      icon:     'fa-circle-xmark',
      iconCls:  'text-red-500',
      role:     'alert',        // assertive, segera dibaca screen reader
      ariaLive: 'assertive',
    },
    warning: {
      icon:     'fa-triangle-exclamation',
      iconCls:  'text-yellow-500',
      role:     'alert',
      ariaLive: 'assertive',
    },
    info: {
      icon:     'fa-circle-info',
      iconCls:  'text-blue-500',
      role:     'status',
      ariaLive: 'polite',
    },
  };

  /**
   * Perbarui class tema kontainer berdasarkan tipe toast yang aktif.
   * Prioritas: error > warning > info > success > empty.
   * Dipanggil setiap kali toast ditambah atau dihapus.
   */
  function updateContainerTheme(container) {
    const PRIORITY = ['error', 'warning', 'info', 'success'];
    const toasts = container.querySelectorAll('.toast:not(.toast-exit)');

    // Kumpulkan semua tipe yang sedang aktif
    let dominant = null;
    for (const type of PRIORITY) {
      for (const t of toasts) {
        if (t.classList.contains(`toast-${type}`)) {
          dominant = type;
          break;
        }
      }
      if (dominant) break;
    }

    // Hapus semua class tema sebelumnya
    container.classList.remove(
      'toast-container--success',
      'toast-container--error',
      'toast-container--warning',
      'toast-container--info',
      'toast-container--empty',
    );
    container.classList.add(dominant ? `toast-container--${dominant}` : 'toast-container--empty');
  }

  /**
   * Dismiss toast dengan animasi exit.
   * FIX #2 + #3 + #7 + #9: animasi exit yang benar, timer dibatalkan.
   * @param {HTMLElement} toast
   * @param {number|null} timerId - ID dari auto-remove timer
   */
  function dismiss(toast, timerId = null) {
    if (!toast || !toast.isConnected) return;
    // Batalkan auto-remove timer jika masih berjalan
    if (timerId !== null) clearTimeout(timerId);
    // Tambah class exit untuk trigger animasi CSS
    toast.classList.add('toast-exit');
    // Hapus dari DOM setelah animasi selesai (300ms), lalu perbarui tema kontainer
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
      // Perbarui tema setelah toast benar-benar hilang dari DOM
      const container = document.getElementById('toast-container');
      if (container) updateContainerTheme(container);
    }, 300);
  }

  /**
   * Tampilkan toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration - ms (0 = permanen)
   * @returns {HTMLElement} elemen toast
   */
  function show(message, type = 'info', duration = 4000) {
    const container = getContainer();
    const cfg       = CONFIG[type] || CONFIG.info;

    // FIX #6: hapus toast paling lama jika sudah di batas
    const existing = container.querySelectorAll('.toast');
    if (existing.length >= MAX_TOASTS) {
      dismiss(existing[0]);
    }

    // Buat elemen toast
    const toast = document.createElement('div');
    // FIX #14: role + aria-live untuk aksesibilitas screen reader
    toast.setAttribute('role', cfg.role);
    toast.setAttribute('aria-live', cfg.ariaLive);
    toast.setAttribute('aria-atomic', 'true');
    toast.className = `toast toast-${type}`;

    // Icon
    const iconEl = document.createElement('i');
    iconEl.className = `fa-solid ${cfg.icon} ${cfg.iconCls} flex-shrink-0`;
    iconEl.setAttribute('aria-hidden', 'true');

    // Message — FIX #15: break-words untuk teks panjang
    const msgEl = document.createElement('div');
    msgEl.className = 'flex-1 text-sm leading-snug break-words min-w-0';
    // FIX #4: escapeHtml untuk keamanan XSS
    msgEl.textContent = message;

    // Tombol close — FIX #13: padding cukup untuk touch target
    const closeBtn = document.createElement('button');
    closeBtn.type      = 'button';
    closeBtn.className = 'toast-close-btn flex-shrink-0';
    closeBtn.setAttribute('aria-label', 'Tutup notifikasi');
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>';

    toast.appendChild(iconEl);
    toast.appendChild(msgEl);
    toast.appendChild(closeBtn);
    container.appendChild(toast);
    // Perbarui tema kontainer segera setelah toast baru ditambahkan
    updateContainerTheme(container);

    // FIX #5: pause on hover — hentikan timer saat mouse di atas toast
    let timerId = null;
    let remaining = duration;
    let startTime = null;

    function startTimer(ms) {
      if (ms <= 0) return;
      startTime = Date.now();
      timerId = setTimeout(() => dismiss(toast, null), ms);
    }

    function pauseTimer() {
      if (timerId === null) return;
      clearTimeout(timerId);
      timerId = null;
      remaining -= Date.now() - startTime;
    }

    function resumeTimer() {
      if (remaining > 0) startTimer(remaining);
    }

    // FIX #3 + #7: close button membatalkan timer dan menjalankan animasi exit
    closeBtn.addEventListener('click', () => dismiss(toast, timerId));

    if (duration > 0) {
      // FIX #5: pause on hover
      toast.addEventListener('mouseenter', pauseTimer);
      toast.addEventListener('mouseleave', resumeTimer);
      // FIX #5: pause saat touch (mobile)
      toast.addEventListener('touchstart', pauseTimer, { passive: true });
      toast.addEventListener('touchend',   resumeTimer, { passive: true });

      startTimer(duration);
    }

    return toast;
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info:    (msg, dur) => show(msg, 'info',    dur),
    show,
    /** Dismiss programmatic (misal saat navigasi) */
    dismissAll: () => {
      const container = document.getElementById('toast-container');
      if (!container) return;
      container.querySelectorAll('.toast').forEach(t => dismiss(t));
    },
  };
})();

// ============================================================
// MODAL
// ============================================================

const Modal = (() => {
  let _activeModal = null;

  /**
   * Buka modal dengan konfigurasi.
   * @param {Object} config
   * @param {string} config.id          - ID unik modal
   * @param {string} config.title
   * @param {string} config.body        - HTML konten body
   * @param {string} [config.size]      - 'sm'|'md'|'lg'|'xl' (default 'md')
   * @param {Array}  [config.actions]   - Array tombol footer
   * @param {boolean} [config.closable] - Bisa tutup dengan klik backdrop (default true)
   */
  function open(config) {
    close(); // tutup modal sebelumnya

    const { id = 'modal-default', title, body, size = 'md', actions = [], closable = true } = config;

    const sizeClass = {
      sm: 'max-w-sm',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    }[size] || 'max-w-lg';

    const actionsHtml = actions.map(a => {
      const btnClass = a.class || 'btn-secondary';
      const btnId    = a.id || '';   // ganti nama 'id' → 'btnId' agar tidak shadow config.id
      const action   = a.action || '';
      return `<button ${btnId ? `id="${btnId}"` : ''} class="btn ${btnClass}" data-action="${action}">${Utils.escapeHtml(a.label)}</button>`;
    }).join('');

    const titleId   = `${id}-title`;
    const modalHtml = `
      <div id="${id}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-box ${sizeClass}">
          <div class="modal-header">
            <h3 id="${titleId}" class="text-base font-semibold text-gray-800">${Utils.escapeHtml(title || '')}</h3>
            ${closable ? `<button class="btn btn-icon btn-secondary text-gray-400" id="${id}-close-btn" aria-label="Tutup">
              <i class="fa-solid fa-xmark"></i></button>` : ''}
          </div>
          <div class="modal-body" id="${id}-body">${body || ''}</div>
          ${actionsHtml ? `<div class="modal-footer">${actionsHtml}</div>` : ''}
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    _activeModal = document.getElementById(id);

    // Event: tutup dengan klik backdrop
    if (closable) {
      _activeModal.addEventListener('click', (e) => {
        if (e.target === _activeModal) close();
      });
      const closeBtn = document.getElementById(`${id}-close-btn`);
      if (closeBtn) closeBtn.addEventListener('click', close);
    }

    // Event: Escape key
    document.addEventListener('keydown', _escHandler);

    // Disable scroll
    document.body.classList.add('overflow-hidden');

    return _activeModal;
  }

  function _escHandler(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    if (_activeModal) {
      _activeModal.remove();
      _activeModal = null;
    }
    document.removeEventListener('keydown', _escHandler);
    document.body.classList.remove('overflow-hidden');
  }

  /**
   * Shorthand: modal konfirmasi.
   * @param {string} title
   * @param {string} message
   * @param {Function} onConfirm
   * @param {Function} [onCancel]
   * @param {boolean} [danger] - Tombol konfirmasi warna merah
   */
  function confirm(title, message, onConfirm, onCancel, danger = false) {
    const btnClass = danger ? 'btn-danger' : 'btn-primary';
    const modal = open({
      id: 'modal-confirm',
      title,
      // FIX #3: white-space: pre-line agar karakter '\n' dalam message di-render sebagai baris baru.
      // Utils.escapeHtml() aman untuk XSS, dan pre-line menghormati newline tanpa mengeksekusi HTML.
      body: `<p class="text-gray-600 text-sm leading-relaxed" style="white-space:pre-line">${Utils.escapeHtml(message)}</p>`,
      size: 'sm',
      actions: [
        { label: 'Batal',     class: 'btn-secondary', action: 'cancel' },
        { label: 'Konfirmasi', class: btnClass,        action: 'confirm', id: 'modal-confirm-btn' },
      ],
    });

    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        close();
        if (action === 'confirm' && onConfirm) onConfirm();
        if (action === 'cancel'  && onCancel)  onCancel();
      });
    });
  }

  /**
   * Shorthand: modal alert (informasi saja, satu tombol).
   */
  function alert(title, message, onClose, type = 'info') {
    const iconMap = {
      success: '<i class="fa-solid fa-circle-check text-4xl text-green-500 mb-3"></i>',
      error:   '<i class="fa-solid fa-circle-xmark text-4xl text-red-500 mb-3"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation text-4xl text-yellow-500 mb-3"></i>',
      info:    '<i class="fa-solid fa-circle-info text-4xl text-blue-500 mb-3"></i>',
    };
    const body = `
      <div class="text-center py-2">
        ${iconMap[type] || iconMap.info}
        <p class="text-gray-600 text-sm leading-relaxed">${Utils.escapeHtml(message)}</p>
      </div>`;
    const modal = open({
      id: 'modal-alert',
      title,
      body,
      size: 'sm',
      actions: [{ label: 'OK', class: 'btn-primary', action: 'ok' }],
    });
    modal.querySelector('[data-action="ok"]').addEventListener('click', () => {
      close();
      if (onClose) onClose();
    });
  }

  /**
   * Update konten body modal yang sedang aktif.
   */
  function updateBody(id, html) {
    const bodyEl = document.getElementById(`${id}-body`);
    if (bodyEl) bodyEl.innerHTML = html;
  }

  return { open, close, confirm, alert, updateBody };
})();

// ============================================================
// SIDEBAR (Admin)
// ============================================================

const Sidebar = (() => {
  /**
   * Role-based nav items.
   * superadmin / admin / ketua_panitia: semua kecuali settings → ketua_panitia
   * panitia: Hasil Pemilihan + Pemilih (readonly)
   * viewer: semua (read-only, dikontrol di level page/backend)
   */
  function getNavItems(role) {
    const all = [
      { href: './dashboard.html',  icon: 'fa-chart-line',     label: 'Dashboard' },
      { href: './election.html',   icon: 'fa-calendar-check', label: 'Manajemen Pemilihan' },
      { href: './candidates.html', icon: 'fa-users',           label: 'Kandidat' },
      { href: './voters.html',     icon: 'fa-id-card',         label: 'Pemilih' },
      { href: './results.html',    icon: 'fa-chart-bar',       label: 'Hasil Pemilihan' },
    ];

    // Panitia: Hasil Pemilihan + Pemilih (hanya lihat)
    if (role === 'panitia') {
      return all.filter(item =>
        item.href === './results.html' || item.href === './voters.html'
      );
    }

    return all;
  }

  /**
   * Bangun HTML nav dari item list.
   */
  function buildNavHtml(role) {
    const items = getNavItems(role);
    // Settings untuk superadmin (akses penuh) dan ketua_panitia (akses terbatas:
    // Field Login Pemilih + Poin Per Kelas). Sinkron dengan Auth.canAccessSettings().
    const showSettings    = (role === 'superadmin' || role === 'ketua_panitia');
    const showUserMgmt    = (role === 'superadmin');

    let html = `<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1">Menu Utama</p>`;
    html += items.map(item =>
      `<a href="${item.href}" class="sidebar-link"><i class="fa-solid ${item.icon}"></i> ${item.label}</a>`
    ).join('');

    html += `<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 pt-4 pb-1">Akun</p>`;
    html += `<a href="./profile.html" class="sidebar-link"><i class="fa-solid fa-circle-user"></i> Profil Saya</a>`;

    if (showUserMgmt) {
      html += `<a href="./users.html" class="sidebar-link"><i class="fa-solid fa-users-gear"></i> Manajemen Pengguna</a>`;
    }

    if (showSettings) {
      html += `<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 pt-4 pb-1">Pengaturan</p>`;
      html += `<a href="./settings.html" class="sidebar-link"><i class="fa-solid fa-gear"></i> Pengaturan Aplikasi</a>`;
    }

    return html;
  }

  /**
   * Inject nav items ke sidebar berdasarkan role.
   * Dipanggil oleh init() sebelum highlightActive().
   */
  function renderNav() {
    const nav = document.querySelector('#sidebar nav');
    if (!nav) return;
    const role = Auth.getAdminRole();
    nav.innerHTML = buildNavHtml(role);
  }

  /**
   * Inisialisasi sidebar admin: render nav, highlight link aktif, toggle mobile.
   */
  function init() {
    renderNav();
    highlightActive();
    initMobileToggle();
    loadAppName();
  }

  function highlightActive() {
    const path = window.location.pathname;
    // Ambil nama file halaman saat ini (mis. "voters.html")
    const currentFile = path.split('/').pop() || '';

    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;

      // Ekstrak nama file dari href (mis. "./voters.html" → "voters.html")
      const hrefFile = href.split('/').pop() || '';

      // Link aktif hanya jika nama file cocok persis
      const active = hrefFile && hrefFile === currentFile;
      if (active) link.classList.add('active');
    });
  }

  function initMobileToggle() {
    const toggleBtn  = document.getElementById('sidebar-toggle');
    const sidebar    = document.getElementById('sidebar');
    const overlay    = document.getElementById('sidebar-overlay');

    if (!toggleBtn || !sidebar) return;

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      if (overlay) overlay.classList.toggle('hidden');
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
      });
    }
  }

  async function loadAppName() {
    // Gunakan cache sessionStorage yang sama dengan loadAppConfig agar
    // tidak ada duplikasi HTTP request ke GAS.
    const CACHE_KEY = 'evoting_config';
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const entry = JSON.parse(raw);
        if (Date.now() < entry.expiresAt) {
          _applySidebarConfig(entry.data);
          return;
        }
      }
    } catch (_) {}

    // Cache tidak ada / kedaluwarsa — fetch langsung
    try {
      const res = await API.config.get();
      if (res.success && res.data) {
        // Tulis ke cache agar halaman lain ikut menikmati
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data: res.data,
            expiresAt: Date.now() + 5 * 60 * 1000,
          }));
        } catch (_) {}
        _applySidebarConfig(res.data);
      }
    } catch (_) {}
  }

  /** Terapkan config ke elemen sidebar & topbar, termasuk logo. */
  function _applySidebarConfig(d) {
    if (!d) return;
    const appName = d.APP_NAME || 'eVoting OSIM';

    const sidebarAppName = document.getElementById('sidebar-app-name');
    if (sidebarAppName) sidebarAppName.textContent = appName;

    const topbarName = document.getElementById('topbar-app-name');
    if (topbarName) topbarName.textContent = appName;

    const schoolName = document.getElementById('sidebar-school-name');
    if (schoolName) schoolName.textContent = d.SCHOOL_NAME || '';

    // Delegasikan ke fungsi shared global — tidak ada duplikasi logika logo.
    _renderSchoolLogo(d.SCHOOL_LOGO_URL, d.SCHOOL_NAME);
  }

  return { init };
})();

// ============================================================
// TOPBAR (Admin) — user info + logout
// ============================================================

const Topbar = (() => {
  function init() {
    const nameEl    = document.getElementById('topbar-user-name');
    const roleEl    = document.getElementById('topbar-user-role');
    const avatarEl  = document.getElementById('topbar-user-avatar');
    const logoutBtn = document.getElementById('topbar-logout-btn');

    const adminData = Auth.getUserData();

    if (nameEl) nameEl.textContent = adminData.name || adminData.username || 'Admin';

    if (roleEl) {
      const roleMap = {
        superadmin:    'Super Admin',
        admin:         'Admin',
        viewer:        'Viewer',
        ketua_panitia: 'Ketua Panitia',
        panitia:       'Panitia',
      };
      roleEl.textContent = roleMap[adminData.role] || adminData.role || '';
    }

    // Render avatar: foto profil jika ada, fallback ke inisial/ikon
    if (avatarEl) {
      _renderAvatar(avatarEl, adminData);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const ok = await Utils.confirm('Apakah Anda yakin ingin keluar?', 'Logout');
        if (ok) {
          Utils.setLoading(logoutBtn, true);
          await Auth.logoutAdmin();
        }
      });
    }
  }

  /**
   * Render avatar ke elemen container via DOM API.
   * Jika ada photoUrl → tampilkan <img> dengan fallback ke inisial.
   * Fallback → inisial nama dengan background warna sesuai role.
   *
   * Menggunakan DOM API (bukan innerHTML + onerror inline) agar:
   * 1. Tidak rusak akibat karakter kutip di nama/class → tidak ada masalah escaping.
   * 2. Event listener terdaftar dengan benar dan tidak di-strip oleh browser.
   */
  function _renderAvatar(container, adminData) {
    const photoUrl = adminData.photoUrl
      ? Utils.buildImgUrl(adminData.photoUrl)
      : null;

    // Bersihkan konten lama
    container.innerHTML = '';

    if (photoUrl) {
      const img     = document.createElement('img');
      img.src       = photoUrl;
      img.alt       = adminData.name || adminData.username || 'Avatar';
      img.className = 'w-full h-full object-cover object-top rounded-full';
      // Fallback ke inisial jika gambar gagal dimuat (URL tidak valid / akses ditolak)
      img.addEventListener('error', function onImgError() {
        img.removeEventListener('error', onImgError);
        container.innerHTML = '';
        container.appendChild(_buildInitialEl(adminData));
      });
      container.appendChild(img);
    } else {
      container.appendChild(_buildInitialEl(adminData));
    }
  }

  /**
   * Buat elemen <span> inisial nama sebagai fallback avatar.
   * Menggunakan DOM API agar tidak ada risiko XSS atau escaping.
   */
  function _buildInitialEl(adminData) {
    const name    = adminData.name || adminData.username || '?';
    const initial = name.charAt(0).toUpperCase();
    const roleColors = {
      superadmin:    'bg-primary-600 text-white',
      admin:         'bg-indigo-500 text-white',
      ketua_panitia: 'bg-emerald-500 text-white',
      panitia:       'bg-amber-500 text-white',
      viewer:        'bg-gray-400 text-white',
    };
    const colorClass = roleColors[adminData.role] || 'bg-gray-400 text-white';
    const span       = document.createElement('span');
    span.className   = `text-xs font-bold ${colorClass} w-full h-full rounded-full flex items-center justify-center`;
    span.textContent = initial;
    return span;
  }

  /**
   * Refresh tampilan avatar di sidebar (dipanggil setelah upload foto baru).
   */
  function refreshAvatar() {
    const avatarEl  = document.getElementById('topbar-user-avatar');
    if (avatarEl) _renderAvatar(avatarEl, Auth.getUserData());
  }

  return { init, refreshAvatar };
})();

// ============================================================
// PAGINATION COMPONENT
// ============================================================

const Pagination = (() => {
  /**
   * Render pagination controls.
   * @param {HTMLElement} container
   * @param {{ page, totalPages, total, pageSize }} meta
   * @param {Function} onPageChange - callback(newPage)
   */
  function render(container, meta, onPageChange) {
    if (!container) return;
    const { page, totalPages, total, pageSize } = meta;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    const start = (page - 1) * pageSize + 1;
    const end   = Math.min(page * pageSize, total);

    let pagesHtml = '';
    const range = getPageRange(page, totalPages);
    range.forEach(p => {
      if (p === '...') {
        pagesHtml += `<span class="px-2 py-1 text-gray-400">...</span>`;
      } else {
        const active = p === page ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200';
        pagesHtml += `<button class="px-3 py-1 rounded text-sm font-medium ${active} transition-colors" data-page="${p}">${p}</button>`;
      }
    });

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p class="text-xs text-gray-500">
          Menampilkan <span class="font-medium">${start}–${end}</span> dari <span class="font-medium">${Utils.formatNumber(total)}</span> data
        </p>
        <div class="flex items-center gap-1">
          <button class="btn btn-sm btn-outline" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
          ${pagesHtml}
          <button class="btn btn-sm btn-outline" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>
      </div>`;

    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (!isNaN(p) && p >= 1 && p <= totalPages) onPageChange(p);
      });
    });
  }

  function getPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  return { render };
})();

// ============================================================
// PAGE LOADER
// ============================================================

const Loader = (() => {
  function show(text = 'Memuat...') {
    let el = document.getElementById('page-loader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'page-loader';
      el.className = 'fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-3';
      el.innerHTML = `
        <div class="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        <p class="text-sm text-gray-600" id="page-loader-text">${Utils.escapeHtml(text)}</p>`;
      document.body.appendChild(el);
    }
  }

  function hide() {
    const el = document.getElementById('page-loader');
    if (el) el.remove();
  }

  function setText(text) {
    const el = document.getElementById('page-loader-text');
    if (el) el.textContent = text;
  }

  return { show, hide, setText };
})();

// ============================================================
// APP CONFIG LOADER — muat config aplikasi saat halaman dibuka
// ============================================================

async function loadAppConfig() {
  // ── Cache: gunakan data yang tersimpan jika masih segar ──
  const CACHE_KEY = 'evoting_config';
  const CACHE_TTL = 5 * 60 * 1000; // 5 menit
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const entry = JSON.parse(raw);
      if (Date.now() < entry.expiresAt) {
        _applyAppConfig(entry.data);
        return entry.data;
      }
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch (_) { /* storage tidak tersedia — lanjut fetch normal */ }

  // ── Fetch dari server ─────────────────────────────────────
  try {
    const res = await API.config.get();
    if (res.success && res.data) {
      const d = res.data;
      // Simpan ke cache
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          data: d,
          expiresAt: Date.now() + CACHE_TTL,
        }));
      } catch (_) { /* storage penuh — abaikan */ }
      _applyAppConfig(d);
      return d;
    }
  } catch (_) {}
  return {};
}
/** Terapkan data config ke seluruh elemen DOM yang relevan */
function _applyAppConfig(d) {
  if (!d) return;
  if (d.APP_NAME) {
    document.title = document.title.replace('eVoting OSIM', d.APP_NAME);
  }
  document.querySelectorAll('[data-app-name]').forEach(el => {
    el.textContent = d.APP_NAME || 'eVoting OSIM';
  });
  document.querySelectorAll('[data-school-name]').forEach(el => {
    el.textContent = d.SCHOOL_NAME || '';
  });
  document.querySelectorAll('[data-app-subtitle]').forEach(el => {
    el.textContent = d.APP_SUBTITLE || 'Pemilihan Ketua OSIM/S';
  });
  _renderSchoolLogo(d.SCHOOL_LOGO_URL, d.SCHOOL_NAME);
  // Terapkan konfigurasi field login voter jika halaman menyediakannya
  if (typeof applyLoginFields === 'function' && typeof parseLoginFields === 'function') {
    applyLoginFields(parseLoginFields(d.VOTER_LOGIN_FIELDS || null));
  }
}

/**
 * Render logo sekolah ke semua kontainer [data-school-logo].
 *
 * Kontainer adalah <div> yang berisi ikon fallback. Fungsi ini:
 *  1. Menyimpan innerHTML ikon asli sebagai fallback SEBELUM diubah (hanya sekali).
 *  2. Jika logoUrl ada: ganti isi dengan <img> (onerror kembalikan ke ikon).
 *  3. Jika logoUrl kosong: restore ke ikon fallback.
 *
 * Aman dipanggil berkali-kali: fallback hanya disimpan sebelum elemen pertama
 * kali dimodifikasi, sehingga <img> tidak pernah tersimpan sebagai fallback.
 */
function _renderSchoolLogo(logoUrl, schoolName) {
  document.querySelectorAll('[data-school-logo]').forEach(el => {
    // Simpan fallback asli SEBELUM innerHTML pertama kali diubah.
    if (!el.dataset.schoolLogoFallback) {
      el.dataset.schoolLogoFallback = el.innerHTML;
    }
    const fallback = el.dataset.schoolLogoFallback;

    if (logoUrl) {
      const safeAlt = (schoolName || 'Logo Sekolah').replace(/"/g, '&quot;');
      el.innerHTML =
        '<img src="' + logoUrl + '"' +
        ' alt="' + safeAlt + '"' +
        ' class="w-full h-full object-contain"' +
        ' onerror="this.parentElement.innerHTML=this.parentElement.dataset.schoolLogoFallback">';
    } else {
      // URL kosong atau dihapus: kembalikan ke ikon
      el.innerHTML = fallback;
    }
  });
}
