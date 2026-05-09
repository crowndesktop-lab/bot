function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findKeywordReply(messageText, keywordRules) {
  const normalizedMessage = normalizeText(messageText);

  if (!normalizedMessage) {
    return null;
  }

  return (
    keywordRules.find((rule) => {
      const keyword = normalizeText(rule.keyword);
      return keyword && normalizedMessage.includes(keyword);
    }) || null
  );
}

module.exports = {
  findKeywordReply,
  normalizeText
};
