const { readTenant } = require("../tenancy/tenantConfigStore");

function loadTenantContext(req, res, next) {
  try {
    req.tenant = readTenant(req.params.tenantId);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  loadTenantContext
};
