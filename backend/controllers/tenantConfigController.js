const { saveTenant } = require("../services/tenantService");

function getTenantConfig(req, res) {
  res.json(req.tenant);
}

function updateTenantConfig(req, res) {
  const tenant = saveTenant(req.params.tenantId, req.body || {});
  res.json({
    message: "Configuracao do tenant atualizada com sucesso.",
    data: tenant
  });
}

module.exports = {
  getTenantConfig,
  updateTenantConfig
};
