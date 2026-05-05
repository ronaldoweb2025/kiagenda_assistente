const { getActiveCatalogCategoriesWithItems } = require("../utils/catalogCategories");
const { readBotModelSettings } = require("../tenancy/botModelSettingsStore");

const ALLOWED_INTENTS = [
  "saudacao",
  "pedir_servicos",
  "site_landing_page",
  "trafego_pago",
  "google_meu_negocio",
  "seo_local",
  "preco_orcamento",
  "portfolio",
  "prazo_entrega",
  "suporte_cliente",
  "parceria_revenda",
  "links_importantes",
  "falar_com_humano",
  "agradecimento",
  "despedida",
  "mensagem_confusa",
  "duvida_identidade",
  "produtos",
  "servicos",
  "parcerias",
  "links",
  "atendimento",
  "entrega",
  "preco",
  "item_especifico",
  "fora_do_escopo"
];

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const MIN_CONFIDENCE = 0.72;

function normalizeIntent(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_INTENTS.includes(normalized) ? normalized : "fora_do_escopo";
}

function normalizeConfidence(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numericValue));
}

function buildFallbackResult() {
  return {
    intent: "fora_do_escopo",
    target: "",
    confidence: 0
  };
}

function getServicesModelConfig() {
  return readBotModelSettings()?.services || {};
}

function getModelConfigForTenant(tenantConfig = {}) {
  const settings = readBotModelSettings() || {};
  const botModel = String(tenantConfig?.botModel || tenantConfig?.integration?.kiagenda?.mode || "").trim().toLowerCase();

  if (botModel.startsWith("kiagenda")) {
    return settings.kiagenda || {};
  }

  return settings.services || {};
}

function buildCatalogContext(tenantConfig = {}) {
  const categories = getActiveCatalogCategoriesWithItems(tenantConfig).map((category) => ({
    name: category.name,
    keywords: category.keywords || [],
    items: (category.items || [])
      .map((item) => ({
        name: item?.name || "",
        keywords: [...(item?.keywords || []), ...(item?.aliases || [])].filter(Boolean)
      }))
      .filter((item) => item.name)
  }));
  const links = Array.isArray(tenantConfig?.links)
    ? tenantConfig.links.map((item) => item?.title).filter(Boolean)
    : [];

  return {
    businessName: String(tenantConfig?.business?.name || "").trim(),
    businessType: String(tenantConfig?.business?.type || "").trim(),
    categories,
    links
  };
}

function extractTextFromCandidates(payload = {}) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;

    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }

  return "";
}

function formatCatalogItems(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return "Nenhum";
  }

  return items
    .map((item) => `${item.name}${item.keywords?.length ? ` [keywords: ${item.keywords.join(", ")}]` : ""}`)
    .join("; ");
}

async function detectIntentWithGemini(message, tenantConfig = {}, runtimeContext = {}) {
  const trimmedMessage = String(message || "").trim();
  const apiKey = String(tenantConfig?.integration?.gemini?.apiKey || process.env.GEMINI_API_KEY || "").trim();
  const model = String(tenantConfig?.integration?.gemini?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  if (!trimmedMessage || !apiKey) {
    if (trimmedMessage && !apiKey) {
      console.log("Gemini nao usada: GEMINI_API_KEY ausente no tenant e no env.");
    }

    return buildFallbackResult();
  }

  const context = buildCatalogContext(tenantConfig);
  const workflow = tenantConfig?.botProfile?.serviceWorkflow || {};
  const modelConfig = getModelConfigForTenant(tenantConfig);
  const runtimeSummary = [
    runtimeContext?.currentContext ? `Contexto atual: ${runtimeContext.currentContext}` : "",
    runtimeContext?.lastIntent ? `Ultima intencao: ${runtimeContext.lastIntent}` : "",
    runtimeContext?.lastServiceName ? `Ultimo servico identificado: ${runtimeContext.lastServiceName}` : ""
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "Voce e um classificador de intencao. " +
                  "Responda apenas JSON valido. " +
                  "Nao converse com o usuario. " +
                  "Nao crie informacoes. " +
                  `${String(modelConfig.promptBase || "").trim() ? `Considere estas regras do modelo:\n${String(modelConfig.promptBase).trim()}\n` : ""}` +
                  "Use apenas estas intencoes: saudacao, pedir_servicos, site_landing_page, trafego_pago, google_meu_negocio, seo_local, preco_orcamento, portfolio, prazo_entrega, suporte_cliente, parceria_revenda, links_importantes, falar_com_humano, agradecimento, despedida, mensagem_confusa, duvida_identidade, produtos, servicos, parcerias, links, atendimento, entrega, preco, item_especifico, fora_do_escopo. " +
                  "Use duvida_identidade quando o cliente perguntar se esta falando com humano, robo, assistente, Ronaldo ou quem esta atendendo. " +
                  "Se o usuario mencionar algo parecido com um produto ou servico cadastrado, inclusive por palavra-chave, retorne item_especifico e o nome mais provavel. " +
                  "Exemplo: se existir um servico com keywords como site, website ou landing page, frases como quero site ou preciso de um site devem retornar item_especifico. " +
                  "Se nao tiver certeza, retorne fora_do_escopo."
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Mensagem do cliente: "${trimmedMessage}"\n` +
                    `Negocio: ${context.businessName || "Nao informado"}\n` +
                    `Tipo de negocio: ${context.businessType || "Nao informado"}\n` +
                    `Como funciona o atendimento: ${String(workflow.serviceProcess || tenantConfig?.business?.description || "").trim() || "Nao informado"}\n` +
                    `Como funciona o orcamento: ${String(workflow.budgetMode || "").trim() || "Nao informado"}\n` +
                    `Observacoes do negocio: ${String(workflow.notes || tenantConfig?.botProfile?.adjustablePrompt?.instrucoesNegocio || "").trim() || "Nao informado"}\n` +
                    `Categorias cadastradas: ${context.categories.map((category) => `${category.name}: ${formatCatalogItems(category.items)}`).join(" | ") || "Nenhuma"}\n` +
                    `Links cadastrados: ${context.links.join(", ") || "Nenhum"}\n` +
                    `${runtimeSummary ? `${runtimeSummary}\n` : ""}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: Number(modelConfig.temperature || tenantConfig?.botProfile?.aiTemperature || 0.4),
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                intent: {
                  type: "STRING",
                  enum: ALLOWED_INTENTS
                },
                target: {
                  type: "STRING"
                },
                confidence: {
                  type: "NUMBER"
                }
              },
              required: ["intent", "target", "confidence"]
            }
          }
        })
      }
    );

    if (!response.ok) {
      return buildFallbackResult();
    }

    const payload = await response.json();
    const outputText = extractTextFromCandidates(payload);

    if (!outputText) {
      return buildFallbackResult();
    }

    const parsed = JSON.parse(outputText);
    const normalizedIntent = normalizeIntent(parsed.intent);
    const normalizedConfidence = normalizeConfidence(parsed.confidence);

    if (normalizedConfidence < MIN_CONFIDENCE) {
      return buildFallbackResult();
    }

    return {
      intent: normalizedIntent,
      target: String(parsed.target || "").trim(),
      confidence: normalizedConfidence
    };
  } catch (error) {
    console.error("Erro ao classificar intencao com Gemini:", error?.message || error);
    return buildFallbackResult();
  }
}

module.exports = {
  detectIntentWithGemini
};
