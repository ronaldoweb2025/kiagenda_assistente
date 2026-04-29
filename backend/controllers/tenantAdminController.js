const {
  changeTenantPlan,
  createTenant,
  deleteTenantPermanently,
  disableTenant,
  getTenant,
  listTenantSummaries,
  restoreLatestTenantBackup,
  saveTenant
} = require("../services/tenantService");
const { readPlanSettings, updatePlanSettings } = require("../tenancy/planSettingsStore");

function isPlanChangePayload(payload = {}) {
  const keys = Object.keys(payload);
  return keys.length > 0 && keys.every((key) => ["plan", "subscriptionStatus"].includes(key));
}

function getTenants(req, res) {
  res.json({
    items: listTenantSummaries()
  });
}

function postTenant(req, res) {
  const tenant = createTenant(req.body || {});
  res.status(201).json({
    message: "Cliente criado com sucesso.",
    data: tenant
  });
}

function getTenantById(req, res) {
  res.json(getTenant(req.params.tenantId));
}

function getAdminPlanSettings(req, res) {
  res.json({
    data: readPlanSettings()
  });
}

function putTenant(req, res) {
  const payload = req.body || {};

  if (isPlanChangePayload(payload)) {
    const result = changeTenantPlan(req.params.tenantId, payload.plan, payload.subscriptionStatus);
    const message = result.warning
      ? `Plano atualizado com sucesso. ${result.warning}`
      : "Plano atualizado com sucesso.";

    res.json({
      message,
      warning: result.warning,
      backup: result.backup,
      data: result.tenant
    });
    return;
  }

  const tenant = saveTenant(req.params.tenantId, payload);
  res.json({
    message: tenant.warning
      ? `Cliente atualizado com sucesso. ${tenant.warning}`
      : "Cliente atualizado com sucesso.",
    warning: tenant.warning || "",
    backup: tenant.backup || null,
    data: tenant
  });
}

function postRestoreTenantBackup(req, res) {
  const result = restoreLatestTenantBackup(req.params.tenantId);
  res.json({
    message: "Backup restaurado com sucesso.",
    backup: result.backup,
    data: result.tenant
  });
}

function putAdminPlanSettings(req, res) {
  const planSettings = updatePlanSettings(req.body || {});
  res.json({
    message: "Planos e limites atualizados com sucesso.",
    data: planSettings
  });
}

async function deleteTenant(req, res) {
  try {
    if (String(req.query?.permanent || "").toLowerCase() === "true") {
      const result = await deleteTenantPermanently(req.params.tenantId);
      res.json({
        message: "Cliente excluido com sucesso.",
        data: result
      });
      return;
    }

    const tenant = disableTenant(req.params.tenantId);
    res.json({
      message: "Cliente desativado com sucesso.",
      data: tenant
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || "Nao foi possivel excluir o cliente."
    });
  }
}

module.exports = {
  deleteTenant,
  getAdminPlanSettings,
  getTenantById,
  getTenants,
  postRestoreTenantBackup,
  postTenant,
  putAdminPlanSettings,
  putTenant
};
