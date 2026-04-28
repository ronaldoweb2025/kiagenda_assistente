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
const {
  GOOGLE_AUTH_MODE_CONNECT,
  GOOGLE_AUTH_MODE_LOGIN,
  GOOGLE_AUTH_MODE_SIGNUP
} = require("../services/authService");

const router = express.Router();

configureGoogleAuth((accessToken, refreshToken, profile, done) => {
  done(null, { profile });
});

function encodeGoogleState(payload = {}) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeGoogleState(rawState) {
  try {
    const parsed = JSON.parse(Buffer.from(String(rawState || ""), "base64url").toString("utf8"));
    return {
      mode: String(parsed?.mode || GOOGLE_AUTH_MODE_LOGIN).trim().toLowerCase(),
      tenantId: String(parsed?.tenantId || "").trim()
    };
  } catch (error) {
    return {
      mode: GOOGLE_AUTH_MODE_LOGIN,
      tenantId: ""
    };
  }
}

function resolveGoogleMode(rawMode) {
  const normalizedMode = String(rawMode || "").trim().toLowerCase();

  if ([GOOGLE_AUTH_MODE_LOGIN, GOOGLE_AUTH_MODE_SIGNUP, GOOGLE_AUTH_MODE_CONNECT].includes(normalizedMode)) {
    return normalizedMode;
  }

  return GOOGLE_AUTH_MODE_LOGIN;
}

router.post("/api/auth/register", postRegister);
router.post("/api/auth/login", postLogin);
router.post("/api/auth/magic-link", postRequestMagicLink);
router.get("/auth/google/status", getGoogleAuthStatus);
router.get("/auth/google", (req, res, next) => {
  if (!isGoogleAuthConfigured()) {
    return res.redirect("/?auth_error=" + encodeURIComponent("Google OAuth nao esta configurado."));
  }

  const mode = resolveGoogleMode(req.query?.mode);
  const tenantId = mode === GOOGLE_AUTH_MODE_CONNECT ? String(req.query?.tenantId || "").trim() : "";

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state: encodeGoogleState({
      mode,
      tenantId
    }),
    session: false
  })(req, res, next);
});
router.get(
  "/auth/google/callback",
  (req, res, next) => {
    req.googleAuthState = decodeGoogleState(req.query?.state);
    next();
  },
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
