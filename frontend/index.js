const authElements = {
  authFeedback: document.getElementById("authFeedback"),
  loginView: document.getElementById("loginView"),
  firstAccessView: document.getElementById("firstAccessView"),
  forgotPasswordView: document.getElementById("forgotPasswordView"),
  registerView: document.getElementById("registerView"),
  activationView: document.getElementById("activationView"),
  loginForm: document.getElementById("loginForm"),
  loginWhatsapp: document.getElementById("loginWhatsapp"),
  loginPassword: document.getElementById("loginPassword"),
  googleLoginButton: document.getElementById("googleLoginButton"),
  openRegisterButton: document.getElementById("openRegisterButton"),
  firstAccessButton: document.getElementById("firstAccessButton"),
  forgotPasswordButton: document.getElementById("forgotPasswordButton"),
  firstAccessForm: document.getElementById("firstAccessForm"),
  firstAccessWhatsapp: document.getElementById("firstAccessWhatsapp"),
  firstAccessEmail: document.getElementById("firstAccessEmail"),
  firstAccessPassword: document.getElementById("firstAccessPassword"),
  firstAccessConfirmPassword: document.getElementById("firstAccessConfirmPassword"),
  backToLoginFromFirstAccessButton: document.getElementById("backToLoginFromFirstAccessButton"),
  forgotPasswordForm: document.getElementById("forgotPasswordForm"),
  forgotPasswordEmail: document.getElementById("forgotPasswordEmail"),
  forgotPasswordDevPanel: document.getElementById("forgotPasswordDevPanel"),
  forgotPasswordDevLink: document.getElementById("forgotPasswordDevLink"),
  backToLoginFromForgotButton: document.getElementById("backToLoginFromForgotButton"),
  registerForm: document.getElementById("registerForm"),
  registerName: document.getElementById("registerName"),
  registerBusinessName: document.getElementById("registerBusinessName"),
  registerWhatsapp: document.getElementById("registerWhatsapp"),
  registerEmail: document.getElementById("registerEmail"),
  registerPassword: document.getElementById("registerPassword"),
  registerPasswordConfirm: document.getElementById("registerPasswordConfirm"),
  backToLoginButton: document.getElementById("backToLoginButton"),
  registerVerificationForm: document.getElementById("registerVerificationForm"),
  registerVerificationCode: document.getElementById("registerVerificationCode"),
  resendRegisterVerificationButton: document.getElementById("resendRegisterVerificationButton"),
  registerVerificationDevPanel: document.getElementById("registerVerificationDevPanel"),
  registerVerificationDevCode: document.getElementById("registerVerificationDevCode"),
  activationForm: document.getElementById("activationForm"),
  activationCode: document.getElementById("activationCode")
};

const authState = {
  forgotPasswordEmail: "",
  legacyAccounts: KiagendaApp.getLegacyAuthAccounts(),
  pendingRegistration: null,
  registerVerificationCooldownUntil: 0,
  pendingActivation: KiagendaApp.getPendingActivation(),
  currentView: null
};

function setFeedback(message, type = "success") {
  authElements.authFeedback.textContent = message || "";
  authElements.authFeedback.classList.toggle("is-error", type === "error");
  authElements.authFeedback.classList.toggle("is-success", Boolean(message) && type !== "error");
}

