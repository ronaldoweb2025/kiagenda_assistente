const {
  createTenant,
  deleteTenantPermanently,
  disableTenant,
  getTenant,
  listTenantSummaries,
  saveTenant
} = require("../services/tenantService");
const { readPlanSettings, updatePlanSettings } = require("../tenancy/planSettingsStore");

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
  const tenant = saveTenant(req.params.tenantId, req.body || {});
  res.json({
    message: "Cliente atualizado com sucesso.",
    data: tenant
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
  postTenant,
  putAdminPlanSettings,
  putTenant
};
