const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { listTenants, readTenant } = require("../tenancy/tenantConfigStore");
const { changeTenantPlan, createTenant, saveTenant } = require("./tenantService");
const {
  findAuthAccountByEmail,
  findAuthAccountByGoogleId,
  findAuthAccountByTenantId,
  findAuthAccountByWhatsapp,
  normalizeEmail,
  normalizePhone,
  upsertAuthAccount
} = require("../tenancy/authAccountStore");
const {
  listAdminAccessCodes,
  readAdminAccessCode,
  saveAdminAccessCode,
  updateAdminAccessCode
} = require("../tenancy/adminAccessCodeStore");
const {
  readMagicToken,
  saveMagicToken,
  updateMagicToken
} = require("../tenancy/magicTokenStore");
const { DEFAULT_APP_BASE_URL, isDevelopmentMode, sendMagicLinkEmail } = require("./emailService");
const { sendSystemWhatsappMessage } = require("../bot/whatsappSessions");
const { buildClientSession } = require("./sessionTokenService");

const PASSWORD_MIN_LENGTH = 6;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const WHATSAPP_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const WHATSAPP_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const BCRYPT_SALT_ROUNDS = 10;
const GOOGLE_AUTH_MODE_LOGIN = "login";
const GOOGLE_AUTH_MODE_SIGNUP = "signup";
const GOOGLE_AUTH_MODE_CONNECT = "connect";

function resolveAccountAuthProvider(account = {}) {
  const hasGoogle = Boolean(account.googleId || account.google_id);
  const hasPassword = Boolean(account.passwordHash);

  if (hasGoogle && hasPassword) {
    return "local_google";
  }

  if (hasGoogle) {
    return "google";
  }

  return "local";
}

function sanitizeAccount(account = {}) {
  const googleId = account.googleId || account.google_id || "";
  return {
    tenantId: account.tenantId,
    name: account.name,
    businessName: account.businessName,
    whatsapp: account.whatsapp,
    email: account.email,
    authProvider: resolveAccountAuthProvider(account),
    avatarUrl: account.avatarUrl || "",
    googleId,
    google_id: googleId,
    googleLinked: Boolean(googleId),
    whatsappVerified: Boolean(account.whatsappVerified),
    activationStatus: account.activationStatus === "active" ? "active" : "pending"
  };
}

function normalizeTenantIdCandidate(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 24);
}

function buildGoogleTenantId(email, name) {
  const emailPrefix = String(normalizeEmail(email || "").split("@")[0] || "");
  const base = normalizeTenantIdCandidate(name || emailPrefix || "cliente-google") || "cliente-google";
  const hashSuffix = crypto
    .createHash("sha1")
    .update(String(normalizeEmail(email || "")))
    .digest("hex")
    .slice(0, 6);

  return `${base}-${hashSuffix}`;
}

function buildTenantIdAvailability(baseTenantId) {
  const tenantIds = new Set(listTenants().map((tenant) => String(tenant.tenantId || "").trim().toLowerCase()));

  if (!tenantIds.has(baseTenantId.toLowerCase())) {
    return baseTenantId;
  }

  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${baseTenantId}-${index}`;
    if (!tenantIds.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${baseTenantId}-${Date.now().toString().slice(-4)}`;
}

function buildGoogleSessionPayload(account = {}) {
  return buildClientSession(sanitizeAccount(account));
}

function buildMagicLinkUrl(token) {
  return `${DEFAULT_APP_BASE_URL}/auth/magic?token=${encodeURIComponent(token)}`;
}

function buildGenericMagicLinkResponse(devPreview = null) {
  return {
    message: "Se este email estiver cadastrado, enviaremos um link de acesso para sua conta.",
    ...(devPreview ? { devPreview } : {})
  };
}

function getTenantRedirectPath(tenantId) {
  const tenant = readTenant(tenantId);
  const targetPage = tenant.onboardingCompleted === true ? "tenant-edit.html" : "onboarding.html";
  return `/${targetPage}?id=${encodeURIComponent(tenantId)}`;
}

