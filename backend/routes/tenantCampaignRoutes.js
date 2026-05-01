const express = require("express");
const { loadTenantContext } = require("../middleware/loadTenantContext");
const {
  deleteCampaignQueueLead,
  getTenantCampaigns,
  patchDraftMessage,
  postApproveCampaignBatch,
  postClearCampaignQueue,
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
router.post("/api/tenants/:tenantId/campaigns/clear", postClearCampaignQueue);
router.put("/api/tenants/:tenantId/campaigns/queue/:queueId/draft-message", patchDraftMessage);
router.delete("/api/tenants/:tenantId/campaigns/queue/:queueId", deleteCampaignQueueLead);
router.post("/api/tenants/:tenantId/campaigns/dispatch-next", postDispatchNextCampaignLead);
router.post("/api/tenants/:tenantId/campaigns/process", postRunCampaignWorker);
router.post("/api/tenants/:tenantId/campaigns/:campaignId/cancel", postCancelCampaign);
router.put("/api/admin/tenants/:tenantId/campaign-access", putCampaignAccess);

module.exports = router;
