const adminState = {
  items: [],
  activationCodes: [],
  planSettings: {},
  editingTenantId: "",
  accessCodePreview: null,
  activationCodeStatusFilter: "all",
  activationCodeSearch: ""
};

const adminElements = {
  adminFeedbackMessage: document.getElementById("adminFeedbackMessage"),
  adminLoginCard: document.getElementById("adminLoginCard"),
  adminPanel: document.getElementById("adminPanel"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminLogin: document.getElementById("adminLogin"),
  adminPassword: document.getElementById("adminPassword"),
  adminTenantsList: document.getElementById("adminTenantsList"),
  adminLogoutButton: document.getElementById("adminLogoutButton"),
  activationCodeForm: document.getElementById("activationCodeForm"),
  activationCodePlan: document.getElementById("activationCodePlan"),
  activationCodeValidity: document.getElementById("activationCodeValidity"),
  activationCodeUsage: document.getElementById("activationCodeUsage"),
  activationCodeStatusFilter: document.getElementById("activationCodeStatusFilter"),
  activationCodeSearch: document.getElementById("activationCodeSearch"),
  activationCodePreview: document.getElementById("activationCodePreview"),
  activationCodesList: document.getElementById("activationCodesList"),
  adminPlanSettingsList: document.getElementById("adminPlanSettingsList")
};

function setFeedback(message) {
  adminElements.adminFeedbackMessage.textContent = message || "";
}

function ensureAdminAccess() {
  return Boolean(KiagendaApp.getAdminSession()?.loggedIn);
}

function setAdminView(isAuthenticated) {
  adminElements.adminLoginCard.classList.toggle("hidden-view", isAuthenticated);
  adminElements.adminPanel.classList.toggle("hidden-view", !isAuthenticated);
  adminElements.adminLogoutButton.classList.toggle("hidden-view", !isAuthenticated);
}

function getPlanLabel(plan) {
  const normalizedPlan = String(plan || "essential").trim().toLowerCase();

  if (normalizedPlan === "professional") {
    return "Profissional";
  }

  if (normalizedPlan === "business") {
    return "Business";
  }

  return "Essencial";
}

function getSubscriptionLabel(status) {
  if (String(status || "").toLowerCase() === "inactive") {
    return "Inativa";
  }

  if (String(status || "").toLowerCase() === "trial") {
    return "Teste";
  }

  return "Ativa";
}

function getActivationStatusLabel(status) {
  return String(status || "").toLowerCase() === "active" ? "Ativa" : "Pendente";
}

function getWhatsappConnectionLabel(isConnected) {
  return isConnected ? "Conectado" : "Desconectado";
}

function getBackupRestoreConfirmationLabel(tenant) {
  return String(tenant.businessName || tenant.tenantId || "este cliente").trim();
}

function getVisibleAdminTenants() {
  return adminState.items.filter((tenant) => String(tenant.type || "client").toLowerCase() === "client");
}

function getCodeStatusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "inactive":
      return "Inativo";
    case "expired":
      return "Expirado";
    case "exhausted":
      return "Sem usos";
    default:
      return "Ativo";
  }
}

function getCodeStatusBadgeClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "inactive":
      return "badge-pill-status-inactive";
    case "expired":
      return "badge-pill-status-expired";
    case "exhausted":
      return "badge-pill-status-exhausted";
    default:
      return "badge-pill-status-active";
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Sem expiracao";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
}

function formatUsesRemaining(item) {
  return item.usesRemaining === null ? "Ilimitado" : String(item.usesRemaining);
}

function formatPrice(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
}

function buildActivationMessage(item) {
  return [
    "Oi! Seu acesso ao KiAgenda Assistente foi liberado.",
    `Codigo de ativacao: ${item.code}`,
    `Plano liberado: ${getPlanLabel(item.plan)}`,
    item.expiresAt ? `Validade: ${formatDateTime(item.expiresAt)}` : "Validade: sem expiracao",
    "",
    "Abra a tela de ativacao e digite esse codigo para liberar sua conta."
  ].join("\n");
}