function extractGoogleProfileData(profile = {}) {
  const email = normalizeEmail(
    profile?.emails?.find((item) => item?.verified)?.value ||
    profile?.emails?.[0]?.value ||
    ""
  );

  return {
    email,
    name: String(profile?.displayName || "").trim() || "Cliente Google",
    avatarUrl: String(profile?.photos?.[0]?.value || "").trim(),
    googleId: String(profile?.id || "").trim()
  };
}

function ensureGoogleEmail(profile = {}) {
  const profileData = extractGoogleProfileData(profile);

  if (!profileData.email) {
    const error = new Error("Nao foi possivel identificar o email da conta Google.");
    error.statusCode = 400;
    throw error;
  }

  return profileData;
}

function findClientTenantByWhatsapp(whatsapp) {
  const normalizedWhatsapp = normalizePhone(whatsapp);

  if (!normalizedWhatsapp) {
    return null;
  }

  return listTenants().find((tenant) => {
    return (
      String(tenant.type || "client").toLowerCase() === "client" &&
      normalizePhone(tenant.whatsapp?.number) === normalizedWhatsapp
    );
  }) || null;
}

function assertPasswordConfirmation(newPassword, confirmPassword) {
  if (String(newPassword || "").length < PASSWORD_MIN_LENGTH) {
    const error = new Error("A senha precisa ter pelo menos 6 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (String(newPassword || "") !== String(confirmPassword || "")) {
    const error = new Error("As senhas nao conferem.");
    error.statusCode = 400;
    throw error;
  }
}

async function hashPassword(password) {
  return bcrypt.hash(String(password || ""), BCRYPT_SALT_ROUNDS);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(String(password || ""), String(passwordHash || ""));
}

async function registerAuthAccount(payload = {}) {
  const tenantId = String(payload.tenantId || "").trim();
  const email = normalizeEmail(payload.email);
  const whatsapp = normalizePhone(payload.whatsapp);
  const password = String(payload.password || "");

  if (!tenantId || !email || !whatsapp || !password) {
    const error = new Error("Preencha os campos obrigatorios para criar a conta.");
    error.statusCode = 400;
    throw error;
  }

  assertPasswordConfirmation(password, password);

  const existingEmailAccount = findAuthAccountByEmail(email);
  const existingWhatsappAccount = findAuthAccountByWhatsapp(whatsapp);

  if (existingEmailAccount && existingEmailAccount.whatsappVerified) {
    const error = new Error("Ja existe uma conta cadastrada com esse email.");
    error.statusCode = 409;
    throw error;
  }

  if (
    existingWhatsappAccount &&
    existingWhatsappAccount.whatsappVerified &&
    existingWhatsappAccount.email !== email
  ) {
    const error = new Error("Ja existe uma conta cadastrada com esse WhatsApp.");
    error.statusCode = 409;
    throw error;
  }

  const tenant = readTenant(tenantId);
  const passwordHash = await hashPassword(password);
  const baseAccount = existingWhatsappAccount && !existingWhatsappAccount.whatsappVerified
    ? existingWhatsappAccount
    : existingEmailAccount && !existingEmailAccount.whatsappVerified
      ? existingEmailAccount
      : null;
  const account = upsertAuthAccount({
    ...(baseAccount || {}),
    tenantId,
    name: payload.name || tenant.business?.attendantName || "Responsavel",
    businessName: payload.businessName || tenant.business?.name || "",
    whatsapp,
    email,
    passwordHash,
    whatsappVerified: Boolean(baseAccount?.whatsappVerified),
    activationStatus: baseAccount?.activationStatus === "active" ? "active" : "pending"
  });
  const verificationResult = await issueWhatsappVerificationCode(account, {
    ignoreCooldown: true
  });

  return {
    account: sanitizeAccount(findAuthAccountByTenantId(account.tenantId)),
    verificationResult
  };
}

async function startFirstAccess(payload = {}) {
  const whatsapp = normalizePhone(payload.whatsapp);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const confirmPassword = String(payload.confirmPassword || "");
  const tenant = findClientTenantByWhatsapp(whatsapp);

  if (!tenant) {
    const error = new Error("Nao encontramos um cliente cadastrado com este WhatsApp.");
    error.statusCode = 404;
    throw error;
  }

  const existingAccount = findAuthAccountByWhatsapp(whatsapp) || findAuthAccountByTenantId(tenant.tenantId);

  if (existingAccount) {
    const error = new Error("Este WhatsApp ja possui acesso criado. Use o login ou a recuperacao de senha.");
    error.statusCode = 409;
    throw error;
  }

  if (!email) {
    const error = new Error("Informe um email para concluir seu primeiro acesso.");
    error.statusCode = 400;
    throw error;
  }

  assertPasswordConfirmation(password, confirmPassword);

  const passwordHash = await hashPassword(password);
  const account = upsertAuthAccount({
    tenantId: tenant.tenantId,
    name: tenant.business?.attendantName || "Responsavel",
    businessName: tenant.business?.name || "",
    whatsapp,
    email,
    passwordHash,
    whatsappVerified: true,
    whatsappVerificationCode: "",
    whatsappVerificationExpiresAt: "",
    whatsappVerificationSentAt: "",
    whatsappVerificationUsedAt: new Date().toISOString(),
    activationStatus: "active",
    activationCode: "",
    activationCodeExpiresAt: "",
    activationCodeUsedAt: new Date().toISOString()
  });

  return {
    message: "Primeiro acesso concluido com sucesso. Entre com seu WhatsApp e a nova senha.",
    data: sanitizeAccount(account)
  };
}

async function loginWithPassword(payload = {}) {
  const rawIdentifier = String(payload.email || payload.whatsapp || payload.identifier || "").trim();
  const whatsapp = normalizePhone(rawIdentifier);
  const email = normalizeEmail(rawIdentifier);
  const password = String(payload.password || "");
  const account = rawIdentifier.includes("@")
    ? findAuthAccountByEmail(email)
    : findAuthAccountByWhatsapp(whatsapp);

  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    const error = new Error("Email/WhatsApp ou senha invalidos.");
    error.statusCode = 401;
    throw error;
  }

  if (!account.whatsappVerified) {
    const error = new Error("Seu WhatsApp ainda nao foi verificado.");
    error.statusCode = 403;
    throw error;
  }

  if (account.activationStatus !== "active") {
    const error = new Error("Sua conta ainda nao foi ativada.");
    error.statusCode = 403;
    error.data = sanitizeAccount(account);
    throw error;
  }

  return sanitizeAccount(account);
}

