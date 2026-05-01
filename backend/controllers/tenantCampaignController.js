const {
  approveCampaignBatch,
  cancelCampaign,
  clearCampaignQueue,
  deleteQueueLead,
  dispatchNextCampaignLead,
  getCampaigns,
  importCampaign,
  processCampaignQueue,
  updateDraftMessage,
  updateCampaignAccess
} = require("../campaigns/campaignService");

function buildImportSummary(store, tenantId) {
  const latestCampaign = store.campaigns[store.campaigns.length - 1];
  const queueItems = store.queue.filter((item) => item.campaignId === latestCampaign.campaignId);
  const blockedItems = queueItems.filter((item) => ["cancelled", "replied"].includes(item.status));
  const acceptedItems = queueItems.filter((item) => item.status === "draft");

  return {
    tenantId,
    campaign: latestCampaign,
    importSummary: {
      total: queueItems.length,
      accepted: acceptedItems.length,
      blocked: blockedItems.length,
      blockedItems: blockedItems.map((item) => ({
        leadId: item.leadId,
        phone: item.phone,
        status: item.status,
        reason: item.failureReason
      }))
    }
  };
}

function getTenantCampaigns(req, res) {
  res.json(getCampaigns(req.params.tenantId));
}

function postImportCampaign(req, res, next) {
  try {
    const store = importCampaign(req.params.tenantId, req.body || {}, {
      sourceFileName: req.body?.source_file_name || req.body?.sourceFileName || "",
      importedBy: "admin"
    });

    res.status(201).json({
      message: "Campanha importada com sucesso.",
      data: buildImportSummary(store, req.params.tenantId)
    });
  } catch (error) {
    next(error);
  }
}

async function postRunCampaignWorker(req, res, next) {
  try {
    const result = await processCampaignQueue({
      tenantId: req.params.tenantId
    });

    res.json({
      message: "Worker executado com sucesso.",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function postDispatchNextCampaignLead(req, res, next) {
  try {
    const result = await dispatchNextCampaignLead(req.params.tenantId);

    res.json({
      message: result.processed ? "Proximo lead disparado com sucesso." : "Nenhum lead foi disparado neste momento.",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

function postApproveCampaignBatch(req, res, next) {
  try {
    const store = approveCampaignBatch(req.params.tenantId, req.body || {});

    res.json({
      message: "Lote aprovado e distribuido com sucesso.",
      data: {
        tenantId: req.params.tenantId,
        campaigns: store.campaigns,
        queue: store.queue
      }
    });
  } catch (error) {
    next(error);
  }
}

function patchDraftMessage(req, res, next) {
  try {
    const store = updateDraftMessage(req.params.tenantId, req.params.queueId, req.body || {});

    res.json({
      message: "Rascunho atualizado com sucesso.",
      data: {
        tenantId: req.params.tenantId,
        queueId: req.params.queueId,
        queue: store.queue
      }
    });
  } catch (error) {
    next(error);
  }
}

function postCancelCampaign(req, res, next) {
  try {
    const store = cancelCampaign(req.params.tenantId, req.params.campaignId, String(req.body?.reason || "cancelled_by_admin"));

    res.json({
      message: "Campanha cancelada com sucesso.",
      data: {
        tenantId: req.params.tenantId,
        campaignId: req.params.campaignId,
        campaigns: store.campaigns
      }
    });
  } catch (error) {
    next(error);
  }
}

function deleteCampaignQueueLead(req, res, next) {
  try {
    const store = deleteQueueLead(req.params.tenantId, req.params.queueId, req.body || {});

    res.json({
      message: "Lead removido da fila com sucesso.",
      data: {
        tenantId: req.params.tenantId,
        queue: store.queue,
        campaigns: store.campaigns
      }
    });
  } catch (error) {
    next(error);
  }
}

function postClearCampaignQueue(req, res, next) {
  try {
    const store = clearCampaignQueue(req.params.tenantId, req.body || {});

    res.json({
      message: "Fila Ninja Send limpa com sucesso.",
      data: {
        tenantId: req.params.tenantId,
        removed: store.lastClearSummary?.removed || 0,
        mode: store.lastClearSummary?.mode || "all",
        queue: store.queue,
        campaigns: store.campaigns
      }
    });
  } catch (error) {
    next(error);
  }
}

function putCampaignAccess(req, res, next) {
  try {
    const tenant = updateCampaignAccess(req.params.tenantId, req.body || {});

    res.json({
      message: "Acesso de campanhas atualizado com sucesso.",
      data: tenant.features.campaigns
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTenantCampaigns,
  deleteCampaignQueueLead,
  patchDraftMessage,
  postApproveCampaignBatch,
  postClearCampaignQueue,
  postCancelCampaign,
  postDispatchNextCampaignLead,
  postImportCampaign,
  postRunCampaignWorker,
  putCampaignAccess
};