function showAuthView(viewName) {
  authState.currentView = viewName;
  const isLogin = viewName === "login";
  const isFirstAccess = viewName === "first-access";
  const isForgotPassword = viewName === "forgot";
  const isRegister = viewName === "register";
  const isActivation = viewName === "activation";

  authElements.loginView.classList.toggle("hidden-view", !isLogin);
  authElements.firstAccessView.classList.toggle("hidden-view", !isFirstAccess);
  authElements.forgotPasswordView.classList.toggle("hidden-view", !isForgotPassword);
  authElements.registerView.classList.toggle("hidden-view", !isRegister);
  authElements.activationView.classList.toggle("hidden-view", !isActivation);

  setFeedback("");

  if (isLogin) {
    authElements.loginWhatsapp.focus();
    return;
  }

  if (isRegister) {
    authElements.registerForm.classList.toggle("hidden-view", Boolean(authState.pendingRegistration));
    authElements.registerVerificationForm.classList.toggle("hidden-view", !authState.pendingRegistration);
    authElements.registerWhatsapp.value = KiagendaApp.normalizePhone(
      authElements.registerWhatsapp.value || authElements.loginWhatsapp.value
    );

    if (authState.pendingRegistration) {
      updateRegisterVerificationButton();
      authElements.registerVerificationCode.focus();
      return;
    }

    authElements.registerName.focus();
    return;
  }

  if (isFirstAccess) {
    authElements.firstAccessWhatsapp.value = KiagendaApp.normalizePhone(
      authElements.firstAccessWhatsapp.value || authElements.loginWhatsapp.value
    );
    authElements.firstAccessWhatsapp.focus();
    return;
  }

  if (isForgotPassword) {
    authElements.forgotPasswordEmail.focus();
    return;
  }

  if (isActivation) {
    authElements.activationCode.focus();
    return;
  }
}

function buildTenantIdCandidate(businessName, whatsapp) {
  const normalizedBusiness = KiagendaApp.normalizeTenantId(businessName).slice(0, 24) || "cliente";
  const normalizedPhone = KiagendaApp.normalizePhone(whatsapp);
  const suffix = normalizedPhone.slice(-4) || "0001";
  return `${normalizedBusiness}-${suffix}`;
}

async function buildUniqueTenantId(businessName, whatsapp) {
  const response = await KiagendaApp.requestJson("/api/tenants");
  const existingIds = new Set((response.items || []).map((item) => item.tenantId));
  const baseId = buildTenantIdCandidate(businessName, whatsapp);

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index <= 99; index += 1) {
    const candidateId = `${baseId}-${index}`;
    if (!existingIds.has(candidateId)) {
      return candidateId;
    }
  }

  throw new Error("Nao foi possivel criar um codigo unico para este cliente.");
}

function clearRegisterVerificationPreview() {
  authElements.registerVerificationDevPanel.classList.add("hidden-view");
  authElements.registerVerificationDevCode.textContent = "";
}

function clearMagicLinkPreview() {
  authElements.forgotPasswordDevPanel.classList.add("hidden-view");
  authElements.forgotPasswordDevLink.textContent = "";
  authElements.forgotPasswordDevLink.removeAttribute("href");
}

function renderMagicLinkPreview(devPreview) {
  if (!devPreview?.magicLink) {
    clearMagicLinkPreview();
    return;
  }

  authElements.forgotPasswordDevPanel.classList.remove("hidden-view");
  authElements.forgotPasswordDevLink.textContent = devPreview.magicLink;
  authElements.forgotPasswordDevLink.href = devPreview.magicLink;
}

function renderRegisterVerificationPreview(devPreview) {
  if (!devPreview?.code) {
    clearRegisterVerificationPreview();
    return;
  }

  authElements.registerVerificationDevPanel.classList.remove("hidden-view");
  authElements.registerVerificationDevCode.textContent = `Codigo de teste: ${devPreview.code}`;
}

function setRegisterVerificationCooldown(seconds) {
  authState.registerVerificationCooldownUntil = Date.now() + Math.max(0, Number(seconds || 0)) * 1000;
  updateRegisterVerificationButton();
}