async function copyToClipboard(value) {
  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(String(value));
}

function renderActivationPreview() {
  if (!adminState.accessCodePreview) {
    adminElements.activationCodePreview.classList.add("hidden-view");
    adminElements.activationCodePreview.innerHTML = "";
    return;
  }

  const item = adminState.accessCodePreview;
  adminElements.activationCodePreview.classList.remove("hidden-view");
  adminElements.activationCodePreview.innerHTML = `
    <div class="status-highlight compact-highlight">
      <span>C&oacute;digo gerado</span>
      <strong>${KiagendaApp.escapeHtml(item.code)}</strong>
      <p class="muted-copy">Plano: ${KiagendaApp.escapeHtml(getPlanLabel(item.plan))}</p>
      <p class="muted-copy">Validade: ${KiagendaApp.escapeHtml(formatDateTime(item.expiresAt))}</p>
      <p class="muted-copy">Usos restantes: ${KiagendaApp.escapeHtml(formatUsesRemaining(item))}</p>
    </div>
  `;
}

function getFilteredActivationCodes() {
  const statusFilter = String(adminState.activationCodeStatusFilter || "all").toLowerCase();
  const search = String(adminState.activationCodeSearch || "").trim().toLowerCase();

  return adminState.activationCodes.filter((item) => {
    const matchesStatus = statusFilter === "all" || String(item.status || "").toLowerCase() === statusFilter;
    const matchesSearch = !search || String(item.code || "").toLowerCase().includes(search);
    return matchesStatus && matchesSearch;
  });
}

