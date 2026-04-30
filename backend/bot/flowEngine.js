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
  buildServiceDetailMessage,
  buildSpecificLinkMessage,
  buildWelcomeMessage,
  getBotAdjustablePrompt,
  getServiceWorkflow,
  hasCustomerProfile
} = require("./messageBuilder");
const { matchIntent } = require("./intentMatcher");
const { detectIntentWithAI } = require("../services/aiIntentService");
const { detectIntentWithGemini } = require("../services/geminiIntentService");
const { canUseFeature, normalizePlan, normalizeSubscriptionStatus } = require("../services/featureAccessService");
const { getState, setState } = require("./stateManager");
const { updateTenant } = require("../tenancy/tenantConfigStore");
const {
  findCategoryById,
  findLegacyCategory,
  getActiveCatalogCategoriesWithItems,
  isServiceCategory
} = require("../utils/catalogCategories");

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
  const serviceCategory = findLegacyCategory(config, "services");

  if (serviceCategory && Array.isArray(serviceCategory.items) && serviceCategory.items.length) {
    return `Sem problema.\n\n${buildCatalogListMessage(config, serviceCategory.id, serviceCategory.name, "servico")}`;
  }

  return "Sem problema. Me diga melhor o que voce procura.";
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

function buildServiceContextReply(config, service, message) {
  const text = normalizeText(message);
  const workflow = getServiceWorkflow(config);

  if (!service) {
    return "";
  }

  if (text.includes("quanto custa") || text.includes("preco") || text.includes("valor")) {
    if (workflow?.priceDisplayMode === "do_not_inform") {
      return `${service.name}\n\nOs valores desse servico sao tratados no atendimento.\n\nPosso te explicar melhor como funciona ou te encaminhar para atendimento.`;
    }

    if (service.price) {
      return workflow?.priceDisplayMode === "starting_at_only"
        ? `${service.name}\n\nO valor comeca a partir de ${service.price}.\n\nPosso te explicar melhor como funciona ou te encaminhar para atendimento.`
        : `${service.name}\n\nO valor e ${service.price}.\n\nPosso te explicar melhor como funciona ou te encaminhar para atendimento.`;
    }

    return [
      `${service.name}`,
      "Esse servico e personalizado e o valor depende do que voce precisa.",
      workflow?.serviceProcess ? `Como funciona: ${workflow.serviceProcess}` : "",
      "O ideal e falar com o responsavel para entender melhor o projeto antes de passar um orcamento."
    ].filter(Boolean).join("\n\n");
  }

  if (text.includes("como funciona") || text.includes("como e") || text.includes("explica")) {
    return [
      service.name,
      service.description || "",
      workflow?.serviceProcess ? `Como funciona o atendimento: ${workflow.serviceProcess}` : "",
      "Se quiser, posso te passar mais detalhes ou te encaminhar para atendimento."
    ].filter(Boolean).join("\n\n");
  }

  if (text.includes("tem mais") || text.includes("mais info") || text.includes("mais detalhes")) {
    const blocks = [
      service.name,
      service.description || "",
      service.price && workflow?.priceDisplayMode !== "do_not_inform"
        ? workflow?.priceDisplayMode === "starting_at_only"
          ? `Valor a partir de ${service.price}`
          : `Preco: ${service.price}`
        : "",
      !service.price ? "Valor sob consulta." : "",
      workflow?.serviceProcess ? `Como funciona: ${workflow.serviceProcess}` : "",
      service.link ? `Link: ${service.link}` : "",
      "Se quiser, posso te encaminhar para atendimento."
    ];

    return blocks.filter(Boolean).join("\n\n");
  }

  return "";
}

function getNumberedOption(message) {
  const text = normalizeText(message);
  if (["1", "2", "3"].includes(text)) {
    return text;
  }

  return "";
}

function isBudgetRequestMessage(message) {
  const text = normalizeText(message);
  return ["orcamento", "cotacao", "quanto fica", "quanto sairia"].some((term) => text.includes(term));
}

function isInterestSignalMessage(message) {
  const text = normalizeText(message);
  return ["quero", "gostei", "tenho interesse", "me interessa", "vamos seguir", "podemos seguir"].some((term) => text.includes(term));
}

