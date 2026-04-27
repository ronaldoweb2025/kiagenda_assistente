const path = require("path");
const fs = require("fs");
const { assertTenantId } = require("./tenantResolver");
const { ensureDirectory, readJsonFile, writeJsonFile } = require("../utils/jsonFileStore");

const sessionsDirectoryPath = path.resolve(__dirname, "../../data/sessions");

function getSessionFilePath(tenantId) {
  return path.resolve(sessionsDirectoryPath, `${assertTenantId(tenantId)}.json`);
}

function buildDefaultSession(tenantId) {
  return {
    tenantId: assertTenantId(tenantId),
    connected: false,
    status: "disconnected",
    sessionId: "",
    number: "",
    provider: "whatsapp-web.js",
    qr: "",
    qrCode: "",
    startedAt: null,
    stoppedAt: null,
    manualStop: false,
    reconnectAttempts: 0,
    lastDisconnectAt: null,
    nextReconnectAt: null,
    lastError: "",
    updatedAt: new Date().toISOString()
  };
}

function bootstrapTenantSessionStore() {
  ensureDirectory(sessionsDirectoryPath);
}

function readSession(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  const filePath = getSessionFilePath(resolvedTenantId);
  const fallback = buildDefaultSession(resolvedTenantId);
  const parsed = readJsonFile(filePath, fallback);

  return {
    ...fallback,
    ...parsed,
    tenantId: resolvedTenantId
  };
}

function writeSession(tenantId, sessionData) {
  const resolvedTenantId = assertTenantId(tenantId);
  const qr = sessionData?.qr !== undefined ? sessionData.qr : sessionData?.qrCode;
  const nextSession = {
    ...buildDefaultSession(resolvedTenantId),
    ...sessionData,
    qr,
    qrCode: qr || "",
    tenantId: resolvedTenantId,
    updatedAt: new Date().toISOString()
  };

  writeJsonFile(getSessionFilePath(resolvedTenantId), nextSession);
  return nextSession;
}

function deleteSessionFile(tenantId) {
  const filePath = getSessionFilePath(tenantId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

module.exports = {
  bootstrapTenantSessionStore,
  buildDefaultSession,
  deleteSessionFile,
  readSession,
  writeSession,
  sessionsDirectoryPath
};
