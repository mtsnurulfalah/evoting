/**
 * config.js — eVoting OSIM/S
 * ============================================================
 * Konfigurasi frontend: GAS URL dan konstanta aplikasi.
 *
 * PENTING:
 * - Ganti nilai GAS_URL dengan URL GAS Web App Anda setelah deploy.
 * - File ini TIDAK boleh berisi secret atau credential sensitif.
 * - GAS URL bersifat semi-public (harus accessible dari browser),
 *   namun backend GAS tetap memvalidasi semua request.
 * ============================================================
 */

// URL Google Apps Script Web App
// Dapatkan dari: GAS Editor > Deploy > Manage Deployments > Web App URL
window.GAS_URL = 'https://script.google.com/macros/s/AKfycbzICcuJ_xpJUAmcSME6yBfe6ocZPJlrfo0h-nCHI25yAfgNkQWSthw9OKlm3AMFk1SFJQ/exec';

// Konstanta aplikasi (fallback sebelum config dari server dimuat)
window.APP_CONFIG = {
  APP_NAME:     'eVoting OSIM',
  APP_SUBTITLE: 'Pemilihan Ketua OSIM/S',
  SCHOOL_NAME:  '',
};
