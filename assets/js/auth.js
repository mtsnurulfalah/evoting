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

  // ── Token Storage ────────────────────────────────────────

  function setSession(token, userType, userData, expiresAt, electionData) {
    sessionStorage.setItem(KEY_TOKEN,      token);
    sessionStorage.setItem(KEY_USER_TYPE,  userType);
    sessionStorage.setItem(KEY_USER_DATA,  JSON.stringify(userData || {}));
    sessionStorage.setItem(KEY_EXPIRES_AT, expiresAt || '');
    if (electionData) {
      sessionStorage.setItem(KEY_ELECTION, JSON.stringify(electionData));
    }
  }

  function clearSession() {
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_USER_TYPE);
    sessionStorage.removeItem(KEY_USER_DATA);
    sessionStorage.removeItem(KEY_EXPIRES_AT);
    sessionStorage.removeItem(KEY_ELECTION);
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

  function getElectionData() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY_ELECTION) || 'null');
    } catch { return null; }
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
    setSession(
      responseData.token,
      'voter',
      responseData.voter,
      responseData.expiresAt,
      responseData.election
    );
  }

  // ── Admin session ────────────────────────────────────────

  function setAdminSession(responseData) {
    setSession(
      responseData.token,
      'admin',
      responseData.admin,
      responseData.expiresAt,
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
      const voter = getUserData();
      if (voter.hasVoted) {
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
   * Guard khusus halaman voting: jika sudah vote → redirect success.
   */
  function requireNotVoted() {
    if (!requireVoter()) return false;
    const voter = getUserData();
    if (voter.hasVoted) {
      window.location.replace('/success.html');
      return false;
    }
    return true;
  }

  /**
   * Update hasVoted di local session (setelah berhasil vote).
   */
  function markAsVoted() {
    const data = getUserData();
    data.hasVoted = true;
    sessionStorage.setItem(KEY_USER_DATA, JSON.stringify(data));
  }

  return {
    setSession, clearSession,
    getToken, getUserType, getUserData, getElectionData,
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