function updateRegisterVerificationButton() {
  if (!authState.pendingRegistration) {
    authElements.resendRegisterVerificationButton.disabled = false;
    authElements.resendRegisterVerificationButton.textContent = "Reenviar codigo";
    return;
  }

  const remainingMs = authState.registerVerificationCooldownUntil - Date.now();

  if (remainingMs <= 0) {
    authElements.resendRegisterVerificationButton.disabled = false;
    authElements.resendRegisterVerificationButton.textContent = "Reenviar codigo";
    return;
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  authElements.resendRegisterVerificationButton.disabled = true;
  authElements.resendRegisterVerificationButton.textContent = `Reenviar em ${remainingSeconds}s`;
  window.setTimeout(updateRegisterVerificationButton, 1000);
}

async function redirectToTenantHome(tenantId) {
  const tenant = await KiagendaApp.requestJson(`/api/tenants/${tenantId}`);
  const targetPage = tenant.onboardingCompleted === true ? "tenant-edit.html" : "onboarding.html";
  window.location.href = `${targetPage}?id=${encodeURIComponent(tenantId)}`;
}

function resetRegisterForm() {
  authElements.registerName.value = "";
  authElements.registerBusinessName.value = "";
  authElements.registerWhatsapp.value = "";
  authElements.registerEmail.value = "";
  authElements.registerPassword.value = "";
  authElements.registerPasswordConfirm.value = "";
  authElements.registerVerificationCode.value = "";
  clearRegisterVerificationPreview();
  authState.pendingRegistration = null;
  authState.registerVerificationCooldownUntil = 0;
}

function resetFirstAccessForm() {
  authElements.firstAccessWhatsapp.value = "";
  authElements.firstAccessEmail.value = "";
  authElements.firstAccessPassword.value = "";
  authElements.firstAccessConfirmPassword.value = "";
}

function setPendingActivation(account) {
  if (!account) {
    authState.pendingActivation = null;
    KiagendaApp.clearPendingActivation();
    return;
  }

  authState.pendingActivation = {
    tenantId: account.tenantId,
    whatsapp: account.whatsapp,
    activationStatus: account.activationStatus || "pending"
  };
  KiagendaApp.savePendingActivation(authState.pendingActivation);
}

function saveAuthenticatedSession(account, session = null) {
  KiagendaApp.saveAuthSession(
    session || {
      tenantId: account.tenantId,
      whatsapp: account.whatsapp,
      email: account.email,
      name: account.name,
      activationStatus: account.activationStatus || "active",
      authProvider: account.authProvider || "local",
      avatarUrl: account.avatarUrl || "",
      token: account.token || ""
    }
  );
}

async function handleLogin(event) {
  event.preventDefault();

  const identifier = String(authElements.loginWhatsapp.value || "").trim();
  const whatsapp = KiagendaApp.normalizePhone(identifier);
  const password = authElements.loginPassword.value;
  let account;

  try {
    const response = await KiagendaApp.requestJson("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        identifier,
        password
      })
    });
    account = response.data;
    saveAuthenticatedSession(account, response.session || null);
  } catch (error) {
    if (error.data?.activationStatus && error.data.activationStatus !== "active") {
      setPendingActivation(error.data);
      showAuthView("activation");
      setFeedback(error.message || "Sua conta ainda nao foi ativada.", "error");
      return;
    }

    const legacyAccount = authState.legacyAccounts.find((item) => {
      return KiagendaApp.normalizePhone(item.whatsapp) === whatsapp && String(item.password || "") === password;
    });

    if (!legacyAccount) {
      throw error;
    }

    const migrateResponse = await KiagendaApp.requestJson("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tenantId: legacyAccount.tenantId,
        name: legacyAccount.name,
        businessName: legacyAccount.businessName,
        whatsapp: legacyAccount.whatsapp,
        email: legacyAccount.email,
        password: legacyAccount.password
      })
    });

    authState.pendingRegistration = {
      tenantId: legacyAccount.tenantId,
      whatsapp: legacyAccount.whatsapp,
      businessName: legacyAccount.businessName
    };
    renderRegisterVerificationPreview(migrateResponse.devPreview || null);
    setRegisterVerificationCooldown(migrateResponse.retryAfterSeconds || 60);
    showAuthView("register");
    throw new Error(migrateResponse.message || "Enviamos um codigo para seu WhatsApp. Digite abaixo para confirmar sua conta.");
  }
  setPendingActivation(null);

  setFeedback("Entrada realizada com sucesso.");
  await redirectToTenantHome(account.tenantId);
}

