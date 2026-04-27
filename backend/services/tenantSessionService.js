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

module.exports = {
  getTenantSession,
  resetTenantSession,
  startTenantSession,
  stopTenantSession
};
