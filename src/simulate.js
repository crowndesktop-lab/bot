const keywordRules = require("../keywords.json");
const { findKeywordReply } = require("./keywordMatcher");

const message = process.argv.slice(2).join(" ");
const match = findKeywordReply(message, keywordRules);

console.log(
  JSON.stringify(
    {
      message,
      matchedKeyword: match?.keyword || null,
      reply: match?.reply || null
    },
    null,
    2
  )
);
