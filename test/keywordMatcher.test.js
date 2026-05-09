const test = require("node:test");
const assert = require("node:assert/strict");
const { findKeywordReply } = require("../src/keywordMatcher");

const rules = [
  { keyword: "price", reply: "Pricing reply" },
  { keyword: "hello", reply: "Greeting reply" }
];

test("matches a keyword inside a message", () => {
  const match = findKeywordReply("Can you send price details?", rules);
  assert.equal(match.reply, "Pricing reply");
});

test("matches without caring about case", () => {
  const match = findKeywordReply("HELLO there", rules);
  assert.equal(match.reply, "Greeting reply");
});

test("returns null when there is no trigger keyword", () => {
  const match = findKeywordReply("I need something else", rules);
  assert.equal(match, null);
});
