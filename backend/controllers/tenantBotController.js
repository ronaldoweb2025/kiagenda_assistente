const {
  getTenantConversationStates,
  handleIncomingTenantMessage
} = require("../services/tenantBotService");

function getTenantStates(req, res) {
  res.json({
    items: getTenantConversationStates(req.tenant)
  });
}

async function postTenantBotMessage(req, res, next) {
  try {
    const result = await handleIncomingTenantMessage({
      tenant: req.tenant,
      contactId: String(req.body?.contactId || "contato_demo"),
      message: String(req.body?.message || "")
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTenantStates,
  postTenantBotMessage
};