function createGoogleTenantAccount(profileData = {}) {
  const baseTenantId = buildGoogleTenantId(profileData.email, profileData.name);
  const tenantId = buildTenantIdAvailability(baseTenantId);
  const businessName = profileData.name || profileData.email;

  createTenant({
    tenantId,
    type: "client",
    onboardingCompleted: false,
    business: {
      name: businessName,
      attendantName: profileData.name || "Responsavel",
      type: "",
      location: "",
      description: ""
    },
    whatsapp: {
      number: "",
      sessionId: `${tenantId}-session`
    }
  });

  return upsertAuthAccount({
    tenantId,
    name: profileData.name || "Responsavel",
    businessName,
    whatsapp: "",
    email: profileData.email,
    passwordHash: "",
    authProvider: "google",
    googleId: profileData.googleId,
    google_id: profileData.googleId,
    avatarUrl: profileData.avatarUrl,
    whatsappVerified: true,
    whatsappVerificationCode: "",
    whatsappVerificationExpiresAt: "",
    whatsappVerificationSentAt: "",
    whatsappVerificationUsedAt: new Date().toISOString(),
    activationStatus: "active",
    activationCode: "",
    activationCodeExpiresAt: "",
    activationCodeUsedAt: new Date().toISOString()
  });
}

function upsertGoogleIdentity(account, profileData, options = {}) {
  if (!account?.tenantId) {
    const error = new Error("Conta nao encontrada para vincular o Google.");
    error.statusCode = 404;
    throw error;
  }

  const currentEmail = normalizeEmail(account.email);
  const googleEmail = normalizeEmail(profileData.email);

  if (options.requireSameEmail && currentEmail && currentEmail !== googleEmail) {
    const error = new Error("Use a mesma conta de email cadastrada para conectar o Google.");
    error.statusCode = 409;
    throw error;
  }

  const nextAccount = upsertAuthAccount({
    ...account,
    email: currentEmail || googleEmail,
    name: profileData.name || account.name,
    businessName: account.businessName || profileData.name || profileData.email,
    authProvider: resolveAccountAuthProvider({
      ...account,
      googleId: profileData.googleId || account.googleId || account.google_id
    }),
    googleId: profileData.googleId || account.googleId || account.google_id,
    google_id: profileData.googleId || account.googleId || account.google_id,
    avatarUrl: profileData.avatarUrl || account.avatarUrl,
    whatsappVerified: Boolean(account.whatsappVerified) || !account.whatsapp,
    activationStatus: "active",
    activationCode: account.activationCode || "",
    activationCodeExpiresAt: account.activationCodeExpiresAt || "",
    activationCodeUsedAt: account.activationCodeUsedAt || new Date().toISOString()
  });

  return nextAccount;
}

