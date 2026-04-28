const {
  activateAccountWithCode,
  authenticateWithGoogleProfile,
  createActivationCode,
  consumeMagicLinkToken,
  deactivateActivationCode,
  getActivationCodeList,
  getTenantRedirectPath,
  GOOGLE_AUTH_MODE_CONNECT,
  loginWithAdminCode,
  loginWithPassword,
  requestMagicLink,
  registerAuthAccount,
  resendWhatsappVerificationCode,
  startFirstAccess,
  updatePasswordByTenant,
  verifyWhatsappRegistration
} = require("../services/authService");
const { buildClientSession } = require("../services/sessionTokenService");
const { isGoogleAuthConfigured } = require("../auth/googleAuth");

async function postRegister(req, res, next) {
  try {
    const result = await registerAuthAccount(req.body || {});
    res.status(201).json({
      message: result.verificationResult.delivered
        ? "Enviamos um codigo para seu WhatsApp. Digite abaixo para confirmar sua conta."
        : "Nao conseguimos enviar o codigo agora. Tente novamente em alguns minutos ou fale com o suporte.",
      data: result.account,
      verificationSent: result.verificationResult.delivered,
      devPreview: result.verificationResult.devPreview,
      retryAfterSeconds: result.verificationResult.retryAfterSeconds
    });
  } catch (error) {
    next(error);
  }
}

async function postLogin(req, res, next) {
  try {
    const account = await loginWithPassword(req.body || {});
    const session = buildClientSession(account);
    res.json({
      message: "Entrada realizada com sucesso.",
      data: account,
      session
    });
  } catch (error) {
    if (error.data) {
      return res.status(error.statusCode || 403).json({
        message: error.message,
        data: error.data
      });
    }
    next(error);
  }
}

function getGoogleAuthStatus(req, res) {
  res.json({
    enabled: isGoogleAuthConfigured()
  });
}

async function postRequestMagicLink(req, res, next) {
  try {
    res.json(await requestMagicLink(req.body || {}));
  } catch (error) {
    renderGoogleAuthFailure(res, error.message || "Nao foi possivel concluir a autenticacao com Google.");
  }
}

function renderGoogleAuthFailure(res, message) {
  const safeMessage = JSON.stringify(message || "Nao foi possivel entrar com Google.");
  res.status(400).type("html").send(
    `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Falha no login Google</title>
  </head>
  <body>
    <script>
      localStorage.removeItem("kiagenda.auth.pendingActivation");
      window.location.href = "/?auth_error=" + encodeURIComponent(${safeMessage});
    </script>
  </body>
</html>`
  );
}

function buildGoogleRedirectPath(result, flowState = {}) {
  const basePath = getTenantRedirectPath(result.account.tenantId);

  if (String(flowState.mode || "").toLowerCase() !== GOOGLE_AUTH_MODE_CONNECT) {
    return basePath;
  }

  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}auth_success=${encodeURIComponent("google_connected")}`;
}

async function completeGoogleAuth(req, res, next) {
  try {
    if (!isGoogleAuthConfigured()) {
      renderGoogleAuthFailure(res, "Google OAuth nao esta configurado no servidor.");
      return;
    }

    if (!req.user) {
      renderGoogleAuthFailure(res, "Nao foi possivel validar sua conta Google.");
      return;
    }

    const flowState = req.googleAuthState || {};
    const result = await authenticateWithGoogleProfile(req.user.profile || req.user, flowState);
    const redirectPath = buildGoogleRedirectPath(result, flowState);
    const serializedSession = JSON.stringify(result.session).replace(/</g, "\\u003c");

    res.type("html").send(
      `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Entrando...</title>
  </head>
  <body>
    <script>
      localStorage.setItem("kiagenda.auth.session", JSON.stringify(${serializedSession}));
      localStorage.removeItem("kiagenda.auth.pendingActivation");
      window.location.replace(${JSON.stringify(redirectPath)});
    </script>
  </body>
</html>`
    );
  } catch (error) {
    next(error);
  }
}

async function consumeMagicLink(req, res, next) {
  try {
    const result = await consumeMagicLinkToken(req.query?.token || "");
    const redirectPath = getTenantRedirectPath(result.account.tenantId);
    const serializedSession = JSON.stringify(result.session).replace(/</g, "\\u003c");

    res.type("html").send(
      `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Entrando...</title>
  </head>
  <body>
    <script>
      localStorage.setItem("kiagenda.auth.session", JSON.stringify(${serializedSession}));
      localStorage.removeItem("kiagenda.auth.pendingActivation");
      window.location.replace(${JSON.stringify(redirectPath)});
    </script>
  </body>
</html>`
    );
  } catch (error) {
    renderGoogleAuthFailure(res, error.message || "Link invalido ou expirado.");
  }
}

async function postLoginWithAdminCode(req, res, next) {
  try {
    const account = await loginWithAdminCode(req.body || {});
    res.json({
      message: "Entrada realizada com sucesso.",
      data: account
    });
  } catch (error) {
    if (error.data) {
      return res.status(error.statusCode || 403).json({
        message: error.message,
        data: error.data
      });
    }
    next(error);
  }
}

async function postActivateAccount(req, res, next) {
  try {
    const result = await activateAccountWithCode(req.body || {});
    res.json({
      ...result,
      session: buildClientSession(result.data || {})
    });
  } catch (error) {
    next(error);
  }
}

async function postStartFirstAccess(req, res, next) {
  try {
    res.status(201).json(await startFirstAccess(req.body || {}));
  } catch (error) {
    next(error);
  }
}

async function postUpdatePassword(req, res, next) {
  try {
    const account = await updatePasswordByTenant(req.body || {});
    res.json({
      message: "Senha atualizada com sucesso.",
      data: account
    });
  } catch (error) {
    next(error);
  }
}

async function postGenerateAdminAccessCode(req, res, next) {
  try {
    const result = await createActivationCode(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

function getActivationCodes(req, res, next) {
  try {
    res.json({
      items: getActivationCodeList()
    });
  } catch (error) {
    next(error);
  }
}

function postDeactivateActivationCode(req, res, next) {
  try {
    res.json(deactivateActivationCode(req.body || {}));
  } catch (error) {
    next(error);
  }
}

async function postResendWhatsappVerification(req, res, next) {
  try {
    res.json(await resendWhatsappVerificationCode(req.body || {}));
  } catch (error) {
    next(error);
  }
}

async function postVerifyWhatsappRegistration(req, res, next) {
  try {
    res.json(await verifyWhatsappRegistration(req.body || {}));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  completeGoogleAuth,
  consumeMagicLink,
  getGoogleAuthStatus,
  postActivateAccount,
  postGenerateAdminAccessCode,
  getActivationCodes,
  postLogin,
  postLoginWithAdminCode,
  postDeactivateActivationCode,
  postRequestMagicLink,
  postResendWhatsappVerification,
  postRegister,
  postStartFirstAccess,
  postUpdatePassword,
  postVerifyWhatsappRegistration
};
