# 🎵 Discord Music Bot

A fully featured Discord music bot with YouTube support, queue management, volume control, loop, shuffle, and more — ready to deploy 24/7 on Railway.

---

## 📋 Commands

| Command | Alias | Description |
|---|---|---|
| `!play <song/URL>` | `!p` | Play a song or add to queue |
| `!pause` | — | Pause playback |
| `!resume` | `!r` | Resume playback |
| `!skip` | `!s` | Skip current song |
| `!stop` | — | Stop and clear queue |
| `!nowplaying` | `!np` | Show current song |
| `!queue` | `!q` | Show queue |
| `!shuffle` | — | Shuffle the queue |
| `!remove <#>` | — | Remove a song by number |
| `!clear` | — | Clear queue (keep current) |
| `!loop` | `!l` | Toggle loop mode |
| `!volume <0-200>` | `!v` | Set volume |
| `!leave` | `!dc` | Disconnect bot |
| `!help` | `!h` | Show all commands |

---

## 🚀 Setup Guide

### Step 1 — Create a Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** → give it a name → click **Create**
3. Go to the **"Bot"** tab on the left
4. Click **"Add Bot"** → confirm
5. Under **Privileged Gateway Intents**, enable:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent** (optional but recommended)
6. Click **"Reset Token"** → copy and save your **Bot Token** (you'll need it later)

### Step 2 — Invite Bot to Your Server

1. Go to the **"OAuth2"** → **"URL Generator"** tab
2. Under **Scopes**, check: `bot`
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Read Message History`
   - `Connect`
   - `Speak`
   - `Use Voice Activity`
   - `Embed Links`
4. Copy the generated URL and open it in your browser
5. Select your server and click **Authorize**

### Step 3 — Run Locally (Optional Test)

```bash
# 1. Clone or download this project
cd discord-music-bot

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
# Open .env and paste your bot token

# 4. Start the bot
npm start
```

You should see: `✅ Logged in as YourBot#1234`

---

## ☁️ Deploy 24/7 on Railway

### Step 1 — Push to GitHub

1. Create a free account at **https://github.com**
2. Create a **new repository** (name it `discord-music-bot`)
3. Upload all bot files to the repository:
   - `index.js`
   - `package.json`
   - `nixpacks.toml`
   - `.gitignore`
   - *(Do NOT upload `.env` — keep your token private!)*

   **Via Git (recommended):**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/discord-music-bot.git
   git push -u origin main
   ```

### Step 2 — Create Railway Account

1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Sign up / log in with your **GitHub account**

### Step 3 — Deploy on Railway

1. In Railway dashboard, click **"New Project"**
2. Click **"Deploy from GitHub repo"**
3. Select your `discord-music-bot` repository
4. Railway will detect the project automatically

### Step 4 — Add Environment Variables

1. In your Railway project, click on the **service** (the box that appeared)
2. Go to the **"Variables"** tab
3. Click **"New Variable"** and add:
   ```
   DISCORD_TOKEN = your_actual_bot_token_here
   PREFIX = !
   ```
4. Click **"Add"** for each variable

### Step 5 — Deploy!

1. Go to the **"Deployments"** tab
2. Railway will automatically build and deploy your bot
3. Watch the logs — you should see: `✅ Logged in as YourBot#1234`

Your bot is now **running 24/7** for free! 🎉

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| Bot doesn't respond | Check `MESSAGE CONTENT INTENT` is enabled in Dev Portal |
| Can't join voice | Make sure bot has `Connect` and `Speak` permissions |
| No audio / errors | Check Railway logs for errors; ffmpeg is auto-installed via nixpacks.toml |
| Bot goes offline | Check Railway for memory/crash issues in the "Metrics" tab |
| "Invalid Token" error | Double-check your `DISCORD_TOKEN` environment variable in Railway |

---

## 💡 Tips

- Change the prefix by setting `PREFIX=?` (or any character) in your Railway environment variables
- Railway's free tier gives **500 hours/month** — enough for 24/7 on one bot
- For multiple servers, the bot handles each server's queue independently
- Volume range is **0–200** (100 = normal, 200 = double volume)

---

## 📦 Tech Stack

- **discord.js** v14 — Discord API library
- **@discordjs/voice** — Voice connection handling  
- **@distube/ytdl-core** — YouTube audio streaming
- **yt-search** — YouTube search
- **ffmpeg** — Audio processing (auto-installed on Railway)