function buildGoogleAuthResult(account, action) {
  return {
    action,
    account: sanitizeAccount(account),
    session: buildGoogleSessionPayload(account)
  };
}

async function authenticateWithGoogleProfile(profile = {}, options = {}) {
  const profileData = ensureGoogleEmail(profile);
  const mode = String(options.mode || GOOGLE_AUTH_MODE_LOGIN).trim().toLowerCase();
  const tenantId = String(options.tenantId || "").trim();
  const accountByGoogleId = profileData.googleId ? findAuthAccountByGoogleId(profileData.googleId) : null;
  const accountByEmail = findAuthAccountByEmail(profileData.email);

  if (mode === GOOGLE_AUTH_MODE_CONNECT) {
    const tenantAccount = findAuthAccountByTenantId(tenantId);

    if (!tenantAccount) {
      const error = new Error("Conta nao encontrada para conectar ao Google.");
      error.statusCode = 404;
      throw error;
    }

    if (accountByGoogleId && accountByGoogleId.tenantId !== tenantAccount.tenantId) {
      const error = new Error("Esta conta Google ja esta conectada a outro cadastro.");
      error.statusCode = 409;
      throw error;
    }

    if (accountByEmail && accountByEmail.tenantId !== tenantAccount.tenantId) {
      const error = new Error("Este email Google ja pertence a outra conta do sistema.");
      error.statusCode = 409;
      throw error;
    }

    return buildGoogleAuthResult(
      upsertGoogleIdentity(tenantAccount, profileData, {
        requireSameEmail: true
      }),
      "connected"
    );
  }

  if (accountByGoogleId && accountByEmail && accountByGoogleId.tenantId !== accountByEmail.tenantId) {
    const error = new Error("Encontramos conflito entre este Google e outro cadastro existente.");
    error.statusCode = 409;
    throw error;
  }

  if (accountByGoogleId) {
    return buildGoogleAuthResult(
      upsertGoogleIdentity(accountByGoogleId, profileData),
      "logged_in"
    );
  }

  if (accountByEmail) {
    return buildGoogleAuthResult(
      upsertGoogleIdentity(accountByEmail, profileData),
      "linked_existing"
    );
  }

  return buildGoogleAuthResult(
    createGoogleTenantAccount(profileData),
    mode === GOOGLE_AUTH_MODE_SIGNUP ? "created" : "created_from_login"
  );
}

async function loginWithGoogleProfile(profile = {}) {
  return authenticateWithGoogleProfile(profile, {
    mode: GOOGLE_AUTH_MODE_LOGIN
  });
}

