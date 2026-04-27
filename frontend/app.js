window.KiagendaApp = (() => {
  const ADMIN_LOGIN = "admin";
  const ADMIN_PASSWORD = "123";

  function requestJson(url, options) {
    return fetch(url, options).then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data?.message || "Falha na requisicao.");
        error.data = data?.data;
        throw error;
      }

      return data;
    });
  }

  function normalizeTenantId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "");
  }

  function parseAliases(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function readLocalJson(key, fallbackValue) {
    try {
      const rawValue = window.localStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function writeLocalJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getQueryParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  function getAuthSession() {
    return readLocalJson("kiagenda.auth.session", null);
  }

  function getLegacyAuthAccounts() {
    return readLocalJson("kiagenda.auth.accounts", []);
  }

  function saveLegacyAuthAccounts(accounts) {
    writeLocalJson("kiagenda.auth.accounts", Array.isArray(accounts) ? accounts : []);
  }

  function saveAuthSession(session) {
    writeLocalJson("kiagenda.auth.session", session);
  }

  function isAccountActive(session) {
    const activationStatus = String(session?.activationStatus || "").trim().toLowerCase();
    return activationStatus === "" || activationStatus === "active";
  }

  function getPendingActivation() {
    return readLocalJson("kiagenda.auth.pendingActivation", null);
  }

  function savePendingActivation(value) {
    writeLocalJson("kiagenda.auth.pendingActivation", value);
  }

  function clearPendingActivation() {
    window.localStorage.removeItem("kiagenda.auth.pendingActivation");
  }

  async function updateAuthPassword(tenantId, nextPassword, confirmPassword) {
    return requestJson("/api/auth/update-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tenantId: normalizeTenantId(tenantId),
        newPassword: String(nextPassword || ""),
        confirmPassword: String(confirmPassword || "")
      })
    });
  }

  function clearAuthSession() {
    window.localStorage.removeItem("kiagenda.auth.session");
  }

  function getAdminSession() {
    return readLocalJson("kiagenda.admin.session", null);
  }

  function saveAdminSession(session) {
    writeLocalJson("kiagenda.admin.session", session);
  }

  function clearAdminSession() {
    window.localStorage.removeItem("kiagenda.admin.session");
  }

  function isAdminCredentials({ login, password }) {
    return (
      String(login || "").trim().toLowerCase() === ADMIN_LOGIN &&
      String(password || "") === ADMIN_PASSWORD
    );
  }

  return {
    ADMIN_LOGIN,
    escapeHtml,
    clearAdminSession,
    clearAuthSession,
    clearPendingActivation,
    getAuthSession,
    getAdminSession,
    getPendingActivation,
    getQueryParam,
    getLegacyAuthAccounts,
    isAccountActive,
    isAdminCredentials,
    normalizeTenantId,
    normalizePhone,
    parseAliases,
    requestJson,
    saveAdminSession,
    saveLegacyAuthAccounts,
    savePendingActivation,
    updateAuthPassword,
    saveAuthSession
  };
})();
