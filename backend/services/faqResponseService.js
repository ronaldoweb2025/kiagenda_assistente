const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

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

async function generateFAQKnowledgeReply({ message, faqMatch, tenantConfig, state }) {
  const fallbackReply = interpolateTenantText(faqMatch?.resposta || "", tenantConfig);
  const apiKey = String(tenantConfig?.integration?.gemini?.apiKey || process.env.GEMINI_API_KEY || "").trim();
  const model = String(tenantConfig?.integration?.gemini?.model || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;

  if (!apiKey || !fallbackReply) {
    return fallbackReply;
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
                text:
                  "Voce e um assistente virtual de WhatsApp. " +
                  "Responda de forma natural, curta e profissional. " +
                  "Use a resposta do FAQ como unica fonte de verdade. " +
                  "Nao invente preco, prazo, link, garantia, promocao ou servico. " +
                  "Nao encaminhe para humano automaticamente, apenas ofereca se fizer sentido. " +
                  "Faca no maximo uma pergunta de continuidade."
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Empresa: ${tenantConfig?.business?.name || "Nao informado"}\n` +
                    `Pergunta cadastrada no FAQ: ${faqMatch?.pergunta || ""}\n` +
                    `Resposta cadastrada no FAQ: ${fallbackReply}\n` +
                    `Ultimas mensagens:\n${buildRecentMessagesText(state) || "Sem historico recente"}\n` +
                    `Mensagem atual do cliente: ${String(message || "").trim()}\n\n` +
                    "Reescreva a resposta para este contexto mantendo o mesmo sentido."
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 180
          }
        })
      }
    );

    if (!response.ok) {
      console.warn("FAQ knowledge: Gemini retornou erro", response.status);
      return fallbackReply;
    }

    const payload = await response.json();
    const reply = extractGeminiText(payload);
    return reply || fallbackReply;
  } catch (error) {
    console.warn("FAQ knowledge: falha ao gerar resposta com IA", error?.message || error);
    return fallbackReply;
  }
}

module.exports = {
  generateFAQKnowledgeReply,
  interpolateTenantText
};
