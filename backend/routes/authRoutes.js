const express = require("express");
const { configureGoogleAuth, isGoogleAuthConfigured, passport } = require("../auth/googleAuth");
const {
  completeGoogleAuth,
  consumeMagicLink,
  getGoogleAuthStatus,
  getActivationCodes,
  postActivateAccount,
  postDeactivateActivationCode,
  postGenerateAdminAccessCode,
  postLogin,
  postLoginWithAdminCode,
  postRequestMagicLink,
  postResendWhatsappVerification,
  postRegister,
  postStartFirstAccess,
  postVerifyWhatsappRegistration,
  postUpdatePassword
} = require("../controllers/authController");

const router = express.Router();

configureGoogleAuth((accessToken, refreshToken, profile, done) => {
  done(null, { profile });
});

router.post("/api/auth/register", postRegister);
router.post("/api/auth/login", postLogin);
router.post("/api/auth/magic-link", postRequestMagicLink);
router.get("/auth/google/status", getGoogleAuthStatus);
router.get("/auth/google", (req, res, next) => {
  if (!isGoogleAuthConfigured()) {
    return res.redirect("/?auth_error=" + encodeURIComponent("Google OAuth nao esta configurado."));
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    session: false
  })(req, res, next);
});
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/?auth_error=" + encodeURIComponent("Nao foi possivel entrar com Google."),
    session: false
  }),
  completeGoogleAuth
);
router.get("/auth/magic", consumeMagicLink);
router.post("/api/auth/login-with-admin-code", postLoginWithAdminCode);
router.post("/api/auth/activate-account", postActivateAccount);
router.post("/api/auth/admin-access-code", postGenerateAdminAccessCode);
router.get("/api/auth/admin-access-codes", getActivationCodes);
router.post("/api/auth/admin-access-code/deactivate", postDeactivateActivationCode);
router.post("/api/auth/resend-whatsapp-verification", postResendWhatsappVerification);
router.post("/api/auth/verify-whatsapp-registration", postVerifyWhatsappRegistration);
router.post("/api/auth/first-access", postStartFirstAccess);
router.post("/api/auth/update-password", postUpdatePassword);

module.exports = router;
