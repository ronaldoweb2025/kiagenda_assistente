const {
  buildDefaultTenant,
  deleteTenantFile,
  listTenants,
  listTenantBackups,
  readTenant,
  restoreTenantBackup,
  tenantExists,
  createTenantConfigBackup,
  updateTenantPlan: persistTenantPlanUpdate,
  updateTenant,
  writeTenant
} = require("../tenancy/tenantConfigStore");
const { deleteAuthAccountByTenantId, findAuthAccountByTenantId } = require("../tenancy/authAccountStore");
const { deleteSessionFile } = require("../tenancy/tenantSessionStore");
const { deleteTenantStates } = require("../tenancy/tenantStateStore");
const { deleteSessionArtifacts } = require("../bot/whatsappSessions");
const { assertTenantId } = require("../tenancy/tenantResolver");

function listTenantSummaries() {
  return listTenants()
    .filter((tenant) => String(tenant.type || "client").toLowerCase() === "client")
    .map((tenant) => {
    const account = findAuthAccountByTenantId(tenant.tenantId);

    return {
      tenantId: tenant.tenantId,
      type: tenant.type || "client",
      isTest: Boolean(tenant.isTest),
      active: tenant.active,
      plan: tenant.plan,
      subscriptionStatus: tenant.subscriptionStatus,
      onboardingCompleted: tenant.onboardingCompleted,
      businessName: tenant.business.name || account?.businessName || "",
      businessType: tenant.business.type,
      attendantName: tenant.business.attendantName,
      customerName: account?.name || tenant.business.attendantName || "",
      whatsappConnected: tenant.whatsapp.connected,
      whatsappNumber: account?.whatsapp || tenant.whatsapp.number,
      ninjaSendEnabled: Boolean(tenant.features?.campaigns?.enabledByAdmin),
      ninjaSendDailyLimit: Number(tenant.features?.campaigns?.dailyLimit || 10),
      activationStatus: account?.activationStatus || "pending",
      updatedAt: tenant.meta.updatedAt
    };
    });
}

function createTenant(payload = {}) {
  const tenantId = assertTenantId(payload.tenantId);

  if (tenantExists(tenantId)) {
    const error = new Error("tenant_ja_existe");
    error.statusCode = 409;
    throw error;
  }

  return writeTenant(tenantId, buildDefaultTenant(tenantId, payload));
}

function getTenant(tenantId) {
  return readTenant(tenantId);
}

function saveTenant(tenantId, payload = {}) {
  return updateTenant(tenantId, payload);
}

function exportTenantConfig(tenantId) {
  const tenant = readTenant(tenantId);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tenantId: tenant.tenantId,
    config: tenant
  };
}

function importTenantConfig(tenantId, payload = {}) {
  const currentTenant = readTenant(tenantId);
  const incomingConfig = payload.config || payload.tenant || payload;
  const incomingTenantId = String(incomingConfig?.tenantId || "").trim();

  if (!incomingConfig || typeof incomingConfig !== "object" || Array.isArray(incomingConfig)) {
    const error = new Error("Arquivo de configuracao invalido.");
    error.statusCode = 400;
    throw error;
  }

  if (incomingTenantId && incomingTenantId !== currentTenant.tenantId) {
    const error = new Error("Este backup pertence a outro tenant.");
    error.statusCode = 400;
    throw error;
  }

  const backup = createTenantConfigBackup(tenantId, currentTenant);
  const restoredTenant = writeTenant(tenantId, {
    ...incomingConfig,
    tenantId: currentTenant.tenantId
  });

  return {
    tenant: restoredTenant,
    backup
  };
}

function changeTenantPlan(tenantId, newPlan, status) {
  return persistTenantPlanUpdate(tenantId, newPlan, status);
}

function restoreLatestTenantBackup(tenantId) {
  const backups = listTenantBackups(tenantId);

  if (!backups.length) {
    const error = new Error("Nenhum backup encontrado para este cliente.");
    error.statusCode = 404;
    throw error;
  }

  const restoredTenant = restoreTenantBackup(tenantId, backups[0].fileName);

  return {
    tenant: restoredTenant,
    backup: backups[0]
  };
}

function disableTenant(tenantId) {
  return updateTenant(tenantId, {
    active: false
  });
}

async function deleteTenantPermanently(tenantId) {
  const resolvedTenantId = assertTenantId(tenantId);

  if (!tenantExists(resolvedTenantId)) {
    const error = new Error("tenant_nao_encontrado");
    error.statusCode = 404;
    throw error;
  }

  await deleteSessionArtifacts(resolvedTenantId);
  deleteTenantFile(resolvedTenantId);
  deleteSessionFile(resolvedTenantId);
  deleteTenantStates(resolvedTenantId);
  deleteAuthAccountByTenantId(resolvedTenantId);

  return {
    tenantId: resolvedTenantId,
    deleted: true
  };
}

module.exports = {
  changeTenantPlan,
  createTenant,
  deleteTenantPermanently,
  disableTenant,
  exportTenantConfig,
  getTenant,
  importTenantConfig,
  listTenantSummaries,
  restoreLatestTenantBackup,
  saveTenant
};
