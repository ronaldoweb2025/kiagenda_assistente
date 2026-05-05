const express = require("express");
const {
  deleteTenant,
  getAdminBotModelSettings,
  getAdminPlanSettings,
  getTenantConfigExport,
  getTenantById,
  getTenants,
  postTenantConfigImport,
  postRestoreTenantBackup,
  postTenant,
  putAdminBotModelSettings,
  putAdminPlanSettings,
  putTenant
} = require("../controllers/tenantAdminController");

const router = express.Router();

router.get("/api/tenants", getTenants);
router.post("/api/tenants", postTenant);
router.get("/api/admin/plan-settings", getAdminPlanSettings);
router.put("/api/admin/plan-settings", putAdminPlanSettings);
router.get("/api/admin/bot-model-settings", getAdminBotModelSettings);
router.put("/api/admin/bot-model-settings", putAdminBotModelSettings);
router.post("/api/admin/tenants/:tenantId/restore-backup", postRestoreTenantBackup);
router.get("/api/tenants/:tenantId/config/export", getTenantConfigExport);
router.post("/api/tenants/:tenantId/config/import", postTenantConfigImport);
router.get("/api/tenants/:tenantId", getTenantById);
router.put("/api/tenants/:tenantId", putTenant);
router.delete("/api/tenants/:tenantId", deleteTenant);

module.exports = router;
