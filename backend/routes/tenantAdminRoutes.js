const express = require("express");
const {
  deleteTenant,
  getTenantById,
  getTenants,
  postTenant,
  putTenant
} = require("../controllers/tenantAdminController");

const router = express.Router();

router.get("/api/tenants", getTenants);
router.post("/api/tenants", postTenant);
router.get("/api/tenants/:tenantId", getTenantById);
router.put("/api/tenants/:tenantId", putTenant);
router.delete("/api/tenants/:tenantId", deleteTenant);

module.exports = router;