function buildBudgetRedirectMessage(config, service) {
  const instructions = String(getBotAdjustablePrompt(config)?.instrucoesNegocio || "").trim();
  const workflow = getServiceWorkflow(config);
  const nextStep = String(workflow?.nextStep || "").toLowerCase();
  const nextStepLine =
    nextStep === "schedule_meeting"
      ? "O ideal e conversar com o responsavel para entender melhor o projeto antes de agendar uma reuniao."
      : nextStep === "request_more_info"
        ? workflow?.nextStepDetails || "O ideal e coletar mais algumas informacoes antes do orcamento."
        : nextStep === "send_link"
          ? workflow?.nextStepDetails || "Posso te direcionar para o proximo passo de atendimento."
          : "O ideal e conversar com o responsavel para entender melhor o projeto antes de passar um orcamento.";
  const blocks = [
    `O orcamento de ${service?.name || "esse servico"} e feito no atendimento humano.`,
    nextStepLine,
    workflow?.notes || "",
    instructions,
    "Se quiser, posso te conectar com o responsavel para montar um orcamento certinho para voce."
  ];

  return blocks.filter(Boolean).join("\n\n");
}

function buildInterestHandoffOfferMessage(config, service) {
  const attendant = config.business?.attendantName || "atendimento";
  const workflow = getServiceWorkflow(config);
  const nextStep = String(workflow?.nextStep || "").toLowerCase();

  if (nextStep === "schedule_meeting") {
    return [
      `Perfeito. Vejo que voce tem interesse em ${service?.name || "esse servico"}.`,
      "Se quiser, posso te encaminhar para marcar uma reuniao."
    ].join("\n\n");
  }

  if (nextStep === "request_more_info") {
    return [
      `Perfeito. Vejo que voce tem interesse em ${service?.name || "esse servico"}.`,
      workflow?.nextStepDetails || "Antes de avancar, posso coletar mais algumas informacoes para direcionar voce melhor."
    ].join("\n\n");
  }

  if (nextStep === "send_link") {
    return [
      `Perfeito. Vejo que voce tem interesse em ${service?.name || "esse servico"}.`,
      workflow?.nextStepDetails || "Se quiser, posso te passar o proximo link de atendimento."
    ].join("\n\n");
  }

  return [
    `Perfeito. Vejo que voce tem interesse em ${service?.name || "esse servico"}.`,
    `Se quiser, posso te encaminhar para ${attendant} continuar com voce.`
  ].join("\n\n");
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

  const serviceCategory = findLegacyCategory(config, "services");
  const nextCategories = Array.isArray(config.categories)
    ? config.categories.map((category) => {
        if (category.id !== serviceCategory?.id) {
          return category;
        }

        return {
          ...category,
          items: nextServices
        };
      })
    : [];

  updateTenant(tenantId, { services: nextServices, categories: nextCategories });
  config.services = nextServices;
  config.categories = nextCategories;

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

function getCatalogContext(state, config) {
  if (state.currentState === "aguardando_escolha_link") {
    return {
      key: "links",
      title: "Links",
      singularLabel: "link"
    };
  }

  if (String(state.currentState || "").startsWith("aguardando_escolha_categoria:")) {
    const categoryId = String(state.currentState).split(":")[1] || "";
    const category = findCategoryById(config, categoryId);

    if (!category) {
      return null;
    }

    return {
      key: category.id,
      title: category.name,
      singularLabel: isServiceCategory(category) ? "servico" : "item",
      category
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
    ...getActiveCatalogCategoriesWithItems(config).map((category) => ({
      key: category.id,
      items: category.items || [],
      labelKey: "name",
      category
    })),
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
            categoryId: group.category?.id || "",
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
  const catalogContext = getCatalogContext(state, config);

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

  const items = catalogContext.category?.items || config[catalogContext.key] || [];
  const matches = findCatalogMatches(message, items);

  if (matches.length === 1) {
    const mediaMessages = buildDetailMediaMessages(matches[0], config);
    const isService = isServiceCategory(catalogContext.category);

    return {
      intent: "detalhe_categoria_item",
      categoryId: catalogContext.category?.id || "",
      itemId: matches[0]?.id || "",
      reply: isService ? buildServiceDetailMessage(config, matches[0]) : buildCatalogItemMessage(matches[0]),
      mediaMessages,
      nextState: {
        currentState: "menu",
        fallbackCount: 0,
        handoffUntil: null,
        lastBotMessageType: isService ? "service_detail" : "catalog_detail",
        conversationState:
          !isService
            ? state.conversationState
            : {
                stage: "context_active",
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
      intent: "opcoes_categoria",
      reply: buildCatalogMatchesMessage(matches, catalogContext.title, catalogContext.singularLabel),
      nextState: {
        currentState: state.currentState,
        fallbackCount: state.fallbackCount,
        handoffUntil: null,
        lastBotMessageType: isServiceCategory(catalogContext.category) ? "service_options" : "catalog_options"
      }
    };
  }

  return {
    intent: "escolha_categoria_nao_encontrada",
    reply: buildCatalogChoiceHelpMessage(config, catalogContext.key, catalogContext.title, catalogContext.singularLabel),
    nextState: {
      currentState: state.currentState,
      fallbackCount: state.fallbackCount + 1,
      handoffUntil: null,
      lastBotMessageType: isServiceCategory(catalogContext.category) ? "service_list" : "catalog_list"
    }
  };
}

function mapAIIntentToFlowIntent(aiIntent, config) {
  const productCategory = findLegacyCategory(config, "products");
  const serviceCategory = findLegacyCategory(config, "services");
  const partnershipCategory = findLegacyCategory(config, "partnerships");

  switch (aiIntent) {
    case "produtos":
      return productCategory ? { intent: "ver_categoria", categoryId: productCategory.id, source: "ai" } : { intent: "fora_do_escopo", source: "ai" };
    case "servicos":
      return serviceCategory ? { intent: "ver_categoria", categoryId: serviceCategory.id, source: "ai" } : { intent: "fora_do_escopo", source: "ai" };
    case "parcerias":
      return partnershipCategory ? { intent: "ver_categoria", categoryId: partnershipCategory.id, source: "ai" } : { intent: "fora_do_escopo", source: "ai" };
    case "links":
      return { intent: "menu", menuAction: "links", source: "ai" };
    case "atendimento":
      return { intent: "atendimento_humano", source: "ai" };
    case "entrega":
      return { intent: "entrega_retirada", source: "ai" };
    case "preco":
      if (productCategory && productCategory.items.length && (!serviceCategory || !serviceCategory.items.length)) {
        return { intent: "ver_categoria", categoryId: productCategory.id, source: "ai" };
      }

      if (serviceCategory && serviceCategory.items.length && (!productCategory || !productCategory.items.length)) {
        return { intent: "ver_categoria", categoryId: serviceCategory.id, source: "ai" };
      }

      if (partnershipCategory && partnershipCategory.items.length && (!productCategory || !productCategory.items.length) && (!serviceCategory || !serviceCategory.items.length)) {
        return { intent: "ver_categoria", categoryId: partnershipCategory.id, source: "ai" };
      }

      if (productCategory && productCategory.items.length) {
        return { intent: "ver_categoria", categoryId: productCategory.id, source: "ai" };
      }

      return { intent: "fora_do_escopo", source: "ai" };
    case "fora_do_escopo":
    default:
      return { intent: "fora_do_escopo", source: "ai" };
  }
}

function mapGeminiIntentToFlowIntent(aiDecision, config) {
  const productCategory = findLegacyCategory(config, "products");
  const serviceCategory = findLegacyCategory(config, "services");
  const partnershipCategory = findLegacyCategory(config, "partnerships");

  switch (aiDecision.intent) {
    case "saudacao":
      return { intent: "saudacao", source: "gemini", aiConfidence: aiDecision.confidence };
    case "produtos":
      return productCategory ? { intent: "ver_categoria", categoryId: productCategory.id, source: "gemini", aiConfidence: aiDecision.confidence } : { intent: "fora_do_escopo", source: "gemini", aiConfidence: aiDecision.confidence };
    case "servicos":
      return serviceCategory ? { intent: "ver_categoria", categoryId: serviceCategory.id, source: "gemini", aiConfidence: aiDecision.confidence } : { intent: "fora_do_escopo", source: "gemini", aiConfidence: aiDecision.confidence };
    case "parcerias":
      return partnershipCategory ? { intent: "ver_categoria", categoryId: partnershipCategory.id, source: "gemini", aiConfidence: aiDecision.confidence } : { intent: "fora_do_escopo", source: "gemini", aiConfidence: aiDecision.confidence };
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

      if (matchedItem.type !== "links") {
        return {
          intent: "detalhe_categoria_item",
          categoryId: matchedItem.categoryId,
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

async function resolveIntentWithPlan(message, config, runtimeContext = {}) {
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

  const geminiDecision = await detectIntentWithGemini(message, config, runtimeContext);

  if (geminiDecision.intent !== "fora_do_escopo") {
    console.log(
      `[plan:${plan}] Gemini usada para classificar intencao. Resultado: ${geminiDecision.intent} (confidence=${geminiDecision.confidence})`
    );
    return mapGeminiIntentToFlowIntent(geminiDecision, config);
  }

  const aiDecision = await detectIntentWithAI(message, config, runtimeContext);
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

    if (activeService && (option === "1" || isAffirmativeMessage(message) || isInterestSignalMessage(message))) {
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
        intent: "interesse_servico",
        reply: buildInterestHandoffOfferMessage(config, activeService),
        state: next
      };
    }

    if (activeService && (option === "2" || isServiceContextQuestion(message))) {
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

    if (activeService && (option === "3" || isBudgetRequestMessage(message))) {
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
        intent: "orcamento_para_humano",
        reply: buildBudgetRedirectMessage(config, activeService),
        state: next
      };
    }
  }

  if (conversationState.lastIntent === "servico" && conversationState.lastSuggestedService && isServiceContextQuestion(message)) {
    const activeService = (config.services || []).find((item) => item.id === conversationState.lastSuggestedService);
    const contextualReply = buildServiceContextReply(config, activeService, message);

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

  if (conversationState.lastIntent === "servico" && conversationState.lastSuggestedService && isInterestSignalMessage(message)) {
    const activeService = (config.services || []).find((item) => item.id === conversationState.lastSuggestedService);

    if (activeService) {
      const next = setState(
        tenantId,
        contactId,
        {
          currentState: "menu",
          lastBotMessageType: "service_interest_offer",
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
        intent: "interesse_servico",
        reply: buildInterestHandoffOfferMessage(config, activeService),
        state: next
      };
    }
  }

  if (conversationState.lastIntent === "servico" && conversationState.lastSuggestedService && isBudgetRequestMessage(message)) {
    const activeService = (config.services || []).find((item) => item.id === conversationState.lastSuggestedService);

    if (activeService) {
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
        intent: "orcamento_para_humano",
        reply: buildBudgetRedirectMessage(config, activeService),
        state: next
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
        reply: buildServiceDetailMessage(config, pendingService),
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

  const activeServiceForContext = (config.services || []).find((item) => item.id === conversationState.lastSuggestedService);
  const matchedIntent = await resolveIntentWithPlan(message, config, {
    currentContext: conversationState.lastIntent === "servico" ? "Cliente esta falando sobre um servico especifico." : "",
    lastIntent: conversationState.lastIntent,
    lastServiceName: activeServiceForContext?.name || ""
  });
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
    case "ver_categoria": {
      const category = findCategoryById(config, matchedIntent.categoryId);
      reply = category
        ? buildCatalogListMessage(config, category.id, category.name, isServiceCategory(category) ? "servico" : "item")
        : buildMenuMessage(config);
      nextState.currentState = category?.items?.length ? `aguardando_escolha_categoria:${category.id}` : "menu";
      nextState.lastBotMessageType = isServiceCategory(category) ? "service_list" : "catalog_list";
      break;
    }
    case "ver_link_especifico": {
      const matchedLink = findLinkById(config, matchedIntent.linkId);
      reply = matchedLink ? buildSpecificLinkMessage(config, matchedLink) : buildAllLinksReply(config);
      break;
    }
    case "detalhe_categoria_item": {
      const category = findCategoryById(config, matchedIntent.categoryId);
      const item = (category?.items || []).find((entry) => entry.id === matchedIntent.itemId);
      const serviceLike = isServiceCategory(category);
      reply = item
        ? serviceLike
          ? buildServiceDetailMessage(config, item)
          : buildCatalogItemMessage(item)
        : category
          ? buildCatalogListMessage(config, category.id, category.name, serviceLike ? "servico" : "item")
          : buildMenuMessage(config);
      nextState.currentState = "menu";
      nextState.lastBotMessageType = serviceLike ? "service_detail" : "catalog_detail";
      if (serviceLike) {
        nextState.conversationState = {
          stage: "context_active",
          lastSuggestedService: item?.id || "",
          lastIntent: "servico",
          rejectedServices: conversationState.rejectedServices
        };
      }
      break;
    }
    case "confirmar_servico_categoria": {
      const category = findCategoryById(config, matchedIntent.categoryId);
      const service = (category?.items || []).find((item) => item.id === matchedIntent.itemId);
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
    case "menu_customizado":
      reply = String(matchedIntent.customReply || "").trim() || buildFallbackMessage(config);
      nextState.currentState = "menu";
      nextState.lastBotMessageType = "custom_menu";
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
        : matchedIntent.intent === "detalhe_categoria_item"
          ? buildDetailMediaMessages(
              (findCategoryById(config, matchedIntent.categoryId)?.items || []).find((item) => item.id === matchedIntent.itemId),
              config
            )
          : [],
    state: savedState
  };
}

module.exports = {
  processIncomingMessage
};