async function handleRegister(event) {
  event.preventDefault();

  const name = authElements.registerName.value.trim();
  const businessName = authElements.registerBusinessName.value.trim();
  const whatsapp = KiagendaApp.normalizePhone(authElements.registerWhatsapp.value);
  const email = authElements.registerEmail.value.trim().toLowerCase();
  const password = authElements.registerPassword.value;
  const passwordConfirm = authElements.registerPasswordConfirm.value;

  if (!name || !businessName || !whatsapp || !email || !password || !passwordConfirm) {
    throw new Error("Preencha todos os campos para criar sua conta.");
  }

  if (password !== passwordConfirm) {
    throw new Error("As senhas nao conferem.");
  }

  const tenantId = await buildUniqueTenantId(businessName, whatsapp);

  await KiagendaApp.requestJson("/api/tenants", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenantId,
      type: "client",
      business: {
        name: businessName,
        type: "",
        attendantName: name
      },
      whatsapp: {
        number: whatsapp,
        sessionId: `${tenantId}-session`
      }
    })
  });

  const authResponse = await KiagendaApp.requestJson("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenantId,
      name,
      businessName,
      whatsapp,
      email,
      password
    })
  });
  authState.pendingRegistration = {
    tenantId,
    whatsapp,
    businessName
  };
  authState.legacyAccounts = authState.legacyAccounts.filter((item) => item.email !== email && item.whatsapp !== whatsapp);
  authState.legacyAccounts.push({
    tenantId,
    name,
    businessName,
    whatsapp,
    email,
    password
  });
  KiagendaApp.saveLegacyAuthAccounts(authState.legacyAccounts);
  renderRegisterVerificationPreview(authResponse.devPreview || null);
  setRegisterVerificationCooldown(authResponse.retryAfterSeconds || 60);
  showAuthView("register");
  setFeedback(authResponse.message || "Enviamos um codigo para seu WhatsApp. Digite abaixo para confirmar sua conta.");
}

async function handleRegisterVerification(event) {
  event.preventDefault();

  if (!authState.pendingRegistration?.whatsapp) {
    throw new Error("Nao encontramos um cadastro pendente para confirmar.");
  }

  const response = await KiagendaApp.requestJson("/api/auth/verify-whatsapp-registration", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      whatsapp: authState.pendingRegistration.whatsapp,
      code: authElements.registerVerificationCode.value.trim()
    })
  });
  const account = response.data;
  setPendingActivation(account);
  resetRegisterForm();
  authState.pendingRegistration = null;
  showAuthView("activation");
  setFeedback("Digite o codigo de ativacao recebido para liberar seu acesso ao KiAgenda Assistente.");
}

async function handleResendRegisterVerification() {
  if (!authState.pendingRegistration?.whatsapp) {
    throw new Error("Nao encontramos um cadastro pendente para reenviar.");
  }

  const response = await KiagendaApp.requestJson("/api/auth/resend-whatsapp-verification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      whatsapp: authState.pendingRegistration.whatsapp
    })
  });

  renderRegisterVerificationPreview(response.devPreview || null);
  setRegisterVerificationCooldown(response.retryAfterSeconds || 60);
  setFeedback(response.message || "Enviamos um codigo para seu WhatsApp. Digite abaixo para confirmar sua conta.");
}

async function handleActivateAccount(event) {
  event.preventDefault();

  if (!authState.pendingActivation?.whatsapp) {
    throw new Error("Nao encontramos uma conta pendente de ativacao.");
  }

  const response = await KiagendaApp.requestJson("/api/auth/activate-account", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      whatsapp: authState.pendingActivation.whatsapp,
      code: authElements.activationCode.value.trim().toUpperCase()
    })
  });
  const account = response.data;

  saveAuthenticatedSession(account, response.session || null);
  setPendingActivation(null);
  authElements.activationCode.value = "";
  setFeedback(response.message || "Conta ativada com sucesso.");
  await redirectToTenantHome(account.tenantId);
}

async function handleFirstAccess(event) {
  event.preventDefault();

  const whatsapp = KiagendaApp.normalizePhone(authElements.firstAccessWhatsapp.value);
  const email = authElements.firstAccessEmail.value.trim().toLowerCase();
  const password = authElements.firstAccessPassword.value;
  const confirmPassword = authElements.firstAccessConfirmPassword.value;

  const response = await KiagendaApp.requestJson("/api/auth/first-access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      whatsapp,
      email,
      password,
      confirmPassword
    })
  });

  resetFirstAccessForm();
  showAuthView("login");
  authElements.loginWhatsapp.value = whatsapp;
  setFeedback(response.message || "Primeiro acesso concluido com sucesso. Faca login para continuar.");
}

