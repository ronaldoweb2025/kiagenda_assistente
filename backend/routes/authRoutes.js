const express = require("express");
const {
  getActivationCodes,
  postActivateAccount,
  postDeactivateActivationCode,
  postForgotPassword,
  postForgotPasswordWhatsapp,
  postGenerateAdminAccessCode,
  postLogin,
  postLoginWithAdminCode,
  postResendWhatsappVerification,
  postRegister,
  postResetPassword,
  postResetPasswordWhatsapp,
  postStartFirstAccess,
  postVerifyResetCode,
  postVerifyWhatsappRegistration,
  postUpdatePassword
} = require("../controllers/authController");

const router = express.Router();

router.post("/api/auth/register", postRegister);
router.post("/api/auth/login", postLogin);
router.post("/api/auth/login-with-admin-code", postLoginWithAdminCode);
router.post("/api/auth/activate-account", postActivateAccount);
router.post("/api/auth/admin-access-code", postGenerateAdminAccessCode);
router.get("/api/auth/admin-access-codes", getActivationCodes);
router.post("/api/auth/admin-access-code/deactivate", postDeactivateActivationCode);
router.post("/api/auth/resend-whatsapp-verification", postResendWhatsappVerification);
router.post("/api/auth/verify-whatsapp-registration", postVerifyWhatsappRegistration);
router.post("/api/auth/forgot-password", postForgotPassword);
router.post("/api/auth/forgot-password-whatsapp", postForgotPasswordWhatsapp);
router.post("/api/auth/first-access", postStartFirstAccess);
router.post("/api/auth/verify-reset-code", postVerifyResetCode);
router.post("/api/auth/reset-password", postResetPassword);
router.post("/api/auth/reset-password-whatsapp", postResetPasswordWhatsapp);
router.post("/api/auth/update-password", postUpdatePassword);

module.exports = router;