function renderActivationCodes() {
  adminElements.activationCodesList.innerHTML = "";
  const filteredItems = getFilteredActivationCodes();

  if (!adminState.activationCodes.length) {
    adminElements.activationCodesList.innerHTML = '<p class="empty-copy">Nenhum c&oacute;digo gerado ainda.</p>';
    return;
  }

  if (!filteredItems.length) {
    adminElements.activationCodesList.innerHTML = '<p class="empty-copy">Nenhum c&oacute;digo encontrado com esse filtro.</p>';
    return;
  }

  filteredItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "tenant-card admin-tenant-card admin-code-card";
    const usedByText = Array.isArray(item.usedBy) && item.usedBy.length
      ? item.usedBy.map((entry) => `${entry.tenantId || "-"} em ${formatDateTime(entry.usedAt)}`).join(" | ")
      : "Ainda nao utilizado";

    card.innerHTML = `
      <div>
        <div class="admin-code-header">
          <div>
            <h3>${KiagendaApp.escapeHtml(item.code)}</h3>
            <div class="admin-code-meta">
              <span class="badge-pill badge-pill-plan">${KiagendaApp.escapeHtml(getPlanLabel(item.plan))}</span>
              <span class="badge-pill ${getCodeStatusBadgeClass(item.status)}">${KiagendaApp.escapeHtml(getCodeStatusLabel(item.status))}</span>
            </div>
          </div>
        </div>
        <div class="admin-code-summary">
          <p><strong>Validade:</strong> ${KiagendaApp.escapeHtml(formatDateTime(item.expiresAt))}</p>
          <p><strong>Usos restantes:</strong> ${KiagendaApp.escapeHtml(formatUsesRemaining(item))}</p>
          <p><strong>Criado em:</strong> ${KiagendaApp.escapeHtml(formatDateTime(item.createdAt))}</p>
          <p><strong>Usado por:</strong> ${KiagendaApp.escapeHtml(usedByText)}</p>
        </div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "admin-code-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary-button";
    copyButton.textContent = "Copiar";
    copyButton.addEventListener("click", () => runAction(async () => {
      await copyToClipboard(item.code);
      setFeedback("Codigo copiado com sucesso.");
    }));

    actions.appendChild(copyButton);

    const copyMessageButton = document.createElement("button");
    copyMessageButton.type = "button";
    copyMessageButton.className = "primary-button";
    copyMessageButton.textContent = "Copiar mensagem pronta";
    copyMessageButton.addEventListener("click", () => runAction(async () => {
      await copyToClipboard(buildActivationMessage(item));
      setFeedback("Mensagem pronta copiada com sucesso.");
    }));

    actions.appendChild(copyMessageButton);

    if (item.status === "active") {
      const deactivateButton = document.createElement("button");
      deactivateButton.type = "button";
      deactivateButton.className = "neutral-button";
      deactivateButton.textContent = "Desativar";
      deactivateButton.addEventListener("click", () => runAction(() => deactivateActivationCode(item.code)));
      actions.appendChild(deactivateButton);
    }

    card.appendChild(actions);
    adminElements.activationCodesList.appendChild(card);
  });
}

function renderPlanSettings() {
  adminElements.adminPlanSettingsList.innerHTML = "";
  const entries = Object.entries(adminState.planSettings || {});

  if (!entries.length) {
    adminElements.adminPlanSettingsList.innerHTML = '<p class="empty-copy">Nenhum plano carregado ainda.</p>';
    return;
  }

  entries.forEach(([planKey, planConfig]) => {
    const card = document.createElement("section");
    card.className = "section-subcard";
    card.innerHTML = `
      <div class="section-subcard-header">
        <div>
          <h4>${KiagendaApp.escapeHtml(getPlanLabel(planKey))}</h4>
          <p class="muted-copy">Preco atual: ${KiagendaApp.escapeHtml(formatPrice(planConfig.priceMonthly))}</p>
        </div>
      </div>
      <div class="field-grid">
        <label>
          Preco mensal
          <input type="number" min="0" step="0.01" data-plan="${planKey}" data-field="priceMonthly" value="${KiagendaApp.escapeHtml(planConfig.priceMonthly)}">
        </label>
        <label class="toggle-field">
          <span>Liberar IA</span>
          <input type="checkbox" data-plan="${planKey}" data-field="allowAI" ${planConfig.allowAI ? "checked" : ""}>
        </label>
        <label class="toggle-field">
          <span>Liberar imagens</span>
          <input type="checkbox" data-plan="${planKey}" data-field="allowImages" ${planConfig.allowImages ? "checked" : ""}>
        </label>
        <label>
          Maximo de imagens por conta
          <input type="number" min="0" step="1" data-plan="${planKey}" data-field="maxImagesPerAccount" value="${KiagendaApp.escapeHtml(planConfig.maxImagesPerAccount)}">
        </label>
        <label>
          Tamanho maximo de imagem (MB)
          <input type="number" min="0" step="0.1" data-plan="${planKey}" data-field="maxImageSizeMB" value="${KiagendaApp.escapeHtml(planConfig.maxImageSizeMB)}">
        </label>
        <label class="toggle-field">
          <span>Otimizar imagens automaticamente</span>
          <input type="checkbox" data-plan="${planKey}" data-field="autoOptimizeImages" ${planConfig.autoOptimizeImages ? "checked" : ""}>
        </label>
        <label class="toggle-field">
          <span>Liberar audio</span>
          <input type="checkbox" data-plan="${planKey}" data-field="allowAudio" ${planConfig.allowAudio ? "checked" : ""}>
        </label>
        <label>
          Maximo de audios por conta
          <input type="number" min="0" max="1" step="1" data-plan="${planKey}" data-field="maxAudioPerAccount" value="${KiagendaApp.escapeHtml(planConfig.maxAudioPerAccount)}">
        </label>
        <label>
          Maximo de categorias
          <input type="number" min="0" step="1" data-plan="${planKey}" data-field="maxCategories" value="${KiagendaApp.escapeHtml(planConfig.maxCategories)}">
        </label>
        <label>
          Itens por categoria
          <input type="number" min="0" step="1" data-plan="${planKey}" data-field="maxItemsPerCategory" value="${KiagendaApp.escapeHtml(planConfig.maxItemsPerCategory)}">
        </label>
        <label class="toggle-field">
          <span>Liberar subcategorias</span>
          <input type="checkbox" data-plan="${planKey}" data-field="allowSubcategories" ${planConfig.allowSubcategories ? "checked" : ""}>
        </label>
        <label>
          Maximo de subcategorias por categoria
          <input type="number" min="0" step="1" data-plan="${planKey}" data-field="maxSubcategoriesPerCategory" value="${KiagendaApp.escapeHtml(planConfig.maxSubcategoriesPerCategory)}">
        </label>
        <label class="full-width">
          Mensagem de upgrade
          <textarea data-plan="${planKey}" data-field="upgradeMessage">${KiagendaApp.escapeHtml(planConfig.upgradeMessage || "")}</textarea>
        </label>
      </div>
      <div class="button-row">
        <button type="button" class="primary-button" data-plan-save="${planKey}">Salvar ${KiagendaApp.escapeHtml(getPlanLabel(planKey))}</button>
      </div>
    `;

    const saveButton = card.querySelector(`[data-plan-save="${planKey}"]`);
    saveButton.addEventListener("click", () => runAction(() => savePlanSettings(planKey, card)));

    adminElements.adminPlanSettingsList.appendChild(card);
  });
}

function renderTenants() {
  adminElements.adminTenantsList.innerHTML = "";
  const visibleTenants = getVisibleAdminTenants();

  if (!visibleTenants.length) {
    adminElements.adminTenantsList.innerHTML = '<p class="empty-copy">Nenhum cliente cadastrado.</p>';
    return;
  }

  visibleTenants.forEach((tenant) => {
    const card = document.createElement("article");
    card.className = "tenant-card admin-tenant-card";
    const isEditing = adminState.editingTenantId === tenant.tenantId;
    const customerName = String(tenant.customerName || "").trim() || "Nao informado";
    const whatsappNumber = String(tenant.whatsappNumber || "").trim() || "Nao informado";

    card.innerHTML = `
      <div>
        <h3>${KiagendaApp.escapeHtml(tenant.businessName || tenant.tenantId)}</h3>
        <p><strong>Respons&aacute;vel:</strong> ${KiagendaApp.escapeHtml(customerName)}</p>
        <p><strong>WhatsApp do cliente:</strong> ${KiagendaApp.escapeHtml(whatsappNumber)}</p>
        <p><strong>Tipo de neg&oacute;cio:</strong> ${KiagendaApp.escapeHtml(tenant.businessType || "-")}</p>
        <p><strong>Plano atual:</strong> ${KiagendaApp.escapeHtml(getPlanLabel(tenant.plan))}</p>
        <p><strong>Assinatura:</strong> ${KiagendaApp.escapeHtml(getSubscriptionLabel(tenant.subscriptionStatus))}</p>
        <p><strong>WhatsApp do atendimento:</strong> ${KiagendaApp.escapeHtml(getWhatsappConnectionLabel(tenant.whatsappConnected))}</p>
        <p><strong>Status da conta/ativacao:</strong> ${KiagendaApp.escapeHtml(getActivationStatusLabel(tenant.activationStatus))}</p>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "button-row";

    const openButton = document.createElement("a");
    openButton.href = `tenant-edit.html?id=${encodeURIComponent(tenant.tenantId)}`;
    openButton.className = "primary-button link-button";
    openButton.textContent = "Abrir painel";
    actions.appendChild(openButton);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "secondary-button";
    editButton.textContent = isEditing ? "Fechar edicao" : "Editar plano";
    editButton.addEventListener("click", () => {
      adminState.editingTenantId = isEditing ? "" : tenant.tenantId;
      renderTenants();
    });

    actions.appendChild(editButton);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = tenant.active ? "danger-button" : "neutral-button";
    toggleButton.textContent = tenant.active ? "Desativar" : "Ativar";
    toggleButton.addEventListener("click", () => runAction(() => toggleTenantStatus(tenant)));
    actions.appendChild(toggleButton);

    const restoreBackupButton = document.createElement("button");
    restoreBackupButton.type = "button";
    restoreBackupButton.className = "neutral-button";
    restoreBackupButton.textContent = "Restaurar backup do cliente";
    restoreBackupButton.addEventListener("click", () => runAction(() => restoreTenantBackup(tenant)));
    actions.appendChild(restoreBackupButton);

    card.appendChild(actions);

    if (isEditing) {
      const editor = document.createElement("div");
      editor.className = "admin-plan-editor";
      editor.innerHTML = `
        <div class="field-grid">
          <label>
            Plano
            <select data-role="plan">
              <option value="essential" ${tenant.plan === "essential" ? "selected" : ""}>Essencial</option>
              <option value="professional" ${tenant.plan === "professional" ? "selected" : ""}>Profissional</option>
              <option value="business" ${tenant.plan === "business" ? "selected" : ""}>Business</option>
            </select>
          </label>
          <label>
            Status da assinatura
            <select data-role="subscriptionStatus">
              <option value="active" ${tenant.subscriptionStatus === "active" ? "selected" : ""}>Ativo</option>
              <option value="inactive" ${tenant.subscriptionStatus === "inactive" ? "selected" : ""}>Inativo</option>
              <option value="trial" ${tenant.subscriptionStatus === "trial" ? "selected" : ""}>Teste</option>
            </select>
          </label>
        </div>
      `;

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "primary-button";
      saveButton.textContent = "Salvar plano";
      saveButton.addEventListener("click", () => runAction(() => saveTenantPlan(tenant.tenantId, editor)));

      const editorActions = document.createElement("div");
      editorActions.className = "button-row";
      editorActions.appendChild(saveButton);
      editor.appendChild(editorActions);
      card.appendChild(editor);
    }

    adminElements.adminTenantsList.appendChild(card);
  });
}

