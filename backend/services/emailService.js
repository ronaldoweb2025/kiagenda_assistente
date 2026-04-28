const nodemailer = require("nodemailer");

const DEFAULT_APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3010";

function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

function canSendEmail() {
  const user = String(process.env.EMAIL_USER || "").trim();
  const pass = String(process.env.EMAIL_PASS || "").trim();

  if (!user || !pass) {
    return false;
  }

  if (user === "seu@gmail.com" || pass === "senha_app_gmail") {
    return false;
  }

  return true;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

function buildMagicLinkEmailHtml({ recipientName, magicLink, expiresMinutes = 15 }) {
  const safeName = String(recipientName || "cliente").trim() || "cliente";

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seu acesso ao KiAgenda</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:32px;background:linear-gradient(135deg,#16346b 0%,#0f2a5f 100%);color:#ffffff;">
                <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(134,239,172,0.16);color:#86efac;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">KiAgenda</div>
                <h1 style="margin:18px 0 10px;font-size:28px;line-height:1.15;">Acesse sua conta com um clique</h1>
                <p style="margin:0;color:rgba(219,234,254,0.92);font-size:15px;line-height:1.7;">Olá, ${safeName}. Recebemos uma solicitação para entrar na sua conta do KiAgenda.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">Use o botão abaixo para acessar sua conta com segurança. Este link expira em <strong>${expiresMinutes} minutos</strong>.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="border-radius:14px;background:linear-gradient(180deg,#f97316 0%,#16a34a 100%);">
                      <a href="${magicLink}" style="display:inline-block;padding:16px 26px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;">Acessar minha conta →</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#475569;">Se o botão não abrir, copie e cole este link no navegador:</p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.7;word-break:break-all;color:#2563eb;">${magicLink}</p>
                <div style="padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">Se não foi você, ignore este email. Nenhuma alteração será feita na sua conta.</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendMagicLinkEmail({ email, recipientName, magicLink, expiresMinutes = 15 }) {
  if (!canSendEmail()) {
    if (isDevelopmentMode()) {
      console.log(`[auth] Magic Link para ${email}: ${magicLink}`);
      return {
        delivered: true,
        mode: "console"
      };
    }

    console.warn("[auth] EMAIL_USER/EMAIL_PASS nao configurados. Magic Link nao foi enviado.");
    return {
      delivered: false,
      mode: "smtp_missing"
    };
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"KiAgenda" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Seu acesso ao KiAgenda",
    html: buildMagicLinkEmailHtml({
      recipientName,
      magicLink,
      expiresMinutes
    })
  });

  return {
    delivered: true,
    mode: "gmail"
  };
}

module.exports = {
  DEFAULT_APP_BASE_URL,
  canSendEmail,
  isDevelopmentMode,
  sendMagicLinkEmail
};