async function requestMagicLink(payload = {}) {
  const email = normalizeEmail(payload.email);

  if (!email) {
    return buildGenericMagicLinkResponse();
  }

  const account = findAuthAccountByEmail(email);

  if (!account) {
    return buildGenericMagicLinkResponse();
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
  const magicLink = buildMagicLinkUrl(token);

  saveMagicToken(token, {
    token,
    email: account.email,
    tenantId: account.tenantId,
    used: false,
    createdAt: new Date().toISOString(),
    expiresAt
  });

  await sendMagicLinkEmail({
    email: account.email,
    recipientName: account.name || account.businessName || "cliente",
    magicLink,
    expiresMinutes: 15
  });

  if (!isDevelopmentMode()) {
    return buildGenericMagicLinkResponse();
  }

  return buildGenericMagicLinkResponse({
    magicLink,
    token,
    expiresAt
  });
}

function isMagicTokenExpired(tokenEntry) {
  return !tokenEntry?.expiresAt || new Date(tokenEntry.expiresAt).getTime() <= Date.now();
}

async function consumeMagicLinkToken(token) {
  const normalizedToken = String(token || "").trim();
  const tokenEntry = readMagicToken(normalizedToken);

  if (!tokenEntry || tokenEntry.used || isMagicTokenExpired(tokenEntry)) {
    const error = new Error("Link invalido ou expirado.");
    error.statusCode = 400;
    throw error;
  }

  const account = findAuthAccountByEmail(tokenEntry.email);

  if (!account) {
    const error = new Error("Conta nao encontrada para este link.");
    error.statusCode = 404;
    throw error;
  }

  updateMagicToken(normalizedToken, {
    ...tokenEntry,
    used: true,
    usedAt: new Date().toISOString()
  });

  return {
    account: sanitizeAccount(account),
    session: buildClientSession(account)
  };
}

function generateAdminAccessCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function isAdminAccessCodeExpired(codeEntry) {
  return !codeEntry?.expiresAt || new Date(codeEntry.expiresAt).getTime() <= Date.now();
}

function resolveActivationExpiresAt(validityDays) {
  const normalized = String(validityDays || "").trim().toLowerCase();

  if (normalized === "none" || normalized === "sem_expiracao" || normalized === "never") {
    return "";
  }

  const days = Number(validityDays);

  if (![7, 15, 30].includes(days)) {
    const error = new Error("Validade invalida para o codigo de ativacao.");
    error.statusCode = 400;
    throw error;
  }

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeMaxUses(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "multiple" || normalized === "ilimitado" || normalized === "unlimited") {
    return null;
  }

  return 1;
}

function getActivationCodeStatusLabel(codeEntry = {}) {
  if (codeEntry.status !== "active") {
    return "inactive";
  }

  if (codeEntry.expiresAt && isAdminAccessCodeExpired(codeEntry)) {
    return "expired";
  }

  if (codeEntry.maxUses !== null && Number(codeEntry.usedCount || 0) >= Number(codeEntry.maxUses || 0)) {
    return "exhausted";
  }

  return "active";
}

function mapActivationCode(codeEntry = {}) {
  const usedCount = Number(codeEntry.usedCount || 0);
  const maxUses = codeEntry.maxUses === null ? null : Number(codeEntry.maxUses || 1);

  return {
    code: codeEntry.code,
    plan: codeEntry.plan,
    status: getActivationCodeStatusLabel(codeEntry),
    expiresAt: codeEntry.expiresAt || "",
    maxUses,
    usedCount,
    usesRemaining: maxUses === null ? null : Math.max(0, maxUses - usedCount),
    usedBy: Array.isArray(codeEntry.usedBy) ? codeEntry.usedBy : [],
    createdAt: codeEntry.createdAt
  };
}

async function createActivationCode(payload = {}) {
  const code = generateAdminAccessCode();
  const expiresAt = resolveActivationExpiresAt(payload.validityDays);
  const activationCode = saveAdminAccessCode(code, {
    code,
    plan: payload.plan,
    status: "active",
    expiresAt,
    maxUses: normalizeMaxUses(payload.maxUses),
    usedCount: 0,
    usedBy: [],
    createdAt: new Date().toISOString()
  });

  return {
    message: "Codigo de ativacao gerado com sucesso.",
    data: mapActivationCode(activationCode)
  };
}

function getActivationCodeList() {
  return listAdminAccessCodes().map((item) => mapActivationCode(item));
}

function deactivateActivationCode(payload = {}) {
  const code = String(payload.code || "").trim().toUpperCase();
  const currentCode = readAdminAccessCode(code);

  if (!currentCode) {
    const error = new Error("Codigo de ativacao nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const nextCode = updateAdminAccessCode(code, {
    ...currentCode,
    status: "inactive"
  });

  return {
    message: "Codigo de ativacao desativado com sucesso.",
    data: mapActivationCode(nextCode)
  };
}

async function loginWithAdminCode(payload = {}) {
  const error = new Error("Use o codigo na tela de ativacao da conta.");
  error.statusCode = 400;
  throw error;
}

async function activateAccountWithCode(payload = {}) {
  const whatsapp = normalizePhone(payload.whatsapp);
  const code = String(payload.code || "").trim().toUpperCase();
  const account = findAuthAccountByWhatsapp(whatsapp);
  const codeEntry = readAdminAccessCode(code);

  if (
    !account ||
    !account.whatsappVerified ||
    !codeEntry ||
    getActivationCodeStatusLabel(codeEntry) !== "active"
  ) {
    const error = new Error("Codigo invalido ou expirado.");
    error.statusCode = 400;
    throw error;
  }

  const nextUsedCount = Number(codeEntry.usedCount || 0) + 1;
  const nextUsedBy = [...(Array.isArray(codeEntry.usedBy) ? codeEntry.usedBy : []), {
    tenantId: account.tenantId,
    whatsapp,
    usedAt: new Date().toISOString()
  }];
  const nextAccount = upsertAuthAccount({
    ...account,
    activationStatus: "active",
    activationCode: code,
    activationCodeExpiresAt: codeEntry.expiresAt || "",
    activationCodeUsedAt: new Date().toISOString()
  });
  changeTenantPlan(account.tenantId, codeEntry.plan, "active");

  updateAdminAccessCode(code, {
    ...codeEntry,
    usedCount: nextUsedCount,
    usedBy: nextUsedBy
  });

  return {
    message: "Conta ativada com sucesso.",
    data: sanitizeAccount(findAuthAccountByTenantId(nextAccount.tenantId))
  };
}

function buildWhatsappVerificationMessage(code) {
  return (
    `Seu codigo de verificacao do KiAgenda e: ${code}\n` +
    "Esse codigo expira em 10 minutos."
  );
}

function isWhatsappVerificationExpired(account = {}) {
  return (
    !account?.whatsappVerificationExpiresAt ||
    new Date(account.whatsappVerificationExpiresAt).getTime() <= Date.now()
  );
}

async function issueWhatsappVerificationCode(account, options = {}) {
  const currentAccount = account || {};
  const sentAtTimestamp = currentAccount.whatsappVerificationSentAt
    ? new Date(currentAccount.whatsappVerificationSentAt).getTime()
    : 0;
  const nextAvailableAt = sentAtTimestamp + WHATSAPP_VERIFICATION_RESEND_COOLDOWN_MS;

  if (!options.ignoreCooldown && sentAtTimestamp && nextAvailableAt > Date.now()) {
    const retryAfterSeconds = Math.ceil((nextAvailableAt - Date.now()) / 1000);
    const error = new Error(`Aguarde ${retryAfterSeconds}s para reenviar o codigo.`);
    error.statusCode = 429;
    throw error;
  }

  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + WHATSAPP_VERIFICATION_TTL_MS).toISOString();
  const sentAt = new Date().toISOString();

  const nextAccount = upsertAuthAccount({
    ...currentAccount,
    whatsappVerificationCode: code,
    whatsappVerificationExpiresAt: expiresAt,
    whatsappVerificationSentAt: sentAt,
    whatsappVerificationUsedAt: ""
  });

  let delivered = false;

  try {
    delivered = await sendSystemWhatsappMessage(
      nextAccount.whatsapp,
      buildWhatsappVerificationMessage(code),
      {
        preferredTenantId: nextAccount.tenantId,
        purpose: "codigo de verificacao de cadastro"
      }
    );
  } catch (error) {
    console.error("Falha ao enviar codigo de verificacao do cadastro por WhatsApp:", error);
  }

  if (!delivered) {
    console.warn(
      `[auth] Codigo de verificacao do cadastro nao foi entregue para ${nextAccount.whatsapp}.`,
      {
        tenantId: nextAccount.tenantId
      }
    );
  }

  if (!delivered && isDevelopmentMode()) {
    console.log(`[auth] Codigo de verificacao de cadastro para ${nextAccount.whatsapp}: ${code}`);
  }

  return {
    delivered,
    expiresAt,
    retryAfterSeconds: Math.ceil(WHATSAPP_VERIFICATION_RESEND_COOLDOWN_MS / 1000),
    devPreview: !delivered && isDevelopmentMode() ? { code, expiresAt } : null
  };
}

