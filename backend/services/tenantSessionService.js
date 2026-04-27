const {
  getSession,
  resetSession,
  startSession,
  stopSession
} = require("../bot/whatsappSessions");
const { assertTenantId } = require("../tenancy/tenantResolver");

function getTenantSession(tenantId) {
  return getSession(assertTenantId(tenantId));
}

async function startTenantSession(tenantId, payload = {}) {
  return startSession(assertTenantId(tenantId), payload);
}

async function stopTenantSession(tenantId) {
  return stopSession(assertTenantId(tenantId));
}

async function resetTenantSession(tenantId) {
  return resetSession(assertTenantId(tenantId));
}

async function resetTenantWhatsappSession(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);
  const currentSession = getSession(resolvedTenantId);

  await resetSession(resolvedTenantId);

  return startSession(resolvedTenantId, {
    sessionId: currentSession?.sessionId || `${resolvedTenantId}-session`
  });
}

module.exports = {
  getTenantSession,
  resetTenantSession,
  resetTenantWhatsappSession,
  startTenantSession,
  stopTenantSession
};
