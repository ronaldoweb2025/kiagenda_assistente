const express = require("express");
const { loadTenantContext } = require("../middleware/loadTenantContext");
const { getTenantConfig, updateTenantConfig } = require("../controllers/tenantConfigController");
const {
  getSession,
  resetSession,
  resetWhatsappSession,
  startSession,
  stopSession
} = require("../controllers/tenantSessionController");
const { getTenantStates, postTenantBotMessage } = require("../controllers/tenantBotController");

const router = express.Router();

router.use("/api/tenants/:tenantId", loadTenantContext);
router.get("/api/tenants/:tenantId/config", getTenantConfig);
router.put("/api/tenants/:tenantId/config", updateTenantConfig);
router.get("/api/tenants/:tenantId/session", getSession);
router.post("/api/tenants/:tenantId/session/start", startSession);
router.post("/api/tenants/:tenantId/session/stop", stopSession);
router.post("/api/tenants/:tenantId/session/reset", resetSession);
router.post("/api/tenants/:tenantId/whatsapp/reset-session", resetWhatsappSession);
router.get("/api/tenants/:tenantId/states", getTenantStates);
router.post("/api/tenants/:tenantId/bot/messages", postTenantBotMessage);

module.exports = router;
