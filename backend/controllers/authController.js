const {
  activateAccountWithCode,
  forgotPassword,
  forgotPasswordWhatsapp,
  createActivationCode,
  deactivateActivationCode,
  getActivationCodeList,
  loginWithAdminCode,
  loginWithPassword,
  registerAuthAccount,
  resendWhatsappVerificationCode,
  resetPassword,
  resetPasswordWhatsapp,
  startFirstAccess,
  updatePasswordByTenant,
  verifyWhatsappRegistration,
  verifyResetCode
} = require("../services/authService");

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
    res.json(await activateAccountWithCode(req.body || {}));
  } catch (error) {
    next(error);
  }
}

async function postForgotPassword(req, res, next) {
  try {
    res.json(await forgotPassword(req.body || {}));
  } catch (error) {
    next(error);
  }
}

async function postResetPassword(req, res, next) {
  try {
    res.json(await resetPassword(req.body || {}));
  } catch (error) {
    next(error);
  }
}

async function postForgotPasswordWhatsapp(req, res, next) {
  try {
    res.json(await forgotPasswordWhatsapp(req.body || {}));
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

async function postVerifyResetCode(req, res, next) {
  try {
    res.json(await verifyResetCode(req.body || {}));
  } catch (error) {
    next(error);
  }
}

async function postResetPasswordWhatsapp(req, res, next) {
  try {
    res.json(await resetPasswordWhatsapp(req.body || {}));
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
  postActivateAccount,
  postForgotPassword,
  postForgotPasswordWhatsapp,
  postGenerateAdminAccessCode,
  getActivationCodes,
  postLogin,
  postLoginWithAdminCode,
  postDeactivateActivationCode,
  postResendWhatsappVerification,
  postRegister,
  postResetPassword,
  postResetPasswordWhatsapp,
  postStartFirstAccess,
  postUpdatePassword,
  postVerifyResetCode,
  postVerifyWhatsappRegistration
};