async function resendWhatsappVerificationCode(payload = {}) {
  const whatsapp = normalizePhone(payload.whatsapp);
  const account = findAuthAccountByWhatsapp(whatsapp);

  if (!account) {
    const error = new Error("Conta nao encontrada para este WhatsApp.");
    error.statusCode = 404;
    throw error;
  }

  if (account.whatsappVerified) {
    return {
      message: "Este WhatsApp ja foi verificado.",
      data: sanitizeAccount(account)
    };
  }

  const verificationResult = await issueWhatsappVerificationCode(account);

  return {
    message: verificationResult.delivered
      ? "Enviamos um codigo para seu WhatsApp. Digite abaixo para confirmar sua conta."
      : "Nao conseguimos enviar o codigo agora. Tente novamente em alguns minutos ou fale com o suporte.",
    verificationSent: verificationResult.delivered,
    devPreview: verificationResult.devPreview,
    retryAfterSeconds: verificationResult.retryAfterSeconds
  };
}

async function verifyWhatsappRegistration(payload = {}) {
  const whatsapp = normalizePhone(payload.whatsapp);
  const code = String(payload.code || "").trim();
  const account = findAuthAccountByWhatsapp(whatsapp);

  if (
    !account ||
    account.whatsappVerified ||
    !account.whatsappVerificationCode ||
    account.whatsappVerificationCode !== code ||
    isWhatsappVerificationExpired(account)
  ) {
    const error = new Error("Codigo invalido ou expirado.");
    error.statusCode = 400;
    throw error;
  }

  const nextAccount = upsertAuthAccount({
    ...account,
    whatsappVerified: true,
    whatsappVerificationCode: "",
    whatsappVerificationExpiresAt: "",
    whatsappVerificationUsedAt: new Date().toISOString()
  });

  return {
    message: "WhatsApp confirmado com sucesso. Sua conta esta liberada.",
    data: sanitizeAccount(nextAccount)
  };
}

