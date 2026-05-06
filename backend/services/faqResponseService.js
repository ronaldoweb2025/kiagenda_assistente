const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const { buildSystemPrompt, detectarFluxo } = require("./promptBuilder");

function interpolateTenantText(text, config = {}) {
  const businessName = config?.business?.name || "empresa";
  const attendantName = config?.business?.attendantName || "Atendimento";

  return String(text || "")
    .replace(/\{\{\s*business\.name\s*\}\}/gi, businessName)
    .replace(/\{\{\s*businessName\s*\}\}/gi, businessName)
    .replace(/\{\{\s*attendantName\s*\}\}/gi, attendantName)
    .replace(/\{\{\s*business\.attendantName\s*\}\}/gi, attendantName);
}

function extractGeminiText(payload = {}) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("")
    .trim();
}

function buildRecentMessagesText(state = {}) {
  const recentMessages = Array.isArray(state?.recentMessages) ? state.recentMessages.slice(-6) : [];

  return recentMessages
    .map((entry) => `${entry.role === "bot" ? "Bot" : "Cliente"}: ${entry.message}`)
    .join("\n");
}

function normalizeConversationHistoryItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .slice(-8)
    .map((item) => {
      const role = item?.role === "model" || item?.role === "bot" || item?.role === "assistant" ? "model" : "user";
      const content = String(item?.content || item?.message || "").trim();
      return content ? { role, content } : null;
    })
    .filter(Boolean);
}

function buildServicesText(tenantConfig = {}, activeService = null) {
  const services = Array.isArray(tenantConfig?.services) ? tenantConfig.services.slice(0, 12) : [];
  const lines = services
    .map((service) => {
      const parts = [
        service?.name || "",
        service?.description ? `descricao: ${service.description}` : "",
        service?.price ? `preco: ${service.price}` : "",
        Array.isArray(service?.keywords) && service.keywords.length ? `palavras: ${service.keywords.join(", ")}` : ""
      ].filter(Boolean);

      return parts.join(" | ");
    })
    .filter(Boolean);

  if (activeService?.name) {
    lines.unshift(`Servico em contexto: ${activeService.name}${activeService.description ? ` | ${activeService.description}` : ""}`);
  }

  return lines.join("\n");
}

async function generateConversationalReply({ message, faqMatch, tenantConfig, state, currentFlow = null, activeService = null, conversationHistory = null }) {
  const fallbackReply = interpolateTenantText(faqMatch?.resposta || "", tenantConfig);
  const apiKey = String(tenantConfig?.integration?.gemini?.apiKey || process.env.GEMINI_API_KEY || "").trim();
  const model = String(tenantConfig?.integration?.gemini?.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const tenant = tenantConfig || {};
  const userMessage = String(message || "").trim();
  const normalizedHistory = normalizeConversationHistoryItems(conversationHistory || state?.recentMessages || []);
  const fluxoAtivo = detectarFluxo(
    tenant.conversationFlows || [],
    userMessage,
    normalizedHistory
  ) || currentFlow;
  const contextExtra = fluxoAtivo
    ? `\n\n[FLUXO ATIVO: "${fluxoAtivo.name}" — siga as etapas desse roteiro agora]`
    : "";
  const systemPrompt = buildSystemPrompt(tenant) + contextExtra;

  if (!apiKey || (!fallbackReply && !currentFlow)) {
    return "";
  }

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
                text: systemPrompt
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Servicos cadastrados:\n${buildServicesText(tenantConfig, activeService) || "Nenhum servico cadastrado"}\n` +
                    `${faqMatch ? `FAQ knowledge encontrado:\nPergunta: ${faqMatch?.pergunta || ""}\nResposta: ${fallbackReply}\n` : ""}` +
                    `Ultimas mensagens:\n${normalizedHistory.map((entry) => `${entry.role === "model" ? "Bot" : "Cliente"}: ${entry.content}`).join("\n") || buildRecentMessagesText(state) || "Sem historico recente"}\n` +
                    `Mensagem atual do cliente: ${userMessage}\n\n` +
                    "Gere a melhor resposta para continuar o atendimento neste contexto."
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 350
          }
        })
      }
    );

    if (!response.ok) {
      console.warn("FAQ knowledge: Gemini retornou erro", response.status);
      return "";
    }

    const payload = await response.json();
    const reply = extractGeminiText(payload);
    return reply || "";
  } catch (error) {
    console.warn("FAQ knowledge: falha ao gerar resposta com IA", error?.message || error);
    return "";
  }
}

async function generateFAQKnowledgeReply({ message, faqMatch, tenantConfig, state }) {
  const reply = await generateConversationalReply({ message, faqMatch, tenantConfig, state });
  return reply || interpolateTenantText(faqMatch?.resposta || "", tenantConfig);
}

module.exports = {
  generateConversationalReply,
  generateFAQKnowledgeReply,
  interpolateTenantText
};
