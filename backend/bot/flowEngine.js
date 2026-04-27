const {
  buildBusinessMessage,
  buildCatalogChoiceHelpMessage,
  buildCatalogItemMessage,
  buildCatalogListMessage,
  buildCatalogMatchesMessage,
  buildDeliveryPickupMessage,
  buildFallbackMessage,
  buildHandoffMessage,
  buildLinkChoiceHelpMessage,
  buildLinkMatchesMessage,
  buildLinksMessage,
  buildMenuMessage,
  buildPersonalizedMenuMessage,
  buildProfileCollectionPrompt,
  buildProfileCollectionRetryMessage,
  buildSpecificLinkMessage,
  buildWelcomeMessage,
  hasCustomerProfile
} = require("./messageBuilder");
const { matchIntent } = require("./intentMatcher");
const { detectIntentWithAI } = require("../services/aiIntentService");
const { detectIntentWithGemini } = require("../services/geminiIntentService");
const { canUseFeature, normalizePlan, normalizeSubscriptionStatus } = require("../services/featureAccessService");
const { getState, setState } = require("./stateManager");
const { updateTenant } = require("../tenancy/tenantConfigStore");

function isHandoffActive(state) {
  return state.handoffUntil && state.handoffUntil > Date.now();
}

function findLinkById(config, linkId) {
  return config.links.find((link) => link.id === linkId);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeLearnedKeyword(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCatalogCandidates(item, labelKey = "name") {
  return [item?.[labelKey], ...(item?.aliases || []), ...(item?.keywords || [])]
    .map((candidate) => normalizeText(candidate))
    .filter(Boolean);
}

function scoreCatalogCandidate(normalizedMessage, candidate) {
  if (!normalizedMessage || !candidate) {
    return 0;
  }

  if (normalizedMessage === candidate) {
    return 5;
  }

  if (normalizedMessage.includes(candidate)) {
    return candidate.split(/\s+/).length > 1 ? 4 : 3;
  }

  if (candidate.includes(normalizedMessage)) {
    return 2;
  }

  return 0;
}

function buildAllLinksReply(config) {
  if (!Array.isArray(config?.links) || !config.links.length) {
    return buildLinksMessage(config);
  }

  const items = config.links
    .map((link) => {
      const lines = [
        link.title ? `• ${link.title}` : "",
        link.url || "",
        link.description || ""
      ];

      return lines.filter(Boolean).join("\n");
    })
    .filter(Boolean);

  return `Claro 😊\n\nAqui estao os links disponiveis:\n\n${items.join("\n\n")}`;
}

function buildServiceConfirmationMessage(service) {
  return `Voce quis dizer ${service?.name || "esse servico"}? Digite sim ou nao ðŸ˜Š`;
}

function buildServiceConfirmationRetryMessage() {
  return "Voce quis dizer esse servico? Me responda com sim ou nao ðŸ˜Š";
}

function buildServiceConfirmationDeclinedMessage(config) {
  if (Array.isArray(config?.services) && config.services.length) {
    return `Sem problema ðŸ˜Š\n\n${buildCatalogListMessage(config, "services", "Servicos", "servico")}`;
  }

  return "Sem problema ðŸ˜Š Me diga melhor o que voce procura.";
}

function buildConversationStatePatch(overrides = {}) {
  return {
    conversationState: {
      stage: "",
      lastSuggestedService: "",
      lastIntent: "",
      rejectedServices: [],
      ...overrides
    }
  };
}

function getConversationState(state) {
  return {
    stage: state?.conversationState?.stage || "",
    lastSuggestedService: state?.conversationState?.lastSuggestedService || "",
    lastIntent: state?.conversationState?.lastIntent || "",
    rejectedServices: Array.isArray(state?.conversationState?.rejectedServices) ? state.conversationState.rejectedServices : []
  };
}

function isServiceContextQuestion(message) {
  const text = normalizeText(message);
  return ["quanto custa", "preco", "valor", "tem mais", "mais info", "mais detalhes", "como funciona", "como e", "explica"].some((term) =>
    text.includes(term)
  );
}

function buildServiceContextReply(service, message) {
  const text = normalizeText(message);

  if (!service) {
    return "";
  }

  if (text.includes("quanto custa") || text.includes("preco") || text.includes("valor")) {
    return service.price
      ? `${service.name}\n\nO valor e ${service.price}.\n\nSe quiser, posso te explicar melhor ou te encaminhar para atendimento.`
      : `${service.name}\n\nAinda nao tenho o valor cadastrado aqui.\n\nSe quiser, posso te encaminhar para atendimento.`;
  }

  if (text.includes("como funciona") || text.includes("como e") || text.includes("explica")) {
    return service.description
      ? `${service.name}\n\n${service.description}\n\nSe quiser, posso te passar mais detalhes ou te encaminhar para atendimento.`
      : `${service.name}\n\nPosso te encaminhar para atendimento para te explicar melhor como funciona.`;
  }

  if (text.includes("tem mais") || text.includes("mais info") || text.includes("mais detalhes")) {
    const blocks = [
      service.name,
      service.description || "",
      service.price ? `Preco: ${service.price}` : "",
      service.link ? `Link: ${service.link}` : "",
      "Se quiser, posso te encaminhar para atendimento."
    ];

    return blocks.filter(Boolean).join("\n\n");
  }

  return "";
}

function buildServiceSalesPrompt(config, service) {
  return [
    buildCatalogItemMessage(service),
    "Posso montar um orcamento rapido pra voce?",
    "1. Sim, quero um orcamento rapido",
    "2. Quero entender melhor primeiro",
    `3. Posso te conectar com ${config.business?.attendantName || "o atendimento"} agora`
  ].join("\n\n");
}

function buildServiceGuidedBudgetMessage(service) {
  return [
    `Perfeito. Para adiantar seu interesse em ${service?.name || "esse servico"}, me diga qual opcao combina mais com voce:`,
    "1. Quero algo mais simples",
    "2. Quero algo mais completo",
    "3. Ainda nao sei e quero uma orientacao rapida"
  ].join("\n\n");
}

function buildBudgetQualificationReply(config, service, option) {
  const attendant = config.business?.attendantName || "o atendimento";

  if (option === "1") {
    return [
      `Perfeito. Ja vou considerar que voce busca algo mais simples para ${service?.name || "esse servico"}.`,
      `Se quiser, posso te conectar com ${attendant} agora, ou voce pode me dizer seu prazo em uma frase.`
    ].join("\n\n");
  }

  if (option === "2") {
    return [
      `Otimo. Ja entendi que voce busca algo mais completo para ${service?.name || "esse servico"}.`,
      `Se quiser, posso te conectar com ${attendant} agora, ou voce pode me dizer qual resultado espera atingir.`
    ].join("\n\n");
  }

  return [
    `Sem problema. Posso te ajudar com uma orientacao inicial sobre ${service?.name || "esse servico"}.`,
    `Se preferir, tambem posso te conectar com ${attendant} agora para acelerar esse atendimento.`
  ].join("\n\n");
}

function getNumberedOption(message) {
  const text = normalizeText(message);
  if (["1", "2", "3"].includes(text)) {
    return text;
  }

  return "";
}

function buildLearnableKeyword(rawMessage) {
  const normalized = normalizeLearnedKeyword(rawMessage);

  if (!normalized) {
    return "";
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  if (!words.length || words.length > 6) {
    return "";
  }

  if (normalized.length > 50) {
    return "";
  }

  return normalized;
}

function learnKeywordFromConfirmation({ tenantId, config, serviceId, rawMessage }) {
  const learnedKeyword = buildLearnableKeyword(rawMessage);

  if (!serviceId || !learnedKeyword) {
    return null;
  }

  const services = Array.isArray(config?.services) ? config.services : [];
  const serviceIndex = services.findIndex((item) => item.id === serviceId);

  if (serviceIndex < 0) {
    return null;
  }

  const service = services[serviceIndex];
  const existingKeywords = Array.isArray(service.keywords) ? service.keywords : [];
  const normalizedExisting = existingKeywords.map((item) => normalizeLearnedKeyword(item)).filter(Boolean);

  if (normalizedExisting.includes(learnedKeyword)) {
    return null;
  }

  const nextKeywords = [...existingKeywords, learnedKeyword];
  const nextServices = services.map((item, index) =>
    index === serviceIndex
      ? {
          ...item,
          keywords: nextKeywords
        }
      : item
  );

  updateTenant(tenantId, { services: nextServices });
  config.services = nextServices;

  return learnedKeyword;
}

function isResumeMessage(message) {
  const text = normalizeText(message);
  return ["oi", "ola", "bom dia", "boa tarde", "boa noite", "menu", "inicio", "comecar"].some((term) => text.includes(term));
}

function isResetContextMessage(message) {
  const text = normalizeText(message);
  return ["menu", "voltar", "inicio", "comecar"].includes(text);
}

function isAffirmativeMessage(message) {
  return ["sim", "s", "isso", "exatamente", "confirmo", "pode ser"].includes(normalizeText(message));
}

function isNegativeMessage(message) {
  return ["nao", "n", "negativo", "nao era", "nada disso", "outro"].includes(normalizeText(message));
}

function cleanProfileValue(value) {
  return String(value || "")
    .replace(/^[\s\-:,.]+|[\s\-:,.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyRegionToken(value) {
  return normalizeText(value).length >= 3;
}

function isLikelyPersonName(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  const blockedTerms = [
    "quero",
    "preciso",
    "gostaria",
    "site",
    "sites",
    "servico",
    "servicos",
    "produto",
    "produtos",
    "links",
    "link",
    "atendimento",
    "menu",
    "ola",
    "oi"
  ];

  return !blockedTerms.includes(normalized);
}

function extractTaggedValue(message, labels) {
  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(?:^|\\n|[,;])\\s*(?:${escapedLabels.join("|")})\\s*[:\\-]?\\s*([^\\n,;]+)`, "i");
  const match = String(message || "").match(regex);
  return cleanProfileValue(match?.[1] || "");
}

function parseCustomerProfile(message) {
  const rawMessage = String(message || "").trim();

  if (!rawMessage) {
    return null;
  }

  const taggedName = extractTaggedValue(rawMessage, ["nome", "meu nome e", "me chamo"]);
  const taggedRegion = extractTaggedValue(rawMessage, ["cidade", "regiao", "bairro", "sou de", "falo de", "moro em"]);

  if (taggedName && taggedRegion) {
    return {
      customerName: taggedName,
      customerRegion: taggedRegion
    };
  }

  const inlineRegionMatch = rawMessage.match(/^(.+?)\s+(?:falo de|sou de|moro em)\s+(.+)$/i);

  if (inlineRegionMatch) {
    const customerName = cleanProfileValue(inlineRegionMatch[1]);
    const customerRegion = cleanProfileValue(inlineRegionMatch[2]);

    if (customerName && customerRegion && isLikelyPersonName(customerName)) {
      return { customerName, customerRegion };
    }
  }

  const lines = rawMessage
    .split(/\r?\n/)
    .map((line) => cleanProfileValue(line))
    .filter(Boolean);

  if (lines.length >= 2) {
    const [name, ...regionParts] = lines;
    const region = cleanProfileValue(regionParts.join(" "));

    if (name && region && isLikelyPersonName(name)) {
      return {
        customerName: name,
        customerRegion: region
      };
    }
  }

  const parts = rawMessage
    .split(/[,;|]/)
    .map((part) => cleanProfileValue(part))
    .filter(Boolean);

  if (parts.length >= 2) {
    const customerName = cleanProfileValue(parts[0]);
    const customerRegion = cleanProfileValue(parts.slice(1).join(", "));

    if (customerName && customerRegion && isLikelyPersonName(customerName)) {
      return {
        customerName,
        customerRegion
      };
    }
  }

  const spacedParts = rawMessage
    .split(/\s+/)
    .map((part) => cleanProfileValue(part))
    .filter(Boolean);

  if (spacedParts.length >= 2) {
    const customerName = cleanProfileValue(spacedParts[0]);
    const customerRegion = cleanProfileValue(spacedParts.slice(1).join(" "));

    if (customerName && isLikelyPersonName(customerName) && isLikelyRegionToken(customerRegion)) {
      return { customerName, customerRegion };
    }
  }

  return null;
}

function getCatalogContext(state) {
  if (state.currentState === "aguardando_escolha_link") {
    return {
      key: "links",
      title: "Links",
      singularLabel: "link"
    };
  }

  if (state.currentState === "aguardando_escolha_produto") {
    return {
      key: "products",
      title: "Produtos",
      singularLabel: "produto"
    };
  }

  if (state.currentState === "aguardando_escolha_servico") {
    return {
      key: "services",
      title: "Servicos",
      singularLabel: "servico"
    };
  }

  return null;
}

function findCatalogMatches(message, items = []) {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    return [];
  }

  return items.filter((item) => {
    return getCatalogCandidates(item).some((candidate) => scoreCatalogCandidate(normalizedMessage, candidate) > 0);
  });
}

function normalizeTextCandidate(value) {
  return normalizeText(value);
}

function findSpecificItemCandidate(target, config) {
  const normalizedTarget = normalizeTextCandidate(target);

  if (!normalizedTarget) {
    return null;
  }

  const groups = [
    { key: "products", items: config.products || [], labelKey: "name" },
    { key: "services", items: config.services || [], labelKey: "name" },
    { key: "links", items: config.links || [], labelKey: "title" }
  ];

  let bestMatch = null;

  for (const group of groups) {
    for (const item of group.items) {
      const candidates = getCatalogCandidates(item, group.labelKey)
        .map((candidate) => normalizeTextCandidate(candidate))
        .filter(Boolean);

      for (const candidate of candidates) {
        let score = 0;

        if (candidate === normalizedTarget) {
          score = 3;
        } else if (candidate.includes(normalizedTarget) || normalizedTarget.includes(candidate)) {
          score = 2;
        }

        if (!score) {
          continue;
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            type: group.key,
            item,
            score
          };
        }
      }
    }
  }

  return bestMatch;
}

function findLinkMatches(message, links = []) {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    return [];
  }

  return links.filter((link) => {
    const candidates = [link.title, link.url, ...(link.aliases || [])]
      .map((candidate) => normalizeText(candidate))
      .filter(Boolean);

    return candidates.some((candidate) =>
      candidate.includes(normalizedMessage) || normalizedMessage.includes(candidate)
    );
  });
}

function buildDetailMediaMessages(item, config) {
  if (!canUseFeature(config, "media")) {
    return [];
  }

  const imageAssets = Array.isArray(item?.images) && item.images.length
    ? item.images.slice(0, 3)
    : item?.image
      ? [item.image]
      : [];

  const audioAssets = item?.audio ? [item.audio] : [];

  return [...imageAssets, ...audioAssets.slice(0, 1)].filter(Boolean);
}

function buildHandoffAudioMessages(config) {
  if (!canUseFeature(config, "audio")) {
    return [];
  }

  return config?.messages?.audio ? [config.messages.audio] : [];
}

function tryResolveCatalogChoice({ state, message, config }) {
  const catalogContext = getCatalogContext(state);

  if (!catalogContext) {
    return null;
  }

  if (catalogContext.key === "links") {
    const matches = findLinkMatches(message, config.links || []);

    if (matches.length === 1) {
      return {
        intent: "ver_link_especifico",
        reply: buildSpecificLinkMessage(config, matches[0]),
        mediaMessages: [],
        nextState: {
          currentState: "menu",
          fallbackCount: 0,
          handoffUntil: null,
          lastBotMessageType: "link_detail"
        }
      };
    }

    if (matches.length > 1) {
      return {
        intent: "opcoes_link",
        reply: buildLinkMatchesMessage(matches),
        nextState: {
          currentState: state.currentState,
          fallbackCount: state.fallbackCount,
          handoffUntil: null,
          lastBotMessageType: "link_options"
        }
      };
    }

    return {
      intent: "escolha_link_nao_encontrada",
      reply: buildLinkChoiceHelpMessage(config),
      nextState: {
        currentState: state.currentState,
        fallbackCount: state.fallbackCount + 1,
        handoffUntil: null,
        lastBotMessageType: "link_list"
      }
    };
  }

  const items = config[catalogContext.key] || [];
  const matches = findCatalogMatches(message, items);

  if (matches.length === 1) {
    const mediaMessages = buildDetailMediaMessages(matches[0], config);

    return {
      intent: catalogContext.key === "products" ? "detalhe_produto" : "detalhe_servico",
      reply:
        catalogContext.key === "products"
          ? buildCatalogItemMessage(matches[0])
          : buildServiceSalesPrompt(config, matches[0]),
      mediaMessages,
      nextState: {
        currentState: "menu",
        fallbackCount: 0,
        handoffUntil: null,
        lastBotMessageType: catalogContext.key === "products" ? "product_detail" : "service_detail",
        conversationState:
          catalogContext.key === "products"
            ? state.conversationState
            : {
                stage: "service_followup",
                lastSuggestedService: matches[0]?.id || "",
                lastIntent: "servico",
                rejectedServices: Array.isArray(state?.conversationState?.rejectedServices)
                  ? state.conversationState.rejectedServices
                  : []
              }
      }
    };
  }

  if (matches.length > 1) {
    return {
      intent: catalogContext.key === "products" ? "opcoes_produto" : "opcoes_servico",
      reply: buildCatalogMatchesMessage(matches, catalogContext.title, catalogContext.singularLabel),
      nextState: {
        currentState: state.currentState,
        fallbackCount: state.fallbackCount,
        handoffUntil: null,
        lastBotMessageType: catalogContext.key === "products" ? "product_options" : "service_options"
      }
    };
  }

  return {
    intent: catalogContext.key === "products" ? "escolha_produto_nao_encontrada" : "escolha_servico_nao_encontrada",
    reply: buildCatalogChoiceHelpMessage(config, catalogContext.key, catalogContext.title, catalogContext.singularLabel),
    nextState: {
      currentState: state.currentState,
      fallbackCount: state.fallbackCount + 1,
      handoffUntil: null,
      lastBotMessageType: catalogContext.key === "products" ? "product_list" : "service_list"
    }
  };
}

function mapAIIntentToFlowIntent(aiIntent, config) {
  switch (aiIntent) {
    case "produtos":
      return { intent: "ver_produtos", source: "ai" };
    case "servicos":
      return { intent: "ver_servicos", source: "ai" };
    case "links":
      return { intent: "menu", menuAction: "links", source: "ai" };
    case "atendimento":
      return { intent: "atendimento_humano", source: "ai" };
    case "entrega":
      return { intent: "entrega_retirada", source: "ai" };
    case "preco":
      if (Array.isArray(config.products) && config.products.length && (!Array.isArray(config.services) || !config.services.length)) {
        return { intent: "ver_produtos", source: "ai" };
      }

      if (Array.isArray(config.services) && config.services.length && (!Array.isArray(config.products) || !config.products.length)) {
        return { intent: "ver_servicos", source: "ai" };
      }

      if (Array.isArray(config.products) && config.products.length) {
        return { intent: "ver_produtos", source: "ai" };
      }

      return { intent: "fora_do_escopo", source: "ai" };
    case "fora_do_escopo":
    default:
      return { intent: "fora_do_escopo", source: "ai" };
  }
}

function mapGeminiIntentToFlowIntent(aiDecision, config) {
  switch (aiDecision.intent) {
    case "saudacao":
      return { intent: "saudacao", source: "gemini", aiConfidence: aiDecision.confidence };
    case "produtos":
      return { intent: "ver_produtos", source: "gemini", aiConfidence: aiDecision.confidence };
    case "servicos":
      return { intent: "ver_servicos", source: "gemini", aiConfidence: aiDecision.confidence };
    case "links":
      return { intent: "menu", menuAction: "links", source: "gemini", aiConfidence: aiDecision.confidence };
    case "atendimento":
      return { intent: "atendimento_humano", source: "gemini", aiConfidence: aiDecision.confidence };
    case "entrega":
      return { intent: "entrega_retirada", source: "gemini", aiConfidence: aiDecision.confidence };
    case "preco":
      return {
        ...mapAIIntentToFlowIntent("preco", config),
        source: "gemini",
        aiConfidence: aiDecision.confidence
      };
    case "item_especifico": {
      const matchedItem = findSpecificItemCandidate(aiDecision.target, config);

      if (!matchedItem) {
        return { intent: "fora_do_escopo", source: "gemini", aiConfidence: aiDecision.confidence };
      }

      if (matchedItem.type === "products") {
        return {
          intent: "detalhe_produto",
          itemId: matchedItem.item.id,
          source: "gemini",
          aiConfidence: aiDecision.confidence
        };
      }

      if (matchedItem.type === "services") {
        return {
          intent: "detalhe_servico",
          itemId: matchedItem.item.id,
          source: "gemini",
          aiConfidence: aiDecision.confidence
        };
      }

      return {
        intent: "ver_link_especifico",
        linkId: matchedItem.item.id,
        source: "gemini",
        aiConfidence: aiDecision.confidence
      };
    }
    case "fora_do_escopo":
    default:
      return { intent: "fora_do_escopo", source: "gemini", aiConfidence: aiDecision.confidence };
  }
}

function getPlanLabel(config) {
  return normalizePlan(config?.plan);
}

async function resolveIntentWithPlan(message, config) {
  const plan = getPlanLabel(config);
  const matchedIntent = matchIntent(message, config);

  if (matchedIntent.intent !== "fora_do_escopo") {
    console.log(`[plan:${plan}] IA nao usada. Intencao encontrada por palavras: ${matchedIntent.intent}`);
    return matchedIntent;
  }

  if (!canUseFeature(config, "ai")) {
    console.log(
      `[plan:${plan}] IA nao usada. Recurso indisponivel para este plano/status (${normalizeSubscriptionStatus(config?.subscriptionStatus)}).`
    );
    return matchedIntent;
  }

  const geminiDecision = await detectIntentWithGemini(message, config);

  if (geminiDecision.intent !== "fora_do_escopo") {
    console.log(
      `[plan:${plan}] Gemini usada para classificar intencao. Resultado: ${geminiDecision.intent} (confidence=${geminiDecision.confidence})`
    );
    return mapGeminiIntentToFlowIntent(geminiDecision, config);
  }

  const aiDecision = await detectIntentWithAI(message, config);
  console.log(
    `[plan:${plan}] IA usada para classificar intencao. Resultado: ${aiDecision.intent} (confidence=${aiDecision.confidence})`
  );
  return {
    ...mapAIIntentToFlowIntent(aiDecision.intent, config),
    aiConfidence: aiDecision.confidence
  };
}

async function processIncomingMessage({ tenantId, contactId, message, config }) {
  const plan = getPlanLabel(config);
  const subscriptionStatus = normalizeSubscriptionStatus(config?.subscriptionStatus);
  console.log(`[tenant:${tenantId}] Plano ativo: ${plan} | Assinatura: ${subscriptionStatus}`);

  if (config?.botEnabled === false) {
    return {
      tenantId,
      contactId,
      intent: "atendimento_pausado",
      reply: "",
      state: null
    };
  }

  const state = getState(tenantId, contactId, config.settings.stateTTL);
  const conversationState = getConversationState(state);

  if (isResetContextMessage(message)) {
    const resetState = setState(
      tenantId,
      contactId,
      {
        ...buildConversationStatePatch(),
        lastUserMessage: "",
        pendingServiceConfirmationId: "",
        pendingServiceConfirmationScore: 0
      },
      config.settings.stateTTL
    );

    return {
      tenantId,
      contactId,
      intent: "reset_contexto",
      reply: buildMenuMessage(config),
      state: resetState
    };
  }

  if (conversationState.stage === "service_followup" && conversationState.lastSuggestedService) {
    const activeService = (config.services || []).find((item) => item.id === conversationState.lastSuggestedService);
    const option = getNumberedOption(message);

    if (activeService && (option === "1" || isAffirmativeMessage(message))) {
      const next = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          lastBotMessageType: "service_budget_guided",
          lastUserMessage: "",
          ...buildConversationStatePatch({
            stage: "budget_guided",
            lastSuggestedService: activeService.id,
            lastIntent: "servico",
            rejectedServices: conversationState.rejectedServices
          })
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "orcamento_guiado",
        reply: buildServiceGuidedBudgetMessage(activeService),
        state: next
      };
    }

    if (activeService && option === "2") {
      const next = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          lastBotMessageType: "service_context_active",
          lastUserMessage: "",
          ...buildConversationStatePatch({
            stage: "context_active",
            lastSuggestedService: activeService.id,
            lastIntent: "servico",
            rejectedServices: conversationState.rejectedServices
          })
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "continuar_servico",
        reply: "Claro. Pode me perguntar, por exemplo: quanto custa, como funciona ou tem mais detalhes.",
        state: next
      };
    }

    if (activeService && option === "3") {
      const next = setState(
        tenantId,
        contactId,
        {
          currentState: "handoff",
          handoffUntil: Date.now() + config.settings.handoffTimeout * 60 * 1000,
          lastBotMessageType: "handoff",
          lastUserMessage: "",
          ...buildConversationStatePatch({
            stage: "",
            lastSuggestedService: activeService.id,
            lastIntent: "servico",
            rejectedServices: conversationState.rejectedServices
          })
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "atendimento_humano",
        reply: buildHandoffMessage(config),
        state: next
      };
    }
  }

  if (conversationState.stage === "budget_guided" && conversationState.lastSuggestedService) {
    const activeService = (config.services || []).find((item) => item.id === conversationState.lastSuggestedService);
    const option = getNumberedOption(message);

    if (activeService && option) {
      const next = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          lastBotMessageType: "service_budget_qualified",
          lastUserMessage: "",
          ...buildConversationStatePatch({
            stage: "context_active",
            lastSuggestedService: activeService.id,
            lastIntent: "servico",
            rejectedServices: conversationState.rejectedServices
          })
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "qualificacao_orcamento",
        reply: buildBudgetQualificationReply(config, activeService, option),
        state: next
      };
    }
  }

  if (conversationState.lastIntent === "servico" && conversationState.lastSuggestedService && isServiceContextQuestion(message)) {
    const activeService = (config.services || []).find((item) => item.id === conversationState.lastSuggestedService);
    const contextualReply = buildServiceContextReply(activeService, message);

    if (contextualReply) {
      const contextualState = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          lastBotMessageType: "service_context_reply",
          lastUserMessage: "",
          ...buildConversationStatePatch({
            stage: "context_active",
            lastSuggestedService: activeService?.id || "",
            lastIntent: "servico",
            rejectedServices: conversationState.rejectedServices
          })
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "contexto_servico",
        reply: contextualReply,
        state: contextualState
      };
    }
  }

  if (state.currentState === "confirmando_servico" && state.pendingServiceConfirmationId) {
    const pendingService = (config.services || []).find((item) => item.id === state.pendingServiceConfirmationId);

    if (!pendingService) {
      setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          lastUserMessage: "",
          pendingServiceConfirmationId: "",
          pendingServiceConfirmationScore: 0,
          ...buildConversationStatePatch()
        },
        config.settings.stateTTL
      );
    } else if (isAffirmativeMessage(message)) {
      learnKeywordFromConfirmation({
        tenantId,
        config,
        serviceId: pendingService.id,
        rawMessage: state.lastUserMessage
      });

      const confirmedState = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          fallbackCount: 0,
          handoffUntil: null,
          lastBotMessageType: "service_detail",
          lastUserMessage: "",
          pendingServiceConfirmationId: "",
          pendingServiceConfirmationScore: 0,
          ...buildConversationStatePatch({
            stage: "context_active",
            lastSuggestedService: pendingService.id,
            lastIntent: "servico",
            rejectedServices: conversationState.rejectedServices
          })
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "detalhe_servico_confirmado",
        reply: buildServiceSalesPrompt(config, pendingService),
        mediaMessages: buildDetailMediaMessages(pendingService, config),
        state: confirmedState
      };
    } else if (isNegativeMessage(message)) {
      const declinedState = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          fallbackCount: 0,
          handoffUntil: null,
          lastBotMessageType: "service_confirmation_declined",
          lastUserMessage: "",
          pendingServiceConfirmationId: "",
          pendingServiceConfirmationScore: 0,
          ...buildConversationStatePatch({
            stage: "menu",
            lastSuggestedService: "",
            lastIntent: "",
            rejectedServices: [...conversationState.rejectedServices, pendingService.id]
          })
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "confirmacao_servico_negada",
        reply: buildServiceConfirmationDeclinedMessage(config),
        state: declinedState
      };
    }

    const retryState = setState(
      tenantId,
      contactId,
      {
        currentState: "confirmando_servico",
        lastBotMessageType: "service_confirmation_retry",
        ...buildConversationStatePatch({
          stage: "confirming",
          lastSuggestedService: pendingService.id,
          lastIntent: "servico",
          rejectedServices: conversationState.rejectedServices
        })
      },
      config.settings.stateTTL
    );

    return {
      tenantId,
      contactId,
      intent: "confirmacao_servico_aguardando",
      reply: buildServiceConfirmationRetryMessage(),
      state: retryState
    };
  }

  if (isHandoffActive(state)) {
    if (!isResumeMessage(message)) {
      const activeState = setState(
        tenantId,
        contactId,
        {
          currentState: "handoff",
          handoffUntil: state.handoffUntil,
          lastBotMessageType: "handoff"
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "atendimento_humano_pausado",
        reply: "",
        state: activeState
      };
    }

    setState(
      tenantId,
      contactId,
      {
        currentState: "idle",
        handoffUntil: null,
        fallbackCount: 0,
        lastBotMessageType: null
      },
      config.settings.stateTTL
    );
  }

  if (!hasCustomerProfile(state)) {
    if (state.currentState === "aguardando_customer_profile") {
      const profile = parseCustomerProfile(message);

      if (!profile) {
        const retryState = setState(
          tenantId,
          contactId,
          {
            currentState: "aguardando_customer_profile",
            fallbackCount: state.fallbackCount + 1,
            handoffUntil: null,
            lastBotMessageType: "customer_profile_retry"
          },
          config.settings.stateTTL
        );

        return {
          tenantId,
          contactId,
          intent: "coleta_cadastro_incompleta",
          reply: buildProfileCollectionRetryMessage(),
          state: retryState
        };
      }

      const collectedState = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          fallbackCount: 0,
          handoffUntil: null,
          lastBotMessageType: "customer_profile_collected",
          customerName: profile.customerName,
          customerRegion: profile.customerRegion
        },
        config.settings.stateTTL
      );

      return {
        tenantId,
        contactId,
        intent: "coleta_cadastro_concluida",
        reply: buildPersonalizedMenuMessage(config, collectedState),
        state: collectedState
      };
    }

    const welcomeState = setState(
      tenantId,
      contactId,
      {
        currentState: "aguardando_customer_profile",
        fallbackCount: 0,
        handoffUntil: null,
        lastBotMessageType: "customer_profile_prompt"
      },
      config.settings.stateTTL
    );

    return {
      tenantId,
      contactId,
      intent: "coleta_cadastro_inicial",
      reply: buildProfileCollectionPrompt(config),
      state: welcomeState
    };
  }

  const catalogChoiceResult = tryResolveCatalogChoice({ state, message, config });

  if (catalogChoiceResult) {
    const savedState = setState(tenantId, contactId, catalogChoiceResult.nextState, config.settings.stateTTL);

    return {
      tenantId,
      contactId,
      intent: catalogChoiceResult.intent,
      reply: catalogChoiceResult.reply,
      mediaMessages: catalogChoiceResult.mediaMessages || [],
      state: savedState
    };
  }

  const matchedIntent = await resolveIntentWithPlan(message, config);
  let reply = "";
  let nextState = {
    currentState: matchedIntent.intent,
    fallbackCount: matchedIntent.intent === "fora_do_escopo" ? state.fallbackCount + 1 : 0,
    handoffUntil: null,
    lastBotMessageType: matchedIntent.intent,
    lastUserMessage: "",
    pendingServiceConfirmationId: "",
    pendingServiceConfirmationScore: 0,
    ...buildConversationStatePatch({
      stage: conversationState.stage,
      lastSuggestedService: conversationState.lastSuggestedService,
      lastIntent: conversationState.lastIntent,
      rejectedServices: conversationState.rejectedServices
    })
  };

  switch (matchedIntent.intent) {
    case "saudacao":
      reply = buildWelcomeMessage(config);
      nextState.currentState = "menu";
      nextState.lastBotMessageType = "welcome";
      break;
    case "menu":
      if (matchedIntent.menuAction === "business_info") {
        reply = buildBusinessMessage(config);
      } else if (matchedIntent.menuAction === "links") {
        reply = buildAllLinksReply(config);
        nextState.currentState = "menu";
        nextState.lastBotMessageType = "link_list";
      } else if (matchedIntent.menuAction === "menu" || !matchedIntent.menuAction) {
        reply = buildMenuMessage(config);
        nextState.conversationState = {
          stage: "",
          lastSuggestedService: "",
          lastIntent: "",
          rejectedServices: conversationState.rejectedServices
        };
      } else {
        reply = buildMenuMessage(config);
      }
      break;
    case "ver_servicos":
      reply = buildCatalogListMessage(config, "services", "Servicos", "servico");
      nextState.currentState = config.services.length ? "aguardando_escolha_servico" : "menu";
      nextState.lastBotMessageType = "service_list";
      break;
    case "ver_produtos":
      reply = buildCatalogListMessage(config, "products", "Produtos", "produto");
      nextState.currentState = config.products.length ? "aguardando_escolha_produto" : "menu";
      nextState.lastBotMessageType = "product_list";
      break;
    case "ver_link_especifico": {
      const matchedLink = findLinkById(config, matchedIntent.linkId);
      reply = matchedLink ? buildSpecificLinkMessage(config, matchedLink) : buildAllLinksReply(config);
      break;
    }
    case "detalhe_produto": {
      const product = (config.products || []).find((item) => item.id === matchedIntent.itemId);
      reply = product ? buildCatalogItemMessage(product) : buildCatalogListMessage(config, "products", "Produtos", "produto");
      nextState.currentState = "menu";
      nextState.lastBotMessageType = "product_detail";
      break;
    }
    case "detalhe_servico": {
      const service = (config.services || []).find((item) => item.id === matchedIntent.itemId);
      reply = service ? buildServiceSalesPrompt(config, service) : buildCatalogListMessage(config, "services", "Servicos", "servico");
      nextState.currentState = "menu";
      nextState.lastBotMessageType = "service_detail";
      nextState.conversationState = {
        stage: "service_followup",
        lastSuggestedService: service?.id || "",
        lastIntent: "servico",
        rejectedServices: conversationState.rejectedServices
      };
      break;
    }
    case "confirmar_servico": {
      const service = (config.services || []).find((item) => item.id === matchedIntent.itemId);
      const alreadyRejected = service && conversationState.rejectedServices.includes(service.id);
      reply = service && !alreadyRejected ? buildServiceConfirmationMessage(service) : buildFallbackMessage(config);
      nextState.currentState = service && !alreadyRejected ? "confirmando_servico" : "menu";
      nextState.lastBotMessageType = service && !alreadyRejected ? "service_confirmation" : "fallback";
      nextState.lastUserMessage = service && !alreadyRejected ? message : "";
      nextState.pendingServiceConfirmationId = service && !alreadyRejected ? service.id : "";
      nextState.pendingServiceConfirmationScore = service && !alreadyRejected ? Number(matchedIntent.confidenceScore || 0) : 0;
      nextState.conversationState = service && !alreadyRejected
        ? {
            stage: "confirming",
            lastSuggestedService: service.id,
            lastIntent: "servico",
            rejectedServices: conversationState.rejectedServices
          }
        : {
            stage: "",
            lastSuggestedService: "",
            lastIntent: "",
            rejectedServices: conversationState.rejectedServices
          };
      break;
    }
    case "entrega_retirada":
      reply = buildDeliveryPickupMessage(config);
      break;
    case "atendimento_humano":
      reply = buildHandoffMessage(config);
      nextState.currentState = "handoff";
      nextState.handoffUntil = Date.now() + config.settings.handoffTimeout * 60 * 1000;
      nextState.conversationState = {
        stage: "",
        lastSuggestedService: "",
        lastIntent: "",
        rejectedServices: conversationState.rejectedServices
      };
      break;
    case "fora_do_escopo":
    default:
      reply = buildFallbackMessage(config);
      break;
  }

  const savedState = setState(tenantId, contactId, nextState, config.settings.stateTTL);

  return {
    tenantId,
    contactId,
    intent: matchedIntent.intent,
    aiConfidence: matchedIntent.aiConfidence,
    reply,
    mediaMessages:
      matchedIntent.intent === "atendimento_humano"
        ? buildHandoffAudioMessages(config)
        : matchedIntent.intent === "detalhe_produto"
          ? buildDetailMediaMessages((config.products || []).find((item) => item.id === matchedIntent.itemId), config)
          : matchedIntent.intent === "detalhe_servico"
            ? buildDetailMediaMessages((config.services || []).find((item) => item.id === matchedIntent.itemId), config)
            : [],
    state: savedState
  };
}

module.exports = {
  processIncomingMessage
};