async function updatePasswordByTenant(payload = {}) {
  const tenantId = String(payload.tenantId || "").trim();
  const account = findAuthAccountByTenantId(tenantId);

  if (!account) {
    const error = new Error("Conta nao encontrada para este cliente.");
    error.statusCode = 404;
    throw error;
  }

  assertPasswordConfirmation(payload.newPassword, payload.confirmPassword);

  const passwordHash = await hashPassword(payload.newPassword);
  const nextAccount = upsertAuthAccount({
    ...account,
    passwordHash
  });

  return sanitizeAccount(nextAccount);
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isCodeExpired(codeEntry) {
  return !codeEntry?.expiresAt || new Date(codeEntry.expiresAt).getTime() <= Date.now();
}

module.exports = {
  activateAccountWithCode,
  authenticateWithGoogleProfile,
  buildGoogleSessionPayload,
  consumeMagicLinkToken,
  createActivationCode,
  deactivateActivationCode,
  getActivationCodeList,
  getTenantRedirectPath,
  GOOGLE_AUTH_MODE_CONNECT,
  GOOGLE_AUTH_MODE_LOGIN,
  GOOGLE_AUTH_MODE_SIGNUP,
  loginWithGoogleProfile,
  loginWithAdminCode,
  loginWithPassword,
  requestMagicLink,
  registerAuthAccount,
  resendWhatsappVerificationCode,
  sanitizeAccount,
  startFirstAccess,
  updatePasswordByTenant,
  verifyWhatsappRegistration
};
