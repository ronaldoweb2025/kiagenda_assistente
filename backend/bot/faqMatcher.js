function normalizeFAQText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bvc\b/g, "voce")
    .replace(/\bvcs\b/g, "voces")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeFAQText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function getFAQQuestions(item = {}) {
  const questions = [];

  if (item.pergunta) {
    questions.push(item.pergunta);
  }

  if (Array.isArray(item.perguntas)) {
    questions.push(...item.perguntas);
  } else if (item.perguntas) {
    questions.push(item.perguntas);
  }

  return Array.from(new Set(questions.map((question) => String(question || "").trim()).filter(Boolean)));
}

function scoreFAQQuestion(message, question) {
  const normalizedMessage = normalizeFAQText(message);
  const normalizedQuestion = normalizeFAQText(question);

  if (!normalizedMessage || !normalizedQuestion) {
    return 0;
  }

  if (normalizedMessage === normalizedQuestion) {
    return 1;
  }

  if (normalizedQuestion.length >= 4 && normalizedMessage.includes(normalizedQuestion)) {
    return 0.95;
  }

  if (normalizedMessage.length >= 4 && normalizedQuestion.includes(normalizedMessage)) {
    return 0.9;
  }

  const messageTokens = tokenize(normalizedMessage);
  const questionTokens = tokenize(normalizedQuestion);

  if (!messageTokens.length || !questionTokens.length) {
    return 0;
  }

  const messageSet = new Set(messageTokens);
  const questionSet = new Set(questionTokens);
  const intersection = questionTokens.filter((token) => messageSet.has(token)).length;
  const union = new Set([...messageTokens, ...questionTokens]).size;
  const coverage = intersection / questionTokens.length;
  const jaccard = intersection / union;

  return Math.max(jaccard, coverage * 0.9);
}

function matchFAQ(message, faqList = [], threshold = 0.7) {
  if (!Array.isArray(faqList) || !faqList.length) {
    return null;
  }

  let bestMatch = null;

  faqList.forEach((item) => {
    if (!item?.resposta) {
      return;
    }

    getFAQQuestions(item).forEach((question) => {
      const score = scoreFAQQuestion(message, question);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          pergunta: question,
          resposta: item.resposta,
          mode: String(item.mode || item.modo || "knowledge").trim().toLowerCase() === "fixed" ? "fixed" : "knowledge",
          score,
          item
        };
      }
    });
  });

  return bestMatch && bestMatch.score >= threshold ? bestMatch : null;
}

module.exports = {
  matchFAQ,
  normalizeFAQText,
  scoreFAQQuestion
};
