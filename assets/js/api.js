/**
 * api.js — eVoting OSIM/S
 * ============================================================
 * Centralized API client untuk komunikasi dengan GAS backend.
 * Semua request ke GAS melewati fungsi ini.
 * ============================================================
 */

const API = (() => {
  // ── GAS URL ─────────────────────────────────────────────
  // Diambil dari window.GAS_URL yang di-inject via config.js
  // (file yang di-generate saat build atau diset manual).
  function getBaseUrl() {
    if (window.GAS_URL && window.GAS_URL !== 'YOUR_GAS_URL_HERE') {
      return window.GAS_URL;
    }
    // Fallback: cek localStorage (untuk dev)
    const stored = localStorage.getItem('_gas_url');
    if (stored) return stored;
    console.error('[API] GAS_URL belum dikonfigurasi. Set window.GAS_URL di config.js');
    return null;
  }

  // ── Request state ────────────────────────────────────────
  let _pendingRequests = 0;

  // Timeout default (ms). GAS cold-start bisa 15–30 detik, jadi pakai 45 detik.
  const DEFAULT_TIMEOUT_MS = 45000;

  // ── Core fetch ───────────────────────────────────────────
  /**
   * Kirim request ke GAS Web App.
   * GAS hanya mendukung GET dan POST.
   * Semua operasi yang butuh body dikirim via POST.
   *
   * @param {string} action  - Nama action (ex: 'voter.login')
   * @param {Object} payload - Data payload
   * @param {Object} options
   * @param {boolean} [options.useToken=true]    - Sertakan token dari storage
   * @param {boolean} [options.useGet=false]     - Gunakan GET (hanya untuk read sederhana)
   * @param {number}  [options.timeoutMs]        - Override timeout (ms), default 45000
   * @returns {Promise<Object>} Parsed JSON response dari GAS
   */
  async function request(action, payload = {}, options = {}) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      return { success: false, message: 'Konfigurasi API tidak ditemukan.', errorCode: 'CONFIG_ERROR' };
    }

    const { useToken = true, useGet = false } = options;
    const timeoutMs = (typeof options.timeoutMs === 'number') ? options.timeoutMs : DEFAULT_TIMEOUT_MS;

    // Ambil token dari storage
    // _customToken di options mengoverride token dari storage (digunakan oleh validateToken)
    let token = '';
    if (options._customToken) {
      token = options._customToken;
    } else if (useToken) {
      token = Auth.getToken() || '';
    }

    const body = {
      action,
      token,
      payload,
    };

    // ── Timeout via AbortController ──────────────────────
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

    _pendingRequests++;

    try {
      let response;

      if (useGet) {
        // GET: kirim action + token via query string (tanpa body)
        const params = new URLSearchParams({ action, token });
        response = await fetch(`${baseUrl}?${params.toString()}`, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
        });
      } else {
        // POST: kirim sebagai JSON body
        // GAS mengharuskan no-cors mode jika tidak ada proxy,
        // tapi kita menggunakan mode 'cors' karena GAS Web App
        // mendukung CORS untuk request JSON (deployed sebagai Anyone).
        response = await fetch(baseUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain', // GAS membaca text/plain lebih reliabel
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (err) {
      // Bedakan timeout dari error jaringan biasa agar pesan lebih informatif
      const isTimeout = err.name === 'AbortError';
      console.error(`[API] ${isTimeout ? 'Timeout' : 'Error'} on action "${action}":`, err);
      return {
        success: false,
        message: isTimeout
          ? 'Permintaan membutuhkan waktu terlalu lama. Silakan coba lagi.'
          : 'Gagal menghubungi server. Periksa koneksi internet Anda.',
        errorCode: isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
        _originalError: err.message,
      };
    } finally {
      clearTimeout(timeoutId);
      _pendingRequests--;
    }
  }

  // ── Auth endpoints ───────────────────────────────────────

  const auth = {
    voterLogin: (payload) => request('voter.login', payload, { useToken: false }),
    voterLogout: () => request('voter.logout', {}, { useToken: true }),
    adminLogin: (payload) => request('admin.login', payload, { useToken: false }),
    adminLogout: () => request('admin.logout', {}, { useToken: true }),
    validateToken: (token) => request('auth.validate', {}, { useToken: false, _customToken: token }),
  };

  // ── Election endpoints ───────────────────────────────────

  const election = {
    getActive: () => request('election.getActive', {}, { useToken: false, useGet: true }),
    getAll: () => request('election.getAll'),
    getById: (id) => request('election.getById', { id }),
    create: (data) => request('election.create', data),
    update: (data) => request('election.update', data),
    delete: (id) => request('election.delete', { id }),
    setStatus: (id, status, isActive) => request('election.setStatus', { id, status, isActive }),
  };

  // ── Candidate endpoints ──────────────────────────────────

  const candidate = {
    getByElection: (electionId) => request('candidate.getByElection', { electionId }),
    getAll: (electionId) => request('candidate.getAll', { electionId }),
    create: (data) => request('candidate.create', data),
    update: (data) => request('candidate.update', data),
    delete: (id) => request('candidate.delete', { id }),
    reorder: (orders) => request('candidate.reorder', { orders }),
    uploadPhoto: (data) => request('candidate.uploadPhoto', data),
  };

  // ── Voter endpoints ──────────────────────────────────────

  const voter = {
    getAll: (params) => request('voter.getAll', params || {}),
    getById: (id) => request('voter.getById', { id }),
    create: (data) => request('voter.create', data),
    update: (data) => request('voter.update', data),
    delete: (id) => request('voter.delete', { id }),
    importBulk: (electionId, voters, skipDuplicates = true) =>
      request('voter.importBulk', { electionId, voters, skipDuplicates }),
    resetVoteStatus: (payload) => request('voter.resetVoteStatus', payload),
    resetPin: (id, pin) => request('voter.resetPin', { id, pin }),
  };

  // ── Voting endpoints ─────────────────────────────────────

  const vote = {
    submit: (candidateId) => request('vote.submit', { candidateId }),
    checkStatus: () => request('vote.checkStatus'),
  };

  // ── Result endpoints ─────────────────────────────────────

  const result = {
    getAdmin: (electionId) => request('result.getAdmin', { electionId }),
    getPublic: (electionId) => request('result.getPublic', { electionId }, { useToken: false }),
    getDashboard: (electionId) => request('result.getDashboard', { electionId }),
  };

  // ── Config endpoints ─────────────────────────────────────

  const config = {
    get: () => request('config.get', {}, { useToken: false, useGet: true }),
    getAll: () => request('config.getAll'),
    update: (data) => request('config.update', data),
  };

  // ── Voter Access PIN ─────────────────────────────────────

  const accessPin = {
    /** Generate PIN baru secara manual (superadmin/admin/ketua_panitia) */
    generate: () => request('accessPin.generate', {}),
    /** Ambil PIN aktif + sisa waktu (superadmin/admin/ketua_panitia) */
    get: () => request('accessPin.get', {}),
    /** Verifikasi PIN yang dimasukkan panitia */
    verify: (pin) => request('accessPin.verify', { pin }),
  };

  // ── Logs ─────────────────────────────────────────────────

  const logs = {
    getRecent: (limit = 100) => request('logs.getRecent', { limit }),
  };

  // ── Admin Profile ─────────────────────────────────────────

  const adminProfile = {
    changePassword: (data) => request('admin.changePassword', data),
    updateProfile:  (data) => request('admin.updateProfile', data),
    uploadPhoto:    (data) => request('admin.uploadProfilePhoto', data),
  };

  // ── Admin Users (User Management) ────────────────────────

  const adminUsers = {
    getAll:         (params) => request('adminUser.getAll', params || {}),
    getById:        (id)     => request('adminUser.getById', { id }),
    create:         (data)   => request('adminUser.create', data),
    update:         (data)   => request('adminUser.update', data),
    delete:         (id)     => request('adminUser.delete', { id }),
    resetPassword:  (data)   => request('adminUser.resetPassword', data),
  };

  // ── Utility ──────────────────────────────────────────────

  /** Cek apakah ada request yang sedang pending */
  function isPending() {
    return _pendingRequests > 0;
  }

  return { auth, election, candidate, voter, vote, result, config, logs, adminProfile, adminUsers, accessPin, isPending };
})();
