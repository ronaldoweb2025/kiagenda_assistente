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
  "produtos",
  "servicos",
  "parcerias",
  "links",
  "atendimento",
  "preco",
  "entrega",
  "fora_do_escopo"
];
const DEFAULT_CONFIDENCE = 0;
const MIN_CONFIDENCE = 0.7;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
const { readBotModelSettings } = require("../tenancy/botModelSettingsStore");

function normalizeIntent(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return ALLOWED_INTENTS.includes(normalizedValue) ? normalizedValue : "fora_do_escopo";
}

function normalizeConfidence(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_CONFIDENCE;
  }

  return Math.max(0, Math.min(1, numericValue));
}

function buildFallbackResult() {
  return {
    intent: "fora_do_escopo",
    confidence: DEFAULT_CONFIDENCE
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

function buildRuntimeContext(runtimeContext = {}) {
  return [
    runtimeContext?.currentContext ? `Contexto atual: ${runtimeContext.currentContext}` : "",
    runtimeContext?.lastIntent ? `Ultima intencao: ${runtimeContext.lastIntent}` : "",
    runtimeContext?.lastServiceName ? `Ultimo servico identificado: ${runtimeContext.lastServiceName}` : ""
  ].filter(Boolean).join("\n");
}

function extractOutputText(payload = {}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  for (const item of payload.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return "";
}

async function detectIntentWithAI(message, tenantConfig = {}, runtimeContext = {}) {
  const trimmedMessage = String(message || "").trim();
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();

  if (!trimmedMessage || !apiKey) {
    return buildFallbackResult();
  }

  const businessName = String(tenantConfig?.business?.name || "").trim();
  const businessType = String(tenantConfig?.business?.type || "").trim();
  const workflow = tenantConfig?.botProfile?.serviceWorkflow || {};
  const modelConfig = getModelConfigForTenant(tenantConfig);
  const extraContext = buildRuntimeContext(runtimeContext);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: Number(modelConfig.temperature || tenantConfig?.botProfile?.aiTemperature || 0.4),
        max_output_tokens: 120,
        input: [
          {
            role: "system",
            content:
              "Voce classifica mensagens de WhatsApp para um bot de servicos. " +
              "Responda apenas com JSON no schema fornecido. " +
              "Nunca invente dados do negocio. " +
              `${String(modelConfig.promptBase || "").trim() ? `Considere estas regras do modelo:\n${String(modelConfig.promptBase).trim()}\n` : ""}` +
              "Escolha apenas uma intencao entre: saudacao, pedir_servicos, site_landing_page, trafego_pago, google_meu_negocio, seo_local, preco_orcamento, portfolio, prazo_entrega, suporte_cliente, parceria_revenda, links_importantes, falar_com_humano, agradecimento, despedida, mensagem_confusa, produtos, servicos, parcerias, links, atendimento, preco, entrega, fora_do_escopo. " +
              "Use fora_do_escopo quando houver ambiguidade, baixa certeza ou assunto fora dessas categorias."
          },
          {
            role: "user",
            content:
              `Mensagem do cliente: "${trimmedMessage}"\n` +
              `Negocio: ${businessName || "Nao informado"}\n` +
              `Tipo de negocio: ${businessType || "Nao informado"}\n` +
              `Como funciona o atendimento: ${String(workflow.serviceProcess || tenantConfig?.business?.description || "").trim() || "Nao informado"}\n` +
              `Como funciona o orcamento: ${String(workflow.budgetMode || "").trim() || "Nao informado"}\n` +
              `Regras do negocio: ${String(workflow.notes || tenantConfig?.botProfile?.adjustablePrompt?.instrucoesNegocio || "").trim() || "Nao informado"}\n` +
              `${extraContext ? `${extraContext}\n` : ""}` +
              "Classifique apenas a intencao do cliente."
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "intent_detection",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: {
                  type: "string",
                  enum: ALLOWED_INTENTS
                },
                confidence: {
                  type: "number"
                }
              },
              required: ["intent", "confidence"]
            }
          }
        }
      })
    });

    if (!response.ok) {
      return buildFallbackResult();
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);

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
      confidence: normalizedConfidence
    };
  } catch (error) {
    console.error("Erro ao classificar intencao com IA:", error);
    return buildFallbackResult();
  }
}

module.exports = {
  detectIntentWithAI
};
