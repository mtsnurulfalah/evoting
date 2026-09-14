/**
 * auth.js — eVoting OSIM/S
 * ============================================================
 * Auth helper: manajemen token di sessionStorage,
 * guard halaman, redirect logic.
 * ============================================================
 */

const Auth = (() => {
  const KEY_TOKEN      = 'ev_token';
  const KEY_USER_TYPE  = 'ev_user_type';
  const KEY_USER_DATA  = 'ev_user_data';
  const KEY_EXPIRES_AT = 'ev_expires_at';
  const KEY_ELECTION   = 'ev_election';
  // Multi-election: array semua elections yang voter terdaftar dan aktif
  const KEY_ELECTIONS  = 'ev_elections';

  // ── Token Storage ────────────────────────────────────────

  function setSession(token, userType, userData, expiresAt, electionData, electionsData) {
    sessionStorage.setItem(KEY_TOKEN,      token);
    sessionStorage.setItem(KEY_USER_TYPE,  userType);
    sessionStorage.setItem(KEY_USER_DATA,  JSON.stringify(userData || {}));
    sessionStorage.setItem(KEY_EXPIRES_AT, expiresAt || '');
    if (electionData) {
      sessionStorage.setItem(KEY_ELECTION, JSON.stringify(electionData));
    }
    // Simpan array elections untuk multi-election support
    if (electionsData && Array.isArray(electionsData)) {
      sessionStorage.setItem(KEY_ELECTIONS, JSON.stringify(electionsData));
    } else if (electionData) {
      // Fallback: bungkus single election ke dalam array agar API konsisten
      sessionStorage.setItem(KEY_ELECTIONS, JSON.stringify([electionData]));
    }
  }

  function clearSession() {
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_USER_TYPE);
    sessionStorage.removeItem(KEY_USER_DATA);
    sessionStorage.removeItem(KEY_EXPIRES_AT);
    sessionStorage.removeItem(KEY_ELECTION);
    sessionStorage.removeItem(KEY_ELECTIONS);
  }

  function getToken() {
    return sessionStorage.getItem(KEY_TOKEN) || '';
  }

  function getUserType() {
    return sessionStorage.getItem(KEY_USER_TYPE) || '';
  }

  function getUserData() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY_USER_DATA) || '{}');
    } catch { return {}; }
  }

  /** Ambil data election pertama (backward-compat untuk single election) */
  function getElectionData() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY_ELECTION) || 'null');
    } catch { return null; }
  }

  /**
   * Ambil array semua elections dalam sesi ini.
   * Selalu return array (minimal 1 item, atau [] jika tidak ada).
   * @returns {Array<{id, title, description, startDate, endDate, voterId, hasVoted, votedAt}>}
   */
  function getElectionsData() {
    try {
      const raw = sessionStorage.getItem(KEY_ELECTIONS);
      if (!raw) {
        // Fallback: bungkus data election tunggal
        const single = getElectionData();
        return single ? [single] : [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  /**
   * Update status hasVoted untuk election tertentu di session storage.
   * Dipanggil setelah vote berhasil di satu election.
   * @param {string} electionId
   */
  function markElectionVoted(electionId) {
    const elections = getElectionsData();
    const updated = elections.map(e => {
      // Cocokkan dengan field 'id' ATAU 'electionId' — kedua format mungkin ada
      // tergantung dari mana data elections berasal (login response vs fallback).
      const eid = String(e.id || e.electionId || '');
      if (eid === String(electionId)) {
        return { ...e, hasVoted: true, votedAt: new Date().toISOString() };
      }
      return e;
    });
    sessionStorage.setItem(KEY_ELECTIONS, JSON.stringify(updated));
    // Jika semua sudah vote, update user data hasVoted juga
    if (updated.every(e => !!e.hasVoted)) markAsVoted();
  }

  /**
   * Cek apakah voter sudah vote di SEMUA elections dalam sesi.
   * @returns {boolean}
   */
  function hasVotedAll() {
    const elections = getElectionsData();
    if (elections.length === 0) {
      // Fallback ke data user
      const voter = getUserData();
      return !!voter.hasVoted;
    }
    return elections.every(e => !!e.hasVoted);
  }

  /**
   * Cek apakah sesi ini multi-election (lebih dari 1 election).
   * @returns {boolean}
   */
  function isMultiElection() {
    return getElectionsData().length > 1;
  }

  function isExpired() {
    const expiresAt = sessionStorage.getItem(KEY_EXPIRES_AT);
    if (!expiresAt) return true;
    return new Date() >= new Date(expiresAt);
  }

  function isLoggedIn() {
    return !!getToken() && !isExpired();
  }

  function isVoter() {
    return isLoggedIn() && getUserType() === 'voter';
  }

  function isAdmin() {
    return isLoggedIn() && getUserType() === 'admin';
  }

  function getAdminRole() {
    const data = getUserData();
    return data.role || '';
  }

  function isSuperAdmin() {
    return isAdmin() && getAdminRole() === 'superadmin';
  }

  function isKetuaPanitia() {
    return isAdmin() && getAdminRole() === 'ketua_panitia';
  }

  function isPanitia() {
    return isAdmin() && getAdminRole() === 'panitia';
  }

  /**
   * Cek apakah role admin punya akses ke halaman settings.
   * Superadmin: akses penuh. Ketua panitia: akses terbatas
   * (hanya Field Login Pemilih dan Poin Per Kelas).
   */
  function canAccessSettings() {
    return isSuperAdmin() || isKetuaPanitia();
  }

  /**
   * Cek apakah user adalah ketua panitia yang sedang di halaman settings.
   * Digunakan untuk membatasi tampilan kartu ke field login & poin per kelas saja.
   */
  function isKetuaPanitiaSettings() {
    return isKetuaPanitia();
  }

  /**
   * Update photoUrl di local session (setelah upload foto profil).
   */
  function updateProfilePhoto(photoUrl) {
    const data = getUserData();
    data.photoUrl = photoUrl;
    sessionStorage.setItem(KEY_USER_DATA, JSON.stringify(data));
  }

  /**
   * Update name di local session (setelah update profil).
   */
  function updateProfileName(name) {
    const data = getUserData();
    data.name = name;
    sessionStorage.setItem(KEY_USER_DATA, JSON.stringify(data));
  }

  // ── Voter session ────────────────────────────────────────

  function setVoterSession(responseData) {
    // responseData.elections = array elections (multi-election support)
    // responseData.election  = single election (backward-compat)
    const electionsArr = responseData.elections || null;
    setSession(
      responseData.token,
      'voter',
      responseData.voter,
      responseData.expiresAt,
      responseData.election,   // KEY_ELECTION — single (backward-compat)
      electionsArr             // KEY_ELECTIONS — array
    );
  }

  // ── Admin session ────────────────────────────────────────

  function setAdminSession(responseData) {
    setSession(
      responseData.token,
      'admin',
      responseData.admin,
      responseData.expiresAt,
      null,
      null
    );
  }

  // ── Logout ───────────────────────────────────────────────

  async function logoutVoter(redirect = true) {
    if (getToken()) {
      try { await API.auth.voterLogout(); } catch (_) {}
    }
    clearSession();
    if (redirect) window.location.href = '/index.html';
  }

  async function logoutAdmin(redirect = true) {
    if (getToken()) {
      try { await API.auth.adminLogout(); } catch (_) {}
    }
    clearSession();
    if (redirect) window.location.href = '/admin/login.html';
  }

  // ── Page Guards ──────────────────────────────────────────

  /**
   * Guard untuk halaman voter (voting.html, success.html).
   * Jika tidak login sebagai voter → redirect ke login.
   */
  function requireVoter() {
    if (!isVoter()) {
      window.location.replace('/index.html');
      return false;
    }
    return true;
  }

  /**
   * Guard untuk halaman admin.
   * Jika tidak login sebagai admin → redirect ke admin login.
   * @param {string[]} [allowedRoles] - Jika diberikan, role selain ini di-redirect ke dashboard.
   */
  function requireAdminPage(allowedRoles) {
    if (!isAdmin()) {
      window.location.replace('/admin/login.html');
      return false;
    }
    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.indexOf(getAdminRole()) === -1) {
        // Role tidak punya akses ke halaman ini → redirect ke dashboard
        window.location.replace('/admin/dashboard.html');
        return false;
      }
    }
    return true;
  }

  /**
   * Guard untuk halaman login (index.html, admin/login.html).
   * Jika sudah login → redirect ke halaman yang sesuai.
   */
  function redirectIfLoggedIn() {
    if (isVoter()) {
      if (hasVotedAll()) {
        window.location.replace('/success.html');
      } else {
        window.location.replace('/voting.html');
      }
      return true;
    }
    if (isAdmin()) {
      window.location.replace('/admin/dashboard.html');
      return true;
    }
    return false;
  }

  /**
   * Guard khusus halaman voting: jika sudah vote di SEMUA elections → redirect success.
   */
  function requireNotVoted() {
    if (!requireVoter()) return false;
    if (hasVotedAll()) {
      window.location.replace('/success.html');
      return false;
    }
    return true;
  }

  /**
   * Update hasVoted di local session (setelah berhasil vote di semua elections).
   */
  function markAsVoted() {
    const data = getUserData();
    data.hasVoted = true;
    sessionStorage.setItem(KEY_USER_DATA, JSON.stringify(data));
  }

  return {
    setSession, clearSession,
    getToken, getUserType, getUserData, getElectionData,
    getElectionsData, hasVotedAll, isMultiElection, markElectionVoted,
    isLoggedIn, isVoter, isAdmin, isExpired,
    getAdminRole, isSuperAdmin, isKetuaPanitia, isPanitia,
    canAccessSettings, isKetuaPanitiaSettings,
    setVoterSession, setAdminSession,
    logoutVoter, logoutAdmin,
    requireVoter, requireAdminPage, redirectIfLoggedIn,
    requireNotVoted, markAsVoted,
    updateProfilePhoto, updateProfileName,
  };
})();
