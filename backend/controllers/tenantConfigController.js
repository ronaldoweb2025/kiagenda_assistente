const { saveTenant } = require("../services/tenantService");

function getTenantConfig(req, res) {
  res.json(req.tenant);
}

function updateTenantConfig(req, res) {
  const tenant = saveTenant(req.params.tenantId, req.body || {});
  res.json({
    message: tenant.warning
      ? `Configuracao do tenant atualizada com sucesso. ${tenant.warning}`
      : "Configuracao do tenant atualizada com sucesso.",
    warning: tenant.warning || "",
    backup: tenant.backup || null,
    data: tenant
  });
}

module.exports = {
  getTenantConfig,
  updateTenantConfig
};