async function loadTenants() {
  const response = await KiagendaApp.requestJson("/api/tenants");
  adminState.items = response.items || [];
  renderTenants();
}

async function toggleTenantStatus(tenant) {
  if (tenant.active) {
    const response = await KiagendaApp.requestJson(`/api/tenants/${tenant.tenantId}`, {
      method: "DELETE"
    });
    setFeedback(response.message || "Cliente desativado com sucesso.");
  } else {
    const response = await KiagendaApp.requestJson(`/api/tenants/${tenant.tenantId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        active: true
      })
    });
    setFeedback(response.message || "Cliente ativado com sucesso.");
  }

  await loadTenants();
}

async function loadActivationCodes() {
  const response = await KiagendaApp.requestJson("/api/auth/admin-access-codes");
  adminState.activationCodes = response.items || [];
  renderActivationPreview();
  renderActivationCodes();
}

async function loadPlanSettings() {
  const response = await KiagendaApp.requestJson("/api/admin/plan-settings");
  adminState.planSettings = response.data || {};
  renderPlanSettings();
}

async function saveTenantPlan(tenantId, editorElement) {
  const plan = editorElement.querySelector('[data-role="plan"]').value;
  const subscriptionStatus = editorElement.querySelector('[data-role="subscriptionStatus"]').value;

  const response = await KiagendaApp.requestJson(`/api/tenants/${tenantId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan,
      subscriptionStatus
    })
  });

  adminState.editingTenantId = "";
  setFeedback(response.message || response.warning || "Plano atualizado com sucesso.");
  await loadTenants();
}

