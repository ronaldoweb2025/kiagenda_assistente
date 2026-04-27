const DEFAULT_APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3010";

function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

async function sendPasswordResetEmail(email, resetLink) {
  if (isDevelopmentMode()) {
    console.log(`[auth] Recuperacao de senha para ${email}: ${resetLink}`);
    return {
      delivered: true,
      mode: "console"
    };
  }

  console.warn("[auth] SMTP ainda nao configurado. Email de recuperacao nao foi enviado.");

  return {
    delivered: false,
    mode: "pending_smtp"
  };
}

module.exports = {
  DEFAULT_APP_BASE_URL,
  isDevelopmentMode,
  sendPasswordResetEmail
};
