function cleanText(value) {
  return String(value || "").trim();
}

function firstText(...values) {
  return values.map(cleanText).find(Boolean) || "";
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  return cleanText(value)
    .split(/\r?\n|;/)
    .map(cleanText)
    .filter(Boolean);
}

function buildSection(title, lines) {
  const content = lines.filter(Boolean).join("\n");
  return content ? `${title}\n${content}` : "";
}

function buildLabeledLine(label, value) {
  const text = cleanText(value);
  return text ? `${label}: ${text}` : "";
}

function getBotProfile(tenant = {}) {
  return tenant.botProfile || {};
}

function getAdjustablePrompt(tenant = {}) {
  return getBotProfile(tenant).adjustablePrompt || {};
}

function getServiceWorkflow(tenant = {}) {
  return getBotProfile(tenant).serviceWorkflow || {};
}

function getBusinessRules(tenant = {}) {
  const botProfile = getBotProfile(tenant);
  const workflow = getServiceWorkflow(tenant);
  return botProfile.rules || workflow.blockedActions || {};
}

function buildIdentitySection(tenant = {}) {
  const botProfile = getBotProfile(tenant);
  const adjustablePrompt = getAdjustablePrompt(tenant);
  const workflow = getServiceWorkflow(tenant);
  const business = tenant.business || {};

  return buildSection("IDENTIDADE", [
    buildLabeledLine("Nome do negócio", business.name),
    buildLabeledLine("Responsável", firstText(business.ownerName, botProfile.name)),
    buildLabeledLine("Tom", firstText(botProfile.tone, adjustablePrompt.estiloAtendimento)),
    buildLabeledLine("Tom de voz", firstText(botProfile.voiceTone, adjustablePrompt.tomDeVoz)),
    buildLabeledLine("Nível de detalhe", firstText(botProfile.detailLevel, adjustablePrompt.nivelDetalhe)),
    buildLabeledLine("Foco do atendimento", firstText(botProfile.attendanceFocus, adjustablePrompt.focoAtendimento)),
    buildLabeledLine("Sobre o negócio", business.description),
    buildLabeledLine("Tipo de atendimento", firstText(business.serviceType, workflow.attendanceType)),
    buildLabeledLine("Como funciona o serviço", firstText(botProfile.serviceDescription, workflow.serviceProcess))
  ]);
}

function buildBusinessRulesSection(tenant = {}) {
  const botProfile = getBotProfile(tenant);
  const workflow = getServiceWorkflow(tenant);
  const rules = getBusinessRules(tenant);
  const ruleLabels = [
    ["noNegotiate", "Nunca negociar condições ou fazer acordos"],
    ["noDiscount", "Nunca oferecer desconto"],
    ["noCloseSale", "Nunca fechar venda direto no atendimento automático"],
    ["noPromiseDeadline", "Nunca prometer prazo específico"],
    ["noPriceWithoutAnalysis", "Nunca informar preço final sem análise do projeto"],
    ["noFinalPriceWithoutAnalysis", "Nunca informar preço final sem análise do projeto"],
    ["noInventInfo", "Nunca inventar informações não cadastradas"]
  ];
  const seenRuleLabels = new Set();
  const activeRules = ruleLabels.reduce((lines, [key, label]) => {
    if (rules?.[key] === true && !seenRuleLabels.has(label)) {
      seenRuleLabels.add(label);
      lines.push(`- ${label}`);
    }

    return lines;
  }, []);

  return buildSection("REGRAS DE NEGÓCIO", [
    ...activeRules,
    buildLabeledLine("Como funciona o orçamento", firstText(botProfile.quotingProcess, workflow.budgetMode)),
    buildLabeledLine("Próximo passo quando cliente se interessa", firstText(botProfile.nextStep, workflow.nextStep)),
    buildLabeledLine("Detalhes do próximo passo", firstText(botProfile.nextStepDetails, workflow.nextStepDetails)),
    buildLabeledLine("Observações importantes", firstText(botProfile.importantNotes, workflow.notes))
  ]);
}

function isFaqAiBase(item = {}) {
  const mode = cleanText(item.useFor || item.mode || item.modo).toLowerCase();
  return ["ai_base", "knowledge", "base_ia"].includes(mode);
}

function buildFaqSection(tenant = {}) {
  const items = Array.isArray(tenant.faq) ? tenant.faq : [];
  const lines = items
    .filter(isFaqAiBase)
    .map((item) => {
      const triggers = asList(item.variations || item.triggers || item.perguntas || item.questions || item.pergunta || item.question);
      const response = firstText(item.response, item.resposta, item.answer);

      return [
        buildLabeledLine("Gatilho", triggers.join(", ")),
        buildLabeledLine("Resposta ideal", response)
      ].filter(Boolean).join("\n");
    })
    .filter(Boolean);

  return buildSection("RESPOSTAS DE REFERÊNCIA (FAQ)", lines);
}

