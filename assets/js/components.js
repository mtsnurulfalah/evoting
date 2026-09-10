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
  let _container = null;

  function getContainer() {
    if (!_container) {
      _container = document.getElementById('toast-container');
      if (!_container) {
        _container = document.createElement('div');
        _container.id = 'toast-container';
        document.body.appendChild(_container);
      }
    }
    return _container;
  }

  const ICONS = {
    success: '<i class="fa-solid fa-circle-check text-green-500 text-lg flex-shrink-0"></i>',
    error:   '<i class="fa-solid fa-circle-xmark text-red-500 text-lg flex-shrink-0"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation text-yellow-500 text-lg flex-shrink-0"></i>',
    info:    '<i class="fa-solid fa-circle-info text-blue-500 text-lg flex-shrink-0"></i>',
  };

  /**
   * Tampilkan toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration - ms (0 = permanen)
   */
  function show(message, type = 'info', duration = 4000) {
    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      ${ICONS[type] || ICONS.info}
      <div class="flex-1 text-sm leading-snug">${Utils.escapeHtml(message)}</div>
      <button onclick="this.closest('.toast').remove()" class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
        <i class="fa-solid fa-xmark"></i>
      </button>`;

    container.appendChild(toast);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info:    (msg, dur) => show(msg, 'info', dur),
    show,
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
      const cls = a.class || 'btn-secondary';
      const id  = a.id || '';
      return `<button id="${id}" class="btn ${cls}" data-action="${a.action || ''}">${Utils.escapeHtml(a.label)}</button>`;
    }).join('');

    const modalHtml = `
      <div id="${id}" class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal-box ${sizeClass}">
          <div class="modal-header">
            <h3 class="text-base font-semibold text-gray-800">${Utils.escapeHtml(title || '')}</h3>
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
      body: `<p class="text-gray-600 text-sm leading-relaxed">${Utils.escapeHtml(message)}</p>`,
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
   * Inisialisasi sidebar admin: highlight link aktif, toggle mobile.
   */
  function init() {
    highlightActive();
    initMobileToggle();
    loadAppName();
  }

  function highlightActive() {
    const path = window.location.pathname;
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      // Normalisasi path untuk perbandingan
      const linkPath = href.replace(/^\.\.\//, '/admin/').replace(/^\.\//, '/admin/');
      const active =
        path === linkPath ||
        path.endsWith(href) ||
        (href !== '/admin/dashboard.html' && path.includes(href.replace('.html', '')));
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
    const el = document.getElementById('sidebar-app-name');
    if (!el) return;
    try {
      const res = await API.config.get();
      if (res.success && res.data) {
        el.textContent = res.data.APP_NAME || 'eVoting OSIM';
        // Set juga di topbar jika ada
        const topbarName = document.getElementById('topbar-app-name');
        if (topbarName) topbarName.textContent = res.data.APP_NAME || 'eVoting OSIM';
        const schoolName = document.getElementById('sidebar-school-name');
        if (schoolName) schoolName.textContent = res.data.SCHOOL_NAME || '';
      }
    } catch (_) {}
  }

  return { init };
})();

// ============================================================
// TOPBAR (Admin) — user info + logout
// ============================================================

const Topbar = (() => {
  function init() {
    const nameEl = document.getElementById('topbar-user-name');
    const roleEl = document.getElementById('topbar-user-role');
    const logoutBtn = document.getElementById('topbar-logout-btn');

    const adminData = Auth.getUserData();
    if (nameEl) nameEl.textContent = adminData.name || adminData.username || 'Admin';
    if (roleEl) {
      const roleMap = { superadmin: 'Super Admin', admin: 'Admin', viewer: 'Viewer' };
      roleEl.textContent = roleMap[adminData.role] || adminData.role || '';
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

  return { init };
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
  try {
    const res = await API.config.get();
    if (res.success && res.data) {
      const d = res.data;
      // Set title halaman
      if (d.APP_NAME) {
        document.title = document.title.replace('eVoting OSIM', d.APP_NAME);
      }
      // Set meta/brand elements
      document.querySelectorAll('[data-app-name]').forEach(el => {
        el.textContent = d.APP_NAME || 'eVoting OSIM';
      });
      document.querySelectorAll('[data-school-name]').forEach(el => {
        el.textContent = d.SCHOOL_NAME || '';
      });
      document.querySelectorAll('[data-app-subtitle]').forEach(el => {
        el.textContent = d.APP_SUBTITLE || 'Pemilihan Ketua OSIM/S';
      });
      document.querySelectorAll('[data-school-logo]').forEach(el => {
        if (d.SCHOOL_LOGO_URL) el.src = d.SCHOOL_LOGO_URL;
      });
      return d;
    }
  } catch (_) {}
  return {};
}
