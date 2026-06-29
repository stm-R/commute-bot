# 🚗 Commute Bot

A Discord bot that sends you a daily prompt to log your commute, stores the data, and generates monthly reports for your employer.

---

## Features

- **Daily button prompt** every weekday morning asking how you commuted
- **Persistent storage** in a Docker volume (JSON file)
- **`/report`** — full monthly report with all days, weekends auto-filled
- **`/log`** — manually log or correct any day, including weekend commutes
- **`/test`** — send a test prompt and preview what would be logged (no persistence)
- **`/help`** — help overview

---

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name (e.g. "Commute Bot")
3. Go to **Bot** → click **Add Bot**
4. Under **Token** → click **Reset Token** and copy it → this is your `DISCORD_TOKEN`
5. Copy the **Application ID** from the General Information page → this is your `DISCORD_CLIENT_ID`
6. Under **Bot** → enable **"Message Content Intent"** if needed (not strictly required)
7. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`, `Read Message History`
   - Copy the generated URL and open it to invite the bot to your server

### 2. Get Your Channel ID

1. In Discord, go to **User Settings → Advanced** → enable **Developer Mode**
2. Right-click the channel you want the bot to post in → **Copy Channel ID**
3. This is your `DISCORD_CHANNEL_ID`

### 2.1 Add The Bot To That Channel

Make sure the bot can access the selected channel.

1. Open the target channel settings → **Permissions**
2. Add the bot (or bot role) to the channel permissions
3. Allow at least:
  - **View Channel**
  - **Send Messages**
  - **Embed Links**

If the bot can run slash commands but cannot post scheduled prompts, this channel-level permission step is usually the cause.

### 3. Configure the App

```bash
cp .env.example .env
# Edit .env with your token, client ID, and channel ID
```

### 4. Register Slash Commands

Run this **once** to register the bot's slash commands with Discord:

```bash
# With docker compose (recommended):
docker compose run --rm commute-bot node src/register-commands.js

# Or locally (requires Node.js 18+):
npm install
node src/register-commands.js
```

> **Tip:** Set `DISCORD_GUILD_ID` in your `.env` for instant registration (guild-scoped). Without it, global commands can take up to 1 hour to appear.

### 5. Start the Bot

```bash
docker compose up -d
```

The bot will start and send a daily prompt every weekday at **08:00 Amsterdam time** (configurable).

If logs show `DiscordAPIError[50001]: Missing Access`, verify the bot has **View Channel** in the configured `DISCORD_CHANNEL_ID` channel.

---

## Commands

### `/report [month]`
Generate your monthly commute report.

- `month` — optional, format `YYYY-MM` (e.g. `2025-06`). Defaults to the current month.
- Weekdays without an entry show as **❓ Not logged**
- Weekend days without an entry show as **🌅 Weekend**
- Weekend days *with* a manual entry show the commute type tagged as *(weekend)*

Example:
```
/report month:2025-06
```

### `/log <type> [date]`
Manually log or correct a commute entry. Works for any day including **weekends**.

- `type` — required, choose from the dropdown
- `date` — optional, format `YYYY-MM-DD`. Defaults to today.

Use this to:
- Fix a wrong entry
- Log a day you missed
- Log a commute on a **weekend day** (e.g. you worked on Saturday)

Example:
```
/log type:car date:2025-06-07
```

### `/help`
Shows command overview and commute type list.

### `/test`
Sends a test prompt in the channel that behaves like the daily cron prompt.

- Uses the same commute buttons as the scheduled prompt
- Selected value is shown as a preview ("would log")
- Nothing is written to persistent storage

---

## Commute Types

| ID | Label | Emoji |
|---|---|---|
| `car` | Car | 🚗 |
| `carpool` | Carpool | 🚙 |
| `bike` | Bike | 🚲 |
| `ebike` | E-Bike | ⚡ |
| `public` | Public Transport | 🚌 |
| `walk` | Walking | 🚶 |
| `wfh` | Work From Home | 🏠 |
| `leave` | Day Off / Leave | 🌴 |

To add or remove types, edit `src/config.js` and re-run the slash command registration.

---

## Configuration

All configuration is via environment variables in `.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ | — | Bot token |
| `DISCORD_CLIENT_ID` | ✅ | — | Application ID |
| `DISCORD_CHANNEL_ID` | ✅ | — | Channel for daily prompts |
| `DISCORD_GUILD_ID` | ❌ | — | Guild ID for instant command registration |
| `CRON_SCHEDULE` | ❌ | `0 8 * * 1-5` | Cron for daily prompt (weekdays 08:00) |
| `TIMEZONE` | ❌ | `Europe/Amsterdam` | Timezone for scheduling |
| `DAYS_OFF` | ❌ | — | Comma-separated regular day(s) off to skip prompts (e.g. `wed` or `wed,fri`, also supports `0-6` with Sun=0) |

---

## Data Storage

Commutes are stored in `/data/commutes.json` inside the Docker volume:

```json
{
  "2025-06-02": "car",
  "2025-06-03": "wfh",
  "2025-06-04": "bike"
}
```

To back up:
```bash
docker compose cp commute-bot:/data/commutes.json ./commutes-backup.json
```

---

## Updating

```bash
docker compose build
docker compose up -d
```
