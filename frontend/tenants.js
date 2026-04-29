const tenantsState = {
  items: []
};

const tenantsElements = {
  feedbackMessage: document.getElementById("feedbackMessage"),
  tenantId: document.getElementById("tenantId"),
  businessName: document.getElementById("businessName"),
  businessType: document.getElementById("businessType"),
  attendantName: document.getElementById("attendantName"),
  createTenantButton: document.getElementById("createTenantButton"),
  tenantsList: document.getElementById("tenantsList"),
  testTenantsSection: document.getElementById("testTenantsSection"),
  testTenantsList: document.getElementById("testTenantsList")
};

const TEST_TENANT_TOKENS = [
  "test",
  "demo",
  "default",
  "flow",
  "applyplan",
  "reset",
  "verify",
  "cooldown"
];

function setFeedback(message) {
  tenantsElements.feedbackMessage.textContent = message || "";
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isLocalEnvironment() {
  const hostname = String(window.location.hostname || "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function matchesTestTenantHeuristic(tenant) {
  const tenantId = String(tenant?.tenantId || "").toLowerCase();
  return TEST_TENANT_TOKENS.some((token) => tenantId.includes(token));
}

function isTestTenant(tenant) {
  return Boolean(tenant?.isTest) || matchesTestTenantHeuristic(tenant);
}

function getVisibleTenants() {
  return tenantsState.items.filter((tenant) => !isTestTenant(tenant));
}

function getTestTenants() {
  return tenantsState.items.filter((tenant) => isTestTenant(tenant));
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

function getTenantStatusLabel(tenant) {
  return tenant.active ? "Ativo" : "Inativo";
}

function getTenantStatusClass(tenant) {
  return tenant.active ? "status-chip-positive" : "status-chip-negative";
}

function getWhatsappLabel(tenant) {
  const whatsappNumber = normalizeText(tenant.whatsappNumber);
  if (!whatsappNumber) {
    return tenant.whatsappConnected ? "Conectado" : "-";
  }

  return tenant.whatsappConnected ? `${whatsappNumber} • Conectado` : whatsappNumber;
}

function buildTenantCard(tenant, { showTechnicalMeta = false } = {}) {
  const card = document.createElement("article");
  card.className = "tenant-card tenant-admin-card";

  const header = document.createElement("div");
  header.className = "tenant-admin-card-header";
  header.innerHTML = `
    <div>
      <h3>${KiagendaApp.escapeHtml(tenant.businessName || "Cliente sem nome")}</h3>
      <div class="tenant-admin-meta">
        <span class="badge-pill badge-pill-plan">${KiagendaApp.escapeHtml(getPlanLabel(tenant.plan))}</span>
        <span class="status-chip ${getTenantStatusClass(tenant)}">${KiagendaApp.escapeHtml(getTenantStatusLabel(tenant))}</span>
      </div>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "tenant-admin-grid";
  body.innerHTML = `
    <p><strong>Tipo:</strong> ${KiagendaApp.escapeHtml(tenant.businessType || "-")}</p>
    <p><strong>Plano:</strong> ${KiagendaApp.escapeHtml(getPlanLabel(tenant.plan))}</p>
    <p><strong>Status:</strong> ${KiagendaApp.escapeHtml(getTenantStatusLabel(tenant))}</p>
    <p><strong>WhatsApp:</strong> ${KiagendaApp.escapeHtml(getWhatsappLabel(tenant))}</p>
  `;

  if (showTechnicalMeta) {
    const technicalMeta = document.createElement("p");
    technicalMeta.className = "tenant-admin-technical";
    technicalMeta.innerHTML = `<strong>ID tecnico:</strong> ${KiagendaApp.escapeHtml(tenant.tenantId)}`;
    body.appendChild(technicalMeta);
  }

  const actions = document.createElement("div");
  actions.className = "button-row tenant-admin-actions";

  if (!tenant.onboardingCompleted) {
    const onboardingLink = document.createElement("a");
    onboardingLink.className = "primary-button link-button";
    onboardingLink.href = `onboarding.html?id=${encodeURIComponent(tenant.tenantId)}`;
    onboardingLink.textContent = "Configurar passo a passo";
    actions.appendChild(onboardingLink);
  }

  const openLink = document.createElement("a");
  openLink.className = "secondary-button link-button";
  openLink.href = `tenant-edit.html?id=${encodeURIComponent(tenant.tenantId)}`;
  openLink.textContent = "Abrir painel";
  actions.appendChild(openLink);

  const editLink = document.createElement("a");
  editLink.className = "neutral-button link-button";
  editLink.href = `tenant-edit.html?id=${encodeURIComponent(tenant.tenantId)}`;
  editLink.textContent = "Editar";
  actions.appendChild(editLink);

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = tenant.active ? "danger-button" : "secondary-button";
  toggleButton.textContent = tenant.active ? "Desativar" : "Ativar";
  toggleButton.addEventListener("click", () => runAction(() => toggleTenant(tenant)));
  actions.appendChild(toggleButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "Excluir";
  deleteButton.addEventListener("click", () => runAction(() => deleteTenant(tenant)));
  actions.appendChild(deleteButton);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(actions);
  return card;
}

function renderTenantCollection(container, items, emptyMessage, options = {}) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<p class="empty-copy">${emptyMessage}</p>`;
    return;
  }

  items.forEach((tenant) => {
    container.appendChild(buildTenantCard(tenant, options));
  });
}

function renderTenants() {
  const realTenants = getVisibleTenants();
  const testTenants = getTestTenants();

  renderTenantCollection(
    tenantsElements.tenantsList,
    realTenants,
    "Nenhum cliente real cadastrado ainda."
  );

  if (testTenants.length && isLocalEnvironment()) {
    tenantsElements.testTenantsSection.classList.remove("hidden-view");
    renderTenantCollection(
      tenantsElements.testTenantsList,
      testTenants,
      "Nenhum cliente de teste encontrado.",
      { showTechnicalMeta: true }
    );
    return;
  }

  tenantsElements.testTenantsSection.classList.add("hidden-view");
  tenantsElements.testTenantsList.innerHTML = "";
}

function collectTenantPayload() {
  const tenantId = KiagendaApp.normalizeTenantId(tenantsElements.tenantId.value);

  if (!tenantId) {
    throw new Error("Informe um ID do cliente valido.");
  }

  return {
    tenantId,
    type: "client",
    isTest: false,
    business: {
      name: tenantsElements.businessName.value.trim(),
      type: tenantsElements.businessType.value.trim(),
      attendantName: tenantsElements.attendantName.value.trim()
    }
  };
}

async function loadTenants() {
  const response = await KiagendaApp.requestJson("/api/tenants");
  tenantsState.items = response.items || [];
  renderTenants();
}

async function createTenant() {
  const payload = collectTenantPayload();
  const response = await KiagendaApp.requestJson("/api/tenants", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  tenantsElements.tenantId.value = "";
  tenantsElements.businessName.value = "";
  tenantsElements.businessType.value = "";
  tenantsElements.attendantName.value = "";
  setFeedback(response.message || "Cliente criado com sucesso.");
  await loadTenants();
}

async function toggleTenant(tenant) {
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
      body: JSON.stringify({ active: true })
    });
    setFeedback(response.message || "Cliente ativado com sucesso.");
  }

  await loadTenants();
}

async function deleteTenant(tenant) {
  const tenantLabel = tenant.businessName || tenant.tenantId || "este cliente";
  const confirmed = window.confirm(`Excluir ${tenantLabel}? Essa acao remove cadastro, conta, sessao e estados salvos.`);

  if (!confirmed) {
    return;
  }

  const response = await KiagendaApp.requestJson(`/api/tenants/${tenant.tenantId}?permanent=true`, {
    method: "DELETE"
  });
  setFeedback(response.message || "Cliente excluido com sucesso.");
  await loadTenants();
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setFeedback(error.message || "Nao foi possivel concluir a acao.");
  }
}

tenantsElements.createTenantButton.addEventListener("click", () => runAction(createTenant));

loadTenants().catch(() => {
  setFeedback("Nao foi possivel carregar a lista de clientes.");
});
