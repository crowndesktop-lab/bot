# WhatsApp Keyword Bot

Small WhatsApp bot that connects by QR code and replies when an incoming message contains a trigger keyword.

It uses WhatsApp Web login:

1. Start the bot.
2. Scan the QR with WhatsApp.
3. A customer sends your number a message.
4. The bot checks `keywords.json`.
5. If a keyword is found, the bot replies with the matching text.

## Setup

Install dependencies:

```bash
npm install
```

Start the bot:

```bash
npm start
```

On your PC, keep it running in the background:

```powershell
Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WorkingDirectory "C:\Users\HEY!\OneDrive\Documents\New project\whatsapp-keyword-bot" -WindowStyle Hidden
```

## Connect By QR

When the bot starts, it creates:

```text
qr.png
```

Open that image and scan it from WhatsApp:

1. Open WhatsApp on your phone.
2. Go to Linked devices.
3. Tap Link a device.
4. Scan `qr.png`.

After login, the session is saved in `.wwebjs_auth`, so you usually do not need to scan again.

Keep the bot running while you want auto-replies to work.

You can check local status in a browser:

```text
http://localhost:3000/
```

## Edit Replies

Open `keywords.json` and add or change entries:

```json
[
  {
    "keyword": "price",
    "reply": "Our pricing depends on the service you need."
  },
  {
    "keyword": "What are your spa package prices",
    "reply": "We provide all kinds of antique body massage and spa services designed to help you relax and feel your best.",
    "mediaPath": "assets/spa-packages.png"
  }
]
```

The first matching keyword wins.

If `mediaPath` is set, the bot sends that image with the reply as the caption. If the image is missing, it still sends the text reply.

## Test Without WhatsApp

Test keyword matching without WhatsApp:

```bash
npm run simulate -- "hello, what is your price?"
```

Run the automated tests:

```bash
npm test
```
