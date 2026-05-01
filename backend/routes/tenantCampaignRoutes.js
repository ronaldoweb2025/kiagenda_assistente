const express = require("express");
const { loadTenantContext } = require("../middleware/loadTenantContext");
const {
  getTenantCampaigns,
  patchDraftMessage,
  postApproveCampaignBatch,
  postCancelCampaign,
  postDispatchNextCampaignLead,
  postImportCampaign,
  postRunCampaignWorker,
  putCampaignAccess
} = require("../controllers/tenantCampaignController");

const router = express.Router();

router.use("/api/tenants/:tenantId/campaigns", loadTenantContext);
router.get("/api/tenants/:tenantId/campaigns", getTenantCampaigns);
router.post("/api/tenants/:tenantId/campaigns/import", postImportCampaign);
router.post("/api/tenants/:tenantId/campaigns/approve-batch", postApproveCampaignBatch);
router.put("/api/tenants/:tenantId/campaigns/queue/:queueId/draft-message", patchDraftMessage);
router.post("/api/tenants/:tenantId/campaigns/dispatch-next", postDispatchNextCampaignLead);
router.post("/api/tenants/:tenantId/campaigns/process", postRunCampaignWorker);
router.post("/api/tenants/:tenantId/campaigns/:campaignId/cancel", postCancelCampaign);
router.put("/api/admin/tenants/:tenantId/campaign-access", putCampaignAccess);

module.exports = router;
