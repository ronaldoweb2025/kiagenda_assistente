const express = require("express");
const {
  deleteTenant,
  getAdminPlanSettings,
  getTenantById,
  getTenants,
  postTenant,
  putAdminPlanSettings,
  putTenant
} = require("../controllers/tenantAdminController");

const router = express.Router();

router.get("/api/tenants", getTenants);
router.post("/api/tenants", postTenant);
router.get("/api/admin/plan-settings", getAdminPlanSettings);
router.put("/api/admin/plan-settings", putAdminPlanSettings);
router.get("/api/tenants/:tenantId", getTenantById);
router.put("/api/tenants/:tenantId", putTenant);
router.delete("/api/tenants/:tenantId", deleteTenant);

module.exports = router;
