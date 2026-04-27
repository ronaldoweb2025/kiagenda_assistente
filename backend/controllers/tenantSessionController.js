const {
  getTenantSession,
  resetTenantSession,
  startTenantSession,
  stopTenantSession
} = require("../services/tenantSessionService");

function getSession(req, res) {
  res.json(getTenantSession(req.params.tenantId));
}

async function startSession(req, res, next) {
  try {
    const session = await startTenantSession(req.params.tenantId, req.body || {});
    res.status(201).json({
      message: "Conexao do WhatsApp iniciada com sucesso.",
      data: session
    });
  } catch (error) {
    next(error);
  }
}

async function stopSession(req, res, next) {
  try {
    const session = await stopTenantSession(req.params.tenantId);
    res.json({
      message: "Conexao do WhatsApp encerrada com sucesso.",
      data: session
    });
  } catch (error) {
    next(error);
  }
}

async function resetSession(req, res, next) {
  try {
    const session = await resetTenantSession(req.params.tenantId);
    res.json({
      message: "Sessao do WhatsApp resetada com sucesso.",
      data: session
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSession,
  resetSession,
  startSession,
  stopSession
};
