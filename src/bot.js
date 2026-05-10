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
const projectPath = path.resolve(__dirname, "..");
const storagePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || projectPath;
const authDataPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? storagePath
  : path.join(projectPath, ".wwebjs_auth");
const qrPath = path.join(storagePath, "qr.png");
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;
const recentMessageIds = new Set();
const maxReconnectDelayMs = 5 * 60 * 1000;
let botStatus = "starting";
let client;
let reconnectTimer;
let reconnectAttempts = 0;
let lastEvent = "booting";
let isShuttingDown = false;

fs.mkdirSync(storagePath, { recursive: true });
fs.mkdirSync(authDataPath, { recursive: true });

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    status: botStatus,
    lastEvent,
    uptimeSeconds: Math.round(process.uptime()),
    keywords: keywordRules.map((rule) => rule.keyword)
  });
});

app.get("/qr", (_req, res) => {
  if (!fs.existsSync(qrPath)) {
    return res.status(404).send("QR is not available yet. Check Railway logs.");
  }

  return res.sendFile(qrPath);
});

function createClient() {
  const nextClient = new Client({
    authStrategy: new LocalAuth({
      clientId: "keyword-bot",
      dataPath: authDataPath
    }),
    puppeteer: {
      headless: true,
      executablePath: chromeExecutablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  nextClient.on("qr", async (qr) => {
    botStatus = "waiting_for_qr_scan";
    lastEvent = "qr_created";
    qrcodeTerminal.generate(qr, { small: true });
    await qrcode.toFile(qrPath, qr, {
      width: 360,
      margin: 2
    });

    console.log(`Scan the QR image at: ${qrPath}`);
  });

  nextClient.on("ready", () => {
    botStatus = "ready";
    lastEvent = "ready";
    reconnectAttempts = 0;
    console.log("WhatsApp keyword bot is connected and ready.");
  });

  nextClient.on("authenticated", () => {
    botStatus = "authenticated";
    lastEvent = "authenticated";
    console.log("WhatsApp login saved. Next starts should not need a new QR.");
  });

  nextClient.on("auth_failure", (message) => {
    botStatus = "auth_failed";
    lastEvent = "auth_failure";
    console.error("WhatsApp login failed:", message);
    scheduleReconnect("auth failure");
  });

  nextClient.on("disconnected", (reason) => {
    botStatus = "disconnected";
    lastEvent = `disconnected: ${reason}`;
    console.log("WhatsApp disconnected:", reason);
    scheduleReconnect(reason);
  });

  nextClient.on("message", handleIncomingMessage);

  return nextClient;
}

async function handleIncomingMessage(message) {
  try {
    if (message.fromMe || message.type !== "chat" || hasHandledMessage(message)) {
      return;
    }

    const match = findKeywordReply(message.body, keywordRules);

    if (!match) {
      return;
    }

    await sendKeywordReply(message, match);
    console.log(`Replied to ${message.from} for keyword "${match.keyword}"`);
  } catch (error) {
    lastEvent = "message_error";
    console.error("Could not handle incoming message:", error);
  }
}

function hasHandledMessage(message) {
  const messageId = message.id?._serialized || message.id?.id;

  if (!messageId) {
    return false;
  }

  if (recentMessageIds.has(messageId)) {
    return true;
  }

  recentMessageIds.add(messageId);
  setTimeout(() => recentMessageIds.delete(messageId), 10 * 60 * 1000).unref();
  return false;
}

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

function startClient() {
  clearTimeout(reconnectTimer);
  botStatus = "starting";
  lastEvent = "initializing";
  client = createClient();

  client.initialize().catch((error) => {
    botStatus = "start_failed";
    lastEvent = "initialize_failed";
    console.error("Could not initialize WhatsApp client:", error);
    scheduleReconnect("initialize failed");
  });
}

function scheduleReconnect(reason) {
  if (isShuttingDown || reconnectTimer) {
    return;
  }

  reconnectAttempts += 1;
  const delay = Math.min(5000 * reconnectAttempts, maxReconnectDelayMs);
  botStatus = "reconnecting";
  lastEvent = `reconnect scheduled: ${reason}`;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = undefined;

    try {
      if (client) {
        await client.destroy();
      }
    } catch (error) {
      console.warn("Could not fully close old WhatsApp client:", error.message);
    }

    startClient();
  }, delay);

  reconnectTimer.unref();
  console.log(`Reconnecting in ${Math.round(delay / 1000)} seconds.`);
}

async function shutdown(signal) {
  isShuttingDown = true;
  botStatus = "shutting_down";
  lastEvent = signal;
  clearTimeout(reconnectTimer);

  try {
    if (client) {
      await client.destroy();
    }
  } catch (error) {
    console.warn("Could not close WhatsApp client cleanly:", error.message);
  }

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  botStatus = "error";
  lastEvent = "uncaught_exception";
  console.error("Unexpected bot error:", error);
});
process.on("unhandledRejection", (error) => {
  botStatus = "error";
  lastEvent = "unhandled_rejection";
  console.error("Unexpected async bot error:", error);
});

app.listen(port, () => {
  console.log(`Status page listening on port ${port}`);
});

startClient();