function isActiveFlow(flow = {}) {
  const status = cleanText(flow.status || flow.situacao).toLowerCase();

  if (status) {
    return status === "active" || status === "ativo";
  }

  return flow.enabled !== false;
}

function buildConversationFlowsSection(tenant = {}) {
  const flows = Array.isArray(tenant.conversationFlows) ? tenant.conversationFlows : [];
  const lines = flows
    .filter(isActiveFlow)
    .map((flow) => [
      buildLabeledLine("Fluxo", flow.name),
      buildLabeledLine("Gatilhos", asList(flow.triggers || flow.gatilhos).join(", ")),
      buildLabeledLine("Objetivo", flow.objective),
      buildLabeledLine("Etapas", flow.steps),
      buildLabeledLine("Regras", flow.rules),
      buildLabeledLine("Encaminhar quando", flow.handoffCondition)
    ].filter(Boolean).join("\n"))
    .filter(Boolean);

  return buildSection("FLUXOS DE CONVERSA", lines);
}

function buildLinksSection(tenant = {}) {
  const links = Array.isArray(tenant.links) ? tenant.links : [];
  const lines = links
    .map((link) => {
      const title = firstText(link.title, link.titulo, link.name);
      const url = cleanText(link.url);
      return title && url ? `- ${title}: ${url}` : "";
    })
    .filter(Boolean);

  return buildSection("LINKS DO NEGÓCIO", lines);
}

function buildWhatsappBehaviorSection(tenant = {}) {
  const botProfile = getBotProfile(tenant);
  const adjustablePrompt = getAdjustablePrompt(tenant);
  const messages = tenant.messages || {};
  const fixedText = [
    "Você está atendendo via WhatsApp. Siga estas regras de comportamento:",
    "- Responda de forma natural, como numa conversa humana real",
    "- Adapte o tamanho da resposta: pergunta simples = resposta curta",
    "- Faça no máximo 1 pergunta por mensagem",
    "- Se o cliente usar linguagem informal, acompanhe o tom",
    "- Nunca reinicie a conversa ou repita a mensagem de boas-vindas",
    "- Nunca responda como formulário ou lista numerada quando não for necessário",
    "- Nunca diga que é IA a menos que o cliente pergunte diretamente"
  ].join("\n");

  return buildSection("COMPORTAMENTO NO WHATSAPP", [
    fixedText,
    buildLabeledLine("Comportamento específico do negócio", firstText(botProfile.specificBehavior, adjustablePrompt.instrucoesNegocio)),
    buildLabeledLine("Regras adicionais", firstText(botProfile.additionalRules, adjustablePrompt.regrasPersonalizadas)),
    buildLabeledLine("Quando escalar para humano", firstText(botProfile.humanHandoffMessage, messages.handoff))
  ]);
}

function buildSystemPrompt(tenant = {}) {
  return [
    buildIdentitySection(tenant),
    buildBusinessRulesSection(tenant),
    buildFaqSection(tenant),
    buildConversationFlowsSection(tenant),
    buildLinksSection(tenant),
    buildWhatsappBehaviorSection(tenant)
  ].filter(Boolean).join("\n\n---\n\n");
}

function detectarFluxo(fluxos, mensagem, historicoRecente = []) {
  const activeFlows = Array.isArray(fluxos) ? fluxos.filter(isActiveFlow) : [];
  const ultimasMensagens = Array.isArray(historicoRecente) ? historicoRecente.slice(-6) : [];

  for (const msg of [...ultimasMensagens].reverse()) {
    const match = cleanText(msg?.content || msg?.message).match(/\[FLUXO ATIVO: "(.+?)"\]/);

    if (match) {
      const fluxoEmAndamento = activeFlows.find((flow) => flow.name === match[1]);

      if (fluxoEmAndamento) {
        return fluxoEmAndamento;
      }
    }
  }

  const msgLower = cleanText(mensagem).toLowerCase();

  if (!msgLower) {
    return null;
  }

  return activeFlows.find((flow) => {
    const gatilhos = asList(flow.triggers || flow.gatilhos).map((trigger) => trigger.toLowerCase());
    return gatilhos.some((trigger) => msgLower.includes(trigger));
  }) || null;
}

module.exports = {
  buildSystemPrompt,
  detectarFluxo
};
