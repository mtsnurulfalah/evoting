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

  // Timeout default (ms).
  // GAS cold-start bisa 15–30 detik, ditambah eksekusi script dan akses Spreadsheet.
  // 60 detik memberi ruang cukup untuk kondisi cold-start terburuk.
  const DEFAULT_TIMEOUT_MS = 60000;

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
      // Bedakan timeout, CORS/network, dan error lainnya agar pesan lebih informatif
      const isTimeout = err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch');

      console.error(`[API] ${isTimeout ? 'Timeout' : 'Error'} on action "${action}":`, err);
      return {
        success: false,
        message: isTimeout
          ? 'Server membutuhkan waktu terlalu lama untuk merespons. Silakan coba lagi.'
          : isNetworkError
            ? 'Tidak dapat terhubung ke server. Periksa koneksi internet, lalu coba lagi.'
            : 'Gagal menghubungi server. Silakan coba lagi.',
        errorCode: isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
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

  // ── Cloudinary direct upload ──────────────────────────────
  //
  // Alur (menggantikan proxy upload lewat GAS):
  //   1. Minta signature dari GAS  → request kecil, selesai <5 detik
  //   2. Upload file langsung ke Cloudinary dari browser → tidak lewat GAS
  //   3. Kirim secure_url ke GAS saat simpan data (bukan file binary)
  //
  // Keuntungan:
  //   • Tidak ada lagi timeout/koneksi terputus akibat GAS menjadi proxy binary
  //   • Upload progress bisa ditampilkan (XHR-based)
  //   • GAS hanya melakukan komputasi ringan (sign + simpan URL)
  //   • Upload bisa di-cancel saat modal ditutup

  /**
   * Hitung timeout upload adaptif berdasarkan ukuran file dan estimasi kecepatan.
   * Asumsi minimum 50 KB/s (koneksi lambat), dengan floor 30 detik dan ceiling 3 menit.
   *
   * @param {number} fileSize - ukuran file dalam bytes
   * @returns {number} timeout dalam milidetik
   */
  function _calcUploadTimeout(fileSize) {
    const MIN_MS  = 30_000;   // minimal 30 detik
    const MAX_MS  = 180_000;  // maksimal 3 menit
    const SPEED   = 50_000;   // estimasi 50 KB/s (jaringan lambat)
    const estimated = Math.ceil((fileSize / SPEED) * 1000) + 15_000; // + 15 detik buffer
    return Math.min(Math.max(estimated, MIN_MS), MAX_MS);
  }

  /**
   * Upload file langsung ke Cloudinary menggunakan signature dari GAS.
   * Mendukung abort via AbortSignal untuk cancel saat modal ditutup.
   *
   * @param {File}     file           - File object dari <input type="file">
   * @param {Object}   sigData        - Data signature dari GAS
   *   (timestamp, signature, apiKey, cloudName, folder, transformation?)
   * @param {Function} [onProgress]   - Callback progress(0–100)
   * @param {AbortSignal} [abortSignal] - Signal untuk membatalkan upload
   * @returns {Promise<{url: string, publicId: string}>}
   */
  async function uploadToCloudinaryDirect(file, sigData, onProgress, abortSignal) {
    const endpoint = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('file',      file);
    formData.append('folder',    sigData.folder);
    formData.append('timestamp', sigData.timestamp);
    formData.append('api_key',   sigData.apiKey);
    formData.append('signature', sigData.signature);

    // Sertakan eager transformation jika backend memberikannya (auto resize + kompresi)
    if (sigData.eager) {
      formData.append('eager', sigData.eager);
    }

    // Timeout adaptif: makin besar file, makin panjang timeout
    const timeoutMs = _calcUploadTimeout(file.size);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // ── Tangani abort dari luar (misal modal ditutup) ──
      if (abortSignal) {
        if (abortSignal.aborted) {
          reject(new Error('Upload dibatalkan.'));
          return;
        }
        abortSignal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      if (onProgress && xhr.upload) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ url: data.secure_url, publicId: data.public_id });
          } catch {
            reject(new Error('Respons Cloudinary tidak valid.'));
          }
        } else {
          let errMsg = `Cloudinary error ${xhr.status}`;
          try {
            const errData = JSON.parse(xhr.responseText);
            if (errData.error?.message) errMsg = errData.error.message;
          } catch (_) {}
          reject(new Error(errMsg));
        }
      });

      xhr.addEventListener('error',   () => reject(new Error('Koneksi ke Cloudinary gagal. Periksa jaringan Anda.')));
      xhr.addEventListener('timeout', () => reject(new Error(`Upload timeout (>${Math.round(timeoutMs / 1000)}s). File mungkin terlalu besar atau jaringan lambat.`)));
      xhr.addEventListener('abort',   () => reject(new Error('Upload dibatalkan.')));

      xhr.open('POST', endpoint);
      xhr.timeout = timeoutMs;
      xhr.send(formData);
    });
  }

  /**
   * Upload foto kandidat ke Google Drive via GAS.
   * Frontend mengirim file sebagai base64, GAS menyimpan ke Drive dan
   * mengembalikan thumbnail URL yang bisa langsung dipakai sebagai src=.
   *
   * Alur:
   *   1. Frontend baca file → compress → base64
   *   2. Kirim ke GAS action `candidate.uploadPhotoDrive`
   *   3. GAS simpan ke Drive, set permission Anyone can view
   *   4. GAS return { fileId, url } — url = lh3.googleusercontent.com/d/{id}
   *   5. Frontend simpan url ke hidden input, kirim saat form submit
   *
   * @param {string} base64    - Base64 string (tanpa prefix data:...)
   * @param {string} mimeType  - MIME type: image/jpeg, image/png, image/webp
   * @param {string} filename  - Nama file asli
   * @param {string} [oldUrl]  - URL foto lama (untuk dihapus dari Drive)
   * @returns {Promise<Object>} Response GAS: { success, data: { fileId, url } }
   */
  function uploadPhotoDrive(base64, mimeType, filename, oldUrl) {
    return request('candidate.uploadPhotoDrive', {
      base64,
      mimeType,
      filename,
      oldUrl: oldUrl || '',
    }, { timeoutMs: 120000 }); // 2 menit — DriveApp bisa lambat
  }

  const candidate = {
    /** Kandidat publik dari election upcoming/active — tanpa token */
    getPublic: (electionId) => request('candidate.getPublic', electionId ? { electionId } : {}, { useToken: false }),
    getByElection: (electionId) => request('candidate.getByElection', { electionId }),
    getAll: (electionId) => request('candidate.getAll', { electionId }),
    create: (data) => request('candidate.create', data),
    update: (data) => request('candidate.update', data),
    delete: (id) => request('candidate.delete', { id }),
    reorder: (orders) => request('candidate.reorder', { orders }),
    /** Upload foto ke Google Drive via GAS (pengganti Cloudinary) */
    uploadPhotoDrive: (base64, mimeType, filename, oldUrl) =>
      uploadPhotoDrive(base64, mimeType, filename, oldUrl),
  };

  // ── Voter endpoints ──────────────────────────────────────

  const voter = {
    getAll: (params) => request('voter.getAll', params || {}),
    getById: (id) => request('voter.getById', { id }),
    getClasses: (electionId) => request('voter.getClasses', electionId ? { electionId } : {}),
    create: (data) => request('voter.create', data),
    update: (data) => request('voter.update', data),
    delete: (id) => request('voter.delete', { id }),
    importBulk: (electionId, voters, skipDuplicates = true) =>
      request('voter.importBulk', { electionId, voters, skipDuplicates }),
    resetVoteStatus: (payload) => request('voter.resetVoteStatus', payload),
    resetPin: (id, pin) => request('voter.resetPin', { id, pin }),
    /**
     * Cari data voter dari semua election berdasarkan NISN.
     * Digunakan untuk preview sebelum assign.
     * @param {string} nisn
     */
    lookupByNisn: (nisn) => request('voter.lookupByNisn', { nisn }),
    /**
     * Assign voter yang sudah ada ke satu atau lebih election baru.
     * @param {string}   nisn
     * @param {string[]} targetElectionIds
     */
    assignToElection: (nisn, targetElectionIds) =>
      request('voter.assignToElection', { nisn, targetElectionIds }),
    /**
     * Sinkronisasi PIN semua voter lintas election berdasarkan NISN.
     * Voter di election sumber digunakan sebagai acuan PIN.
     * Semua entri NISN yang sama di election lain akan disamakan PIN-nya.
     * @param {string} sourceElectionId - ID election sumber PIN
     */
    syncPins: (sourceElectionId) =>
      request('voter.syncPins', { sourceElectionId }),
  };

  // ── Voting endpoints ─────────────────────────────────────

  const vote = {
    /**
     * Submit suara untuk satu election.
     * @param {string} candidateId
     * @param {string} [electionId] - Wajib untuk sesi multi-election
     */
    submit: (candidateId, electionId) => {
      const payload = { candidateId };
      if (electionId) payload.electionId = electionId;
      return request('vote.submit', payload);
    },
    /** Status voting untuk single election (backward-compat) */
    checkStatus: () => request('vote.checkStatus'),
    /**
     * Status voting untuk semua elections dalam sesi (multi-election).
     * Response: { elections: [{electionId, hasVoted, votedAt}], allVoted }
     */
    getMultiStatus: () => request('vote.getMultiStatus'),
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
    changePassword:   (data)   => request('admin.changePassword', data),
    updateProfile:    (data)   => request('admin.updateProfile', data),
    /** Minta signature Cloudinary untuk foto profil (request ringan ke GAS) */
    getUploadSignature: (oldUrl = '') => request('admin.getUploadSignature', { oldUrl }),
    /** Simpan URL foto yang sudah diupload langsung ke Cloudinary */
    savePhotoUrl:     (url, oldUrl = '') => request('admin.savePhotoUrl', { url, oldUrl }),
    /** @deprecated Gunakan getUploadSignature + uploadToCloudinaryDirect */
    uploadPhoto:      (data)   => request('admin.uploadProfilePhoto', data),
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

  return { auth, election, candidate, voter, vote, result, config, logs, adminProfile, adminUsers, accessPin, isPending, uploadToCloudinaryDirect, uploadPhotoDrive };
})();
