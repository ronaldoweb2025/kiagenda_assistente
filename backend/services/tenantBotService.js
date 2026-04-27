const { processIncomingMessage } = require("../bot/flowEngine");
const { listTenantStates } = require("../bot/stateManager");

async function handleIncomingTenantMessage({ tenant, contactId, message }) {
  return processIncomingMessage({
    tenantId: tenant.tenantId,
    contactId,
    message,
    config: tenant
  });
}

function getTenantConversationStates(tenant) {
  return listTenantStates(tenant.tenantId, tenant.settings.stateTTL);
}

module.exports = {
  getTenantConversationStates,
  handleIncomingTenantMessage
};
