require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const keywordRules = require("../keywords.json");
const { findKeywordReply } = require("./keywordMatcher");

const app = express();
const port = Number(process.env.PORT || 3000);
const dataPath = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.resolve(__dirname, "..");
const qrPath = path.join(dataPath, "qr.png");
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;
let botStatus = "starting";

fs.mkdirSync(dataPath, { recursive: true });

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "keyword-bot",
    dataPath
  }),
  puppeteer: {
    headless: true,
    executablePath: chromeExecutablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    status: botStatus,
    keywords: keywordRules.map((rule) => rule.keyword)
  });
});

app.get("/qr", (_req, res) => {
  if (!fs.existsSync(qrPath)) {
    return res.status(404).send("QR is not available yet. Check Railway logs.");
  }

  return res.sendFile(qrPath);
});

client.on("qr", async (qr) => {
  botStatus = "waiting_for_qr_scan";
  qrcodeTerminal.generate(qr, { small: true });
  await qrcode.toFile(qrPath, qr, {
    width: 360,
    margin: 2
  });

  console.log(`Scan the QR image at: ${qrPath}`);
});

client.on("ready", () => {
  botStatus = "ready";
  console.log("WhatsApp keyword bot is connected and ready.");
});

client.on("authenticated", () => {
  botStatus = "authenticated";
  console.log("WhatsApp login saved. Next starts should not need a new QR.");
});

client.on("auth_failure", (message) => {
  botStatus = "auth_failed";
  console.error("WhatsApp login failed:", message);
});

client.on("disconnected", (reason) => {
  botStatus = "disconnected";
  console.log("WhatsApp disconnected:", reason);
});

client.on("message", async (message) => {
  if (message.fromMe || message.type !== "chat") {
    return;
  }

  const match = findKeywordReply(message.body, keywordRules);

  if (!match) {
    return;
  }

  await sendKeywordReply(message, match);
  console.log(`Replied to ${message.from} for keyword "${match.keyword}"`);
});

async function sendKeywordReply(message, match) {
  if (!match.mediaPath) {
    await message.reply(match.reply);
    return;
  }

  const mediaPath = path.resolve(__dirname, "..", match.mediaPath);

  if (!fs.existsSync(mediaPath)) {
    console.warn(`Media file not found for keyword "${match.keyword}": ${mediaPath}`);
    await message.reply(match.reply);
    return;
  }

  const media = MessageMedia.fromFilePath(mediaPath);
  await message.reply(media, undefined, {
    caption: match.reply
  });
}

app.listen(port, () => {
  console.log(`Status page listening on port ${port}`);
});

client.initialize();