async function restoreTenantBackup(tenant) {
  const tenantLabel = getBackupRestoreConfirmationLabel(tenant);
  const confirmed = window.confirm(
    `Restaurar o backup mais recente de ${tenantLabel}? Isso substitui a configuracao atual do cliente pelos dados preservados no backup.`
  );

  if (!confirmed) {
    return;
  }

  const response = await KiagendaApp.requestJson(`/api/admin/tenants/${tenant.tenantId}/restore-backup`, {
    method: "POST"
  });

  setFeedback(response.message || "Backup restaurado com sucesso.");
  adminState.editingTenantId = "";
  await loadTenants();
}

function readPlanSettingsFromEditor(planKey, editorElement) {
  const readField = (fieldName) => editorElement.querySelector(`[data-plan="${planKey}"][data-field="${fieldName}"]`);

  return {
    [planKey]: {
      priceMonthly: Number(readField("priceMonthly").value || 0),
      allowAI: Boolean(readField("allowAI").checked),
      allowImages: Boolean(readField("allowImages").checked),
      maxImagesPerAccount: Number(readField("maxImagesPerAccount").value || 0),
      maxImageSizeMB: Number(readField("maxImageSizeMB").value || 0),
      autoOptimizeImages: Boolean(readField("autoOptimizeImages").checked),
      allowAudio: Boolean(readField("allowAudio").checked),
      maxAudioPerAccount: Math.min(1, Number(readField("maxAudioPerAccount").value || 0)),
      maxCategories: Number(readField("maxCategories").value || 0),
      maxItemsPerCategory: Number(readField("maxItemsPerCategory").value || 0),
      allowSubcategories: Boolean(readField("allowSubcategories").checked),
      maxSubcategoriesPerCategory: Number(readField("maxSubcategoriesPerCategory").value || 0),
      upgradeMessage: readField("upgradeMessage").value.trim()
    }
  };
}

