/**
 * utils.js — eVoting OSIM/S
 * ============================================================
 * Utility functions: format, DOM helpers, debounce, dll.
 * ============================================================
 */

const Utils = (() => {

  // ── Date & Time ──────────────────────────────────────────

  /**
   * Format ISO string ke tanggal Indonesia.
   * @param {string} iso - ISO date string
   * @param {Object} [options]
   * @returns {string}
   */
  function formatDate(iso, options = {}) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d)) return '-';
      const opts = {
        day:   '2-digit',
        month: 'long',
        year:  'numeric',
        ...options,
      };
      return d.toLocaleDateString('id-ID', opts);
    } catch { return '-'; }
  }

  /**
   * Format ISO string ke tanggal + waktu WIB.
   */
  function formatDateTime(iso) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d)) return '-';
      return d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      });
    } catch { return '-'; }
  }

  /**
   * Format countdown dari sekarang ke target.
   * @param {string} targetIso
   * @returns {{ days, hours, minutes, seconds, expired }}
   */
  function getCountdown(targetIso) {
    const diff = new Date(targetIso) - new Date();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const s = Math.floor(diff / 1000);
    return {
      days:    Math.floor(s / 86400),
      hours:   Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      expired: false,
    };
  }

  /**
   * Format tanggal lahir ke input date (YYYY-MM-DD).
   */
  function toInputDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d)) return '';
      return d.toISOString().split('T')[0];
    } catch { return ''; }
  }

  // ── Number ───────────────────────────────────────────────

  /**
   * Format angka dengan pemisah ribuan.
   */
  function formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return Number(n).toLocaleString('id-ID');
  }

  /**
   * Format persentase.
   */
  function formatPercent(n, decimals = 1) {
    if (n === null || n === undefined) return '0%';
    return Number(n).toFixed(decimals) + '%';
  }

  // ── String ───────────────────────────────────────────────

  /**
   * Truncate string dengan ellipsis.
   */
  function truncate(str, maxLen = 100) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }

  /**
   * Capitalize first letter.
   */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Escape HTML untuk mencegah XSS saat menggunakan innerHTML.
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // ── DOM ──────────────────────────────────────────────────

  /**
   * Query selector shorthand.
   */
  function $(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  /**
   * Set loading state pada elemen (btn, form).
   */
  function setLoading(el, loading, loadingText = '') {
    if (!el) return;
    if (loading) {
      el.disabled = true;
      el._originalText = el.innerHTML;
      if (loadingText) {
        el.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>${escapeHtml(loadingText)}`;
      } else {
        el.classList.add('btn-loading');
      }
    } else {
      el.disabled = false;
      if (el._originalText !== undefined) {
        el.innerHTML = el._originalText;
        delete el._originalText;
      }
      el.classList.remove('btn-loading');
    }
  }

  /**
   * Show/hide elemen dengan display.
   */
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }
  function toggle(el, condition) {
    if (condition) show(el); else hide(el);
  }

  /**
   * Set text content dengan XSS-safe escaping.
   */
  function setText(el, text) {
    if (el) el.textContent = text || '';
  }

  /**
   * Set HTML content (hanya untuk konten yang sudah di-escape/trusted).
   */
  function setHtml(el, html) {
    if (el) el.innerHTML = html || '';
  }

  /**
   * Scroll halaman ke elemen (smooth).
   */
  function scrollTo(el) {
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Form ─────────────────────────────────────────────────

  /**
   * Ambil semua nilai form sebagai object.
   * @param {HTMLFormElement} form
   * @returns {Object}
   */
  function getFormData(form) {
    const data = {};
    const fd = new FormData(form);
    fd.forEach((value, key) => { data[key] = value; });
    return data;
  }

  /**
   * Isi form dengan data object.
   */
  function fillForm(form, data) {
    Object.keys(data).forEach(key => {
      const el = form.elements[key];
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!data[key];
      } else {
        el.value = data[key] !== null && data[key] !== undefined ? data[key] : '';
      }
    });
  }

  /**
   * Reset form + hapus error messages.
   */
  function resetForm(form) {
    if (!form) return;
    form.reset();
    $$('.form-error-msg', form).forEach(el => el.textContent = '');
    $$('.form-input-error', form).forEach(el => el.classList.remove('form-input-error'));
  }

  /**
   * Tampilkan error pada field form.
   */
  function showFieldError(fieldId, message) {
    const input  = document.getElementById(fieldId);
    const errEl  = document.getElementById(fieldId + '-error');
    if (input) input.classList.add('form-input-error');
    if (errEl) errEl.textContent = message;
  }

  /**
   * Hapus error pada field form.
   */
  function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (input) input.classList.remove('form-input-error');
    if (errEl) errEl.textContent = '';
  }

  // ── File / Image ─────────────────────────────────────────

  /**
   * Baca file sebagai base64 string.
   * @param {File} file
   * @returns {Promise<string>} base64 string (tanpa header data:...)
   */
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Hapus prefix "data:image/jpeg;base64,"
        const base64 = e.target.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Validasi file gambar sebelum upload.
   * @param {File} file
   * @param {number} maxMB
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateImageFile(file, maxMB = 5) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return { valid: false, error: 'Format file tidak didukung. Gunakan JPG, PNG, atau WebP.' };
    }
    if (file.size > maxMB * 1024 * 1024) {
      return { valid: false, error: `Ukuran file terlalu besar. Maksimal ${maxMB}MB.` };
    }
    return { valid: true };
  }

  /**
   * Konversi URL Google Drive ke format direct-image yang dapat di-embed.
   *
   * URL /uc?export=view diblokir browser modern karena Google mengembalikan
   * halaman interstitial bukan gambar langsung.
   * Format lh3.googleusercontent.com/d/FILE_ID adalah direct image URL
   * yang bekerja untuk file yang di-share "Anyone with the link".
   *
   * @param {string} url - URL foto dari database (berbagai format Drive)
   * @returns {string} URL yang dapat dipakai sebagai src= pada tag <img>
   */
  function buildDriveImgUrl(url) {
    if (!url) return '';
    // Sudah format lh3 — tidak perlu konversi
    if (url.includes('lh3.googleusercontent.com')) return url;
    // Bukan URL Drive sama sekali (misal: URL eksternal biasa) — kembalikan apa adanya
    if (!url.includes('drive.google.com') && !url.includes('googleusercontent.com')) return url;
    // Ekstrak File ID dari berbagai format URL Drive
    let fileId = null;
    const matchId   = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId) fileId = matchId[1];
    if (!fileId) {
      const matchPath = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (matchPath) fileId = matchPath[1];
    }
    if (!fileId) return url; // tidak bisa di-parse, kembalikan apa adanya
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // ── Debounce ─────────────────────────────────────────────

  function debounce(fn, delay = 300) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ── URL / Navigation ─────────────────────────────────────

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // ── Status Badge ─────────────────────────────────────────

  const STATUS_BADGE = {
    draft:    { class: 'badge-gray',    label: 'Draft' },
    upcoming: { class: 'badge-info',    label: 'Akan Dimulai' },
    active:   { class: 'badge-success', label: 'Berlangsung' },
    ended:    { class: 'badge-danger',  label: 'Selesai' },
  };

  function statusBadgeHtml(status) {
    const s = STATUS_BADGE[status] || { class: 'badge-gray', label: status };
    return `<span class="badge ${s.class}">${escapeHtml(s.label)}</span>`;
  }

  const ROLE_BADGE = {
    superadmin: { class: 'badge-purple', label: 'Super Admin' },
    admin:      { class: 'badge-info',   label: 'Admin' },
    viewer:     { class: 'badge-gray',   label: 'Viewer' },
  };

  function roleBadgeHtml(role) {
    const r = ROLE_BADGE[role] || { class: 'badge-gray', label: role };
    return `<span class="badge ${r.class}">${escapeHtml(r.label)}</span>`;
  }

  // ── CSV Parser ───────────────────────────────────────────

  /**
   * Parse CSV string ke array of objects.
   * Baris pertama dianggap header.
   * @param {string} csvText
   * @returns {Array<Object>}
   */
  function parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (values[idx] || '').trim(); });
      rows.push(obj);
    }
    return rows;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        // Sesuai RFC 4180: dua tanda kutip berturutan ("") di dalam
        // field yang di-quote merepresentasikan satu tanda kutip literal.
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // lewati kutip kedua
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current);
    return result;
  }

  // ── Skeleton ─────────────────────────────────────────────

  /**
   * Generate skeleton row HTML untuk tabel.
   */
  function skeletonTableRows(cols, count = 5) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += '<tr>';
      for (let j = 0; j < cols; j++) {
        html += `<td class="px-4 py-3"><div class="skeleton h-4 w-full rounded"></div></td>`;
      }
      html += '</tr>';
    }
    return html;
  }

  /**
   * Generate skeleton card HTML.
   */
  function skeletonCard() {
    return `
      <div class="card p-5 animate-pulse">
        <div class="skeleton h-4 w-3/4 rounded mb-3"></div>
        <div class="skeleton h-8 w-1/2 rounded mb-2"></div>
        <div class="skeleton h-3 w-full rounded"></div>
      </div>`;
  }

  // ── Confirm ──────────────────────────────────────────────

  /**
   * Promise-based konfirmasi menggunakan modal bawaan (bukan browser confirm).
   * Menggunakan Modal dari components.js.
   */
  function confirm(message, title = 'Konfirmasi', danger = false) {
    return new Promise((resolve) => {
      Modal.confirm(title, message, () => resolve(true), () => resolve(false), danger);
    });
  }

  // ── Export CSV ───────────────────────────────────────────

  function exportCSV(data, filename) {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(h => {
        const v = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    // Anchor harus di-append ke DOM agar download bekerja di semua browser
    // (terutama Firefox yang tidak meng-handle click() pada elemen yang tidak terpasang).
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    formatDate, formatDateTime, getCountdown, toInputDate,
    formatNumber, formatPercent,
    truncate, capitalize, escapeHtml,
    $, $$, setLoading, show, hide, toggle, setText, setHtml, scrollTo,
    getFormData, fillForm, resetForm, showFieldError, clearFieldError,
    readFileAsBase64, validateImageFile, buildDriveImgUrl,
    debounce, getQueryParam,
    statusBadgeHtml, roleBadgeHtml,
    parseCSV, skeletonTableRows, skeletonCard,
    confirm, exportCSV,
  };
})();
