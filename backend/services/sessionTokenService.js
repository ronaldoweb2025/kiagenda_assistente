const jwt = require("jsonwebtoken");

const SESSION_JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_JWT_SECRET || "kiagenda-dev-jwt-secret";
const SESSION_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function normalizeAccountSession(account = {}) {
  return {
    tenantId: account.tenantId || "",
    whatsapp: account.whatsapp || "",
    email: account.email || "",
    name: account.name || "",
    businessName: account.businessName || "",
    activationStatus: account.activationStatus === "active" ? "active" : "pending",
    authProvider: account.authProvider || "local",
    avatarUrl: account.avatarUrl || ""
  };
}

function signAuthToken(account = {}) {
  const session = normalizeAccountSession(account);
  return jwt.sign(session, SESSION_JWT_SECRET, {
    expiresIn: SESSION_JWT_EXPIRES_IN,
    subject: session.tenantId || session.email || "auth-session"
  });
}

function buildClientSession(account = {}) {
  const session = normalizeAccountSession(account);
  return {
    ...session,
    token: signAuthToken(account)
  };
}

module.exports = {
  buildClientSession,
  normalizeAccountSession,
  signAuthToken
};