async function handleForgotPassword(event) {
  event.preventDefault();

  const email = String(authElements.forgotPasswordEmail.value || "").trim().toLowerCase();
  const response = await KiagendaApp.requestJson("/api/auth/magic-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email
    })
  });

  authState.forgotPasswordEmail = email;
  renderMagicLinkPreview(response.devPreview || null);
  setFeedback(response.message || "Se este email estiver cadastrado, enviaremos um link de acesso para sua conta.");
}

async function restoreSession() {
  if (authState.pendingActivation?.activationStatus && authState.pendingActivation.activationStatus !== "active") {
    showAuthView("activation");
    return "activation";
  }

  const session = KiagendaApp.getAuthSession();

  if (!session?.tenantId) {
    showAuthView("login");
    return "login";
  }

  if (!session.activationStatus) {
    session.activationStatus = "active";
    KiagendaApp.saveAuthSession(session);
  }

  if (!KiagendaApp.isAccountActive(session)) {
    setPendingActivation(session);
    showAuthView("activation");
    return "activation";
  }

  try {
    await redirectToTenantHome(session.tenantId);
    return "redirect";
  } catch (error) {
    KiagendaApp.clearAuthSession();
    showAuthView("login");
    return "login";
  }
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setFeedback(error.message || "Nao foi possivel concluir esta acao.", "error");
  }
}

async function initializeGoogleLogin() {
  try {
    const response = await KiagendaApp.requestJson("/auth/google/status");
    authElements.googleLoginButton.classList.toggle("hidden-view", !response.enabled);
  } catch (error) {
    authElements.googleLoginButton.classList.add("hidden-view");
  }
}

authElements.openRegisterButton.addEventListener("click", () => showAuthView("register"));
authElements.firstAccessButton.addEventListener("click", () => showAuthView("first-access"));
authElements.backToLoginButton.addEventListener("click", () => {
  resetRegisterForm();
  showAuthView("login");
});
authElements.backToLoginFromFirstAccessButton.addEventListener("click", () => {
  resetFirstAccessForm();
  showAuthView("login");
});
authElements.backToLoginFromForgotButton.addEventListener("click", () => {
  authState.forgotPasswordEmail = "";
  authElements.forgotPasswordEmail.value = "";
  clearMagicLinkPreview();
  showAuthView("login");
});
authElements.googleLoginButton.addEventListener("click", () => {
  window.location.href = "/auth/google";
});
authElements.forgotPasswordButton.addEventListener("click", () => {
  authState.forgotPasswordEmail = "";
  authElements.forgotPasswordEmail.value = "";
  clearMagicLinkPreview();
  showAuthView("forgot");
});
authElements.loginForm.addEventListener("submit", (event) => runAction(() => handleLogin(event)));
authElements.firstAccessForm.addEventListener("submit", (event) => runAction(() => handleFirstAccess(event)));
authElements.forgotPasswordForm.addEventListener("submit", (event) => runAction(() => handleForgotPassword(event)));
authElements.registerForm.addEventListener("submit", (event) => runAction(() => handleRegister(event)));
authElements.registerVerificationForm.addEventListener("submit", (event) => runAction(() => handleRegisterVerification(event)));
authElements.resendRegisterVerificationButton.addEventListener("click", () => runAction(handleResendRegisterVerification));
authElements.activationForm.addEventListener("submit", (event) => runAction(() => handleActivateAccount(event)));

async function initializeAuthPage() {
  try {
    await initializeGoogleLogin();

    const authError = KiagendaApp.getQueryParam("auth_error");
    if (authError) {
      setFeedback(authError, "error");
      window.history.replaceState({}, document.title, "/");
    }

    const result = await restoreSession();

    if (!result && !authState.currentView) {
      showAuthView("login");
    }
  } catch (error) {
    KiagendaApp.clearAuthSession();
    showAuthView("login");
  } finally {
    document.body.classList.remove("auth-page-loading");
  }
}

initializeAuthPage();