async function savePlanSettings(planKey, editorElement) {
  const response = await KiagendaApp.requestJson("/api/admin/plan-settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(readPlanSettingsFromEditor(planKey, editorElement))
  });

  adminState.planSettings = response.data || {};
  renderPlanSettings();
  setFeedback(response.message || `Plano ${getPlanLabel(planKey)} atualizado com sucesso.`);
}

async function createActivationCode() {
  const response = await KiagendaApp.requestJson("/api/auth/admin-access-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan: adminElements.activationCodePlan.value,
      validityDays: adminElements.activationCodeValidity.value,
      maxUses: adminElements.activationCodeUsage.value
    })
  });

  adminState.accessCodePreview = response.data || null;
  setFeedback(response.message || "Codigo de ativacao gerado com sucesso.");
  await loadActivationCodes();
}

async function deactivateActivationCode(code) {
  const response = await KiagendaApp.requestJson("/api/auth/admin-access-code/deactivate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code
    })
  });

  if (adminState.accessCodePreview?.code === code) {
    adminState.accessCodePreview = response.data || null;
  }

  setFeedback(response.message || "Codigo de ativacao desativado com sucesso.");
  await loadActivationCodes();
}

async function handleLogin(event) {
  event.preventDefault();

  const isValid = KiagendaApp.isAdminCredentials({
    login: adminElements.adminLogin.value,
    password: adminElements.adminPassword.value
  });

  if (!isValid) {
    throw new Error("Credenciais admin invalidas.");
  }

  KiagendaApp.saveAdminSession({
    loggedIn: true,
    login: adminElements.adminLogin.value.trim().toLowerCase() || KiagendaApp.ADMIN_LOGIN
  });

  setAdminView(true);
  setFeedback("Acesso admin liberado.");
  await Promise.all([loadTenants(), loadActivationCodes(), loadPlanSettings()]);
}

function logout() {
  KiagendaApp.clearAdminSession();
  adminState.editingTenantId = "";
  adminState.accessCodePreview = null;
  setAdminView(false);
  setFeedback("");
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setFeedback(error.message || "Nao foi possivel concluir esta acao.");
  }
}

adminElements.adminLoginForm.addEventListener("submit", (event) => runAction(() => handleLogin(event)));
adminElements.adminLogoutButton.addEventListener("click", logout);
adminElements.activationCodeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(createActivationCode);
});
adminElements.activationCodeStatusFilter.addEventListener("change", () => {
  adminState.activationCodeStatusFilter = adminElements.activationCodeStatusFilter.value;
  renderActivationCodes();
});
adminElements.activationCodeSearch.addEventListener("input", () => {
  adminState.activationCodeSearch = adminElements.activationCodeSearch.value;
  renderActivationCodes();
});

if (ensureAdminAccess()) {
  setAdminView(true);
  Promise.all([loadTenants(), loadActivationCodes(), loadPlanSettings()]).catch(() => {
    setFeedback("Nao foi possivel carregar os dados do admin.");
  });
} else {
  setAdminView(false);
}
