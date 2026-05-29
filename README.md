<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=5865F2&height=200&section=header&text=NRW:RP%20Bot&fontSize=60&fontColor=ffffff&fontAlignY=38&desc=Der%20offizielle%20Discord%20Bot%20für%20NRW:RP%20I%20German&descAlignY=60&descSize=18" width="100%"/>

[![Discord.js](https://img.shields.io/badge/discord.js-v14.16-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/node.js-≥18.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com/atlas)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app)
[![License](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/status-aktiv-brightgreen?style=for-the-badge)]()

</div>

---

## 📋 Übersicht

**NRW:RP Bot** ist ein vollständiger All-in-One Discord Bot für Roleplay-Server — mit Ticket-System, Willkommensnachrichten, RP Start/Stop, Fraktionsverwaltung, Moderations-Tools, AutoMod, Giveaways und einem Web-Dashboard. Alles konfigurierbar direkt in Discord oder im Browser — keine Config-Dateien nötig.

---

## ✨ Features

<table>
<tr>
<td>

**🎮 RP & Server**
- RP Start/Stop mit Components V2
- Edit-in-place Nachrichten
- Fraktionsliste mit Kategorien
- Fraktions-Ankündigungen
- Team-Liste

</td>
<td>

**🎫 Tickets**
- Dropdown-Panel (Components V2)
- Kategorien mit `/createticket`
- Transcripts per DM
- Claim/Close Buttons
- Staff-Rollen

</td>
<td>

**🛡️ Moderation**
- Ban, Kick, Timeout, Warn
- Purge, Lock, Slowmode
- AutoMod (Link/Spam/Badwords)
- Mod-Log Channel
- Verwarnungssystem

</td>
</tr>
<tr>
<td>

**👋 Willkommen**
- Components V2 Layout
- Banner-Bild Support
- Vollständig anpassbar
- Platzhalter-System
- Test-Command

</td>
<td>

**🎉 Extras**
- Giveaway-System mit DM
- Fun-Commands (Slap, Hug...)
- Voice-Moderation
- AFK-System
- Snipe-Command

</td>
<td>

**🌐 Dashboard**
- Discord OAuth2 Login
- Alle Settings im Browser
- Nachrichten anpassen
- Staff-Rollen verwalten
- Module ein/ausschalten

</td>
</tr>
</table>

---

## 🚀 Quickstart

### Voraussetzungen

[![Node.js](https://img.shields.io/badge/Node.js-≥18.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20Free-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com/atlas)
[![Discord](https://img.shields.io/badge/Discord-Developer%20Portal-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.com/developers/applications)

### 1. Installation

```bash
cd NRWBot
npm install
```

### 2. Environment Variables

Erstelle eine `.env` Datei (aus `.env.example`):

```env
# Discord
DISCORD_TOKEN=dein_bot_token
CLIENT_ID=deine_application_id
GUILD_ID=deine_server_id
DEVELOPER_ID=deine_user_id

# Datenbank
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/nrwrp

# Dashboard
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000
DASHBOARD_BASE_URL=https://dein-projekt.railway.app
DASHBOARD_SECRET=zufaelliger-geheimer-string
DISCORD_CLIENT_SECRET=dein_oauth_client_secret

NODE_ENV=production
```

### 3. Commands registrieren & starten

```bash
node deploy-commands.js   # einmalig
node index.js             # oder: npm start
```

---

## 🚂 Deployment auf Railway

```bash
# 1. Auf GitHub pushen
git init && git add . && git commit -m "init"
git remote add origin https://github.com/DEIN_NAME/nrwrp-bot.git
git push -u origin main
```

**Railway Setup:**
1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Repo auswählen
3. **Variables** Tab → alle Env-Variablen eintragen:

| Variable | Beschreibung |
|---|---|
| `DISCORD_TOKEN` | Bot Token |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | Server ID |
| `DEVELOPER_ID` | Deine Discord User ID |
| `MONGO_URI` | MongoDB Connection String |
| `DASHBOARD_ENABLED` | `true` |
| `DASHBOARD_PORT` | `3000` |
| `DASHBOARD_BASE_URL` | `https://dein-projekt.railway.app` |
| `DASHBOARD_SECRET` | Zufälliger String |
| `DISCORD_CLIENT_SECRET` | OAuth2 Client Secret |
| `NODE_ENV` | `production` |

4. **Settings → Networking → Generate Domain** → Port `3000`

> Commands werden beim Start automatisch registriert.

---

## ⚙️ Erstkonfiguration in Discord

### 1. Willkommen

```
/setup welcome channel channel:#willkommen
/setup welcome banner url:https://deine-banner-url.png
/setup welcome channels regeln:#regeln rollen:#rollen ticket:#ticket fraktionen:#fraktionen
/setup welcome test
```

### 2. Tickets

```
/setup tickets logs channel:#ticket-logs
/setup tickets category kategorie:#TICKETS
/setup tickets addrole role:@Support
/createticket name:Support emoji:🎫 description:Allgemeiner Support
/ticketpanel channel:#support
```

### 3. RP Start/Stop

```
/setup rp channel channel:#ankündigungen
/setup rp role role:@Moderator
/setup rp pingrole role:@RP-Spieler
```

### 4. Fraktionen

```
/fraksetup channels liste:#fraktionsliste ankündigungen:#frak-news
/fraksetup rolle role:@Fraktionsverwaltung
/frakcreate name:Polizei leitung:@User standort:Depot discord:https://... kategorie:staatlich
/fraklist
```

### 5. Module verwalten

```
/module toggle modul:willkommen aktiviert:false
/module status
```

---

## 📖 Command-Referenz

<details>
<summary><b>⚙️ Setup Commands</b></summary>

| Command | Beschreibung |
|---|---|
| `/setup view` | Aktuelle Konfiguration anzeigen |
| `/setup welcome channel` | Willkommens-Channel |
| `/setup welcome banner` | Banner-URL |
| `/setup welcome channels` | Regelwerk/Rollen/Ticket/Fraktionen Channel |
| `/setup welcome test` | Vorschau senden |
| `/setup tickets logs` | Transcript Log-Channel |
| `/setup tickets category` | Discord-Kategorie für Tickets |
| `/setup tickets addrole/removerole` | Support-Rollen verwalten |
| `/setup tickets options` | Max, DM, Delay |
| `/setup rp channel/role/pingrole` | RP Konfiguration |
| `/setup logging set` | Log-Channel pro Event setzen |
| `/setup logging toggle` | Logging an/aus |
| `/setup moderation logchannel` | Mod-Log Channel |
| `/setup emojis set/list/reset` | Custom Emojis |
| `/setup branding set` | Name, Farbe, Footer |

</details>

<details>
<summary><b>🎫 Ticket Commands</b></summary>

| Command | Wer | Beschreibung |
|---|---|---|
| `/createticket` | Admin | Neue Kategorie erstellen |
| `/deleteticket` | Admin | Kategorie löschen |
| `/listtickets` | Admin | Alle Kategorien anzeigen |
| `/ticketpanel` | Admin | Panel senden |
| `/ticket close` | Staff/Owner | Ticket schließen + Transcript |
| `/ticket claim/unclaim` | Staff | Übernehmen/Freigeben |
| `/ticket add/remove` | Staff | Nutzer hinzufügen/entfernen |
| `/ticket rename` | Staff | Channel umbenennen |
| `/ticket priority` | Staff | Low/Normal/High/Critical |
| `/ticket list` | Staff | Offene Tickets anzeigen |
| `/ticket stats` | Staff | Statistiken |

</details>

<details>
<summary><b>🛡️ Moderations Commands</b></summary>

| Command | Berechtigung | Beschreibung |
|---|---|---|
| `/ban` | Ban Members | Nutzer bannen |
| `/kick` | Kick Members | Nutzer kicken |
| `/timeout` | Moderate Members | Timeout geben |
| `/untimeout` | Moderate Members | Timeout aufheben |
| `/warn` | Moderate Members | Verwarnung |
| `/warnings` | Moderate Members | Verwarnungen anzeigen |
| `/clearwarns` | Administrator | Alle Verwarnungen löschen |
| `/purge` | Manage Messages | Nachrichten löschen |
| `/lock/unlock` | Manage Channels | Channel sperren |
| `/slowmode` | Manage Channels | Slowmode setzen |
| `/nick` | Manage Nicknames | Nickname ändern |

</details>

<details>
<summary><b>🤖 AutoMod Commands</b></summary>

| Command | Beschreibung |
|---|---|
| `/automod antilink` | Anti-Link ein/aus + Aktion |
| `/automod antispam` | Anti-Spam ein/aus + Limit |
| `/automod antibadwords` | Anti-Badwords ein/aus |
| `/automod addword/removeword` | Blacklist verwalten |
| `/automod ignore` | Channel/Rolle ignorieren |
| `/automod status` | Aktuellen Status anzeigen |

</details>

<details>
<summary><b>🏛️ Fraktions Commands</b></summary>

| Command | Beschreibung |
|---|---|
| `/fraksetup channels` | Listen + Ankündigungs-Channel |
| `/fraksetup rolle` | Erlaubte Rolle für Frak-Commands |
| `/fraksetup banner` | Banner-URL für Ankündigungen |
| `/fraksetup status` | Aktuelle Konfiguration |
| `/frakcreate` | Fraktion offiziell machen |
| `/frakdelete` | Fraktion auflösen |
| `/frakwarn` | Fraktion verwarnen |
| `/frakupdate` | Leitung/Discord/Standort aktualisieren |
| `/fraklist` | Fraktionsliste posten/aktualisieren |

**Kategorien:** 🏛️ Staatlich · 💀 Illegal · 🏢 Firma · 📋 Andere

**Platzhalter:** `{name}` `{warns}` `{grund}` `{leitungId}` `{standort}` `{discord}`

</details>

<details>
<summary><b>🎉 Giveaway Commands</b></summary>

| Command | Beschreibung |
|---|---|
| `/giveaway start` | Neues Giveaway (Preis, Dauer, Gewinner) |
| `/giveaway end` | Giveaway sofort beenden |
| `/giveaway reroll` | Neuen Gewinner auswählen |
| `/giveaway list` | Aktive Giveaways anzeigen |

> Gewinner erhalten automatisch eine **DM**.

</details>

<details>
<summary><b>🎮 RP Commands</b></summary>

| Command | Beschreibung |
|---|---|
| `/rp start` | RP starten — editiert bestehende Nachricht |
| `/rp stop` | RP beenden — editiert dieselbe Nachricht |
| `/rp status` | Aktuellen RP-Status anzeigen |

</details>

<details>
<summary><b>🎲 Fun & Voice Commands</b></summary>

| Command | Beschreibung |
|---|---|
| `/slap /hug /kiss` | Anime-GIF Reaktionen |
| `/coinflip` | Münze werfen |
| `/8ball` | Magische 8-Ball |
| `/roll` | Würfeln |
| `/avatar` | Avatar anzeigen |
| `/serverinfo /userinfo` | Server/Nutzer Info |
| `/afk` | AFK setzen/entfernen |
| `/snipe` | Letzte gelöschte Nachricht |
| `/ping` | Latenz anzeigen |
| `/vcmute /vcunmute` | Voice stumm/entstumm |
| `/vcdeafen /vcundeafen` | Voice taubschalten |
| `/vcmuteall /vcunmuteall` | Alle stumm/entstumm |
| `/vckickall` | Alle aus Voice kicken |
| `/vcmove` | Nutzer verschieben |

</details>

<details>
<summary><b>⚙️ Admin Utilities</b></summary>

| Command | Beschreibung |
|---|---|
| `/module toggle` | Modul ein/ausschalten |
| `/module status` | Status aller Module |
| `/emoji upload` | Emojis hochladen |
| `/emoji list/set/reset` | Emoji-Slots verwalten |
| `/teamlist` | Teamliste posten |

</details>

---

## 🌐 Web Dashboard

Das Dashboard ist unter `https://dein-projekt.railway.app` erreichbar.

**Login:** Discord OAuth2 — nur Server-Admins haben Zugang.

**Verfügbare Seiten:**

| Seite | Inhalt |
|---|---|
| 📊 Übersicht | Server-Stats, Bot-Info, Quickstart |
| 👋 Willkommen | Channel, Banner, alle Texte |
| 🎮 RP | Channel, Rollen, Nachrichten |
| 🎫 Tickets | Einstellungen, Kategorien-Liste |
| 🛡️ Moderation | Mod-Log Channel |
| 🤖 AutoMod | Toggles direkt im Browser |
| 📋 Logging | 11 Events konfigurierbar |
| 🎉 Giveaways | Command-Übersicht |
| ✏️ Nachrichten | Willkommen + RP Texte anpassen |
| 🏛️ Fraktionen | Listen-Stil, Ankündigungen, aktive Fraktionen |
| 👮 Staff Rollen | Support + Review-Rollen verwalten |
| 👮 Team Liste | Rollen für Teamliste auswählen |
| ⚙️ Module | Alle Module ein/ausschalten |

**Discord OAuth2 einrichten:**
1. [discord.com/developers](https://discord.com/developers/applications) → deine App → **OAuth2**
2. Redirect URI hinzufügen: `https://dein-projekt.railway.app/auth/callback`
3. Client Secret → Railway Variable `DISCORD_CLIENT_SECRET`

---

## 🔐 Berechtigungen

**Bot Permissions:**

[![Manage Channels](https://img.shields.io/badge/Manage%20Channels-required-red?style=flat-square)]()
[![Manage Roles](https://img.shields.io/badge/Manage%20Roles-required-red?style=flat-square)]()
[![Send Messages](https://img.shields.io/badge/Send%20Messages-required-red?style=flat-square)]()
[![Embed Links](https://img.shields.io/badge/Embed%20Links-required-red?style=flat-square)]()
[![Attach Files](https://img.shields.io/badge/Attach%20Files-required-red?style=flat-square)]()
[![Manage Messages](https://img.shields.io/badge/Manage%20Messages-required-red?style=flat-square)]()
[![Read Message History](https://img.shields.io/badge/Read%20Message%20History-required-red?style=flat-square)]()
[![Kick Members](https://img.shields.io/badge/Kick%20Members-moderation-orange?style=flat-square)]()
[![Ban Members](https://img.shields.io/badge/Ban%20Members-moderation-orange?style=flat-square)]()
[![Moderate Members](https://img.shields.io/badge/Moderate%20Members-moderation-orange?style=flat-square)]()
[![Manage Nicknames](https://img.shields.io/badge/Manage%20Nicknames-moderation-orange?style=flat-square)]()

**Privileged Gateway Intents** (Developer Portal → Bot):

- ✅ **Server Members Intent** — Willkommen, Member-Infos
- ✅ **Message Content Intent** — AutoMod, Snipe
- ✅ **Presence Intent** — AFK-Status

---

## 📁 Projektstruktur

```
NRWBot/
├── index.js                         # Einstiegspunkt + Dashboard-Start
├── deploy-commands.js               # Slash-Commands registrieren
├── package.json
├── .env.example
│
├── commands/
│   ├── admin/
│   │   ├── setup.js                 # /setup (alle Server-Settings)
│   │   ├── createticket.js          # /createticket /deleteticket /ticketpanel
│   │   ├── ticket.js                # /ticket (Staff-Commands)
│   │   ├── automod.js               # /automod
│   │   ├── module.js                # /module toggle/status
│   │   ├── teamlist.js              # /teamlist
│   │   └── emoji.js                 # /emoji upload/list/set
│   ├── moderation/
│   │   └── moderation.js            # /ban /kick /timeout /warn /purge...
│   ├── giveaway/
│   │   └── giveaway.js              # /giveaway start/end/reroll/list
│   ├── fraktion/
│   │   └── fraktion.js              # /fraksetup /frakcreate /frakdelete...
│   └── fun/
│       ├── fun.js                   # /slap /hug /kiss /8ball /avatar...
│       └── voice.js                 # /vcmute /vcmuteall /vckickall...
│
├── events/
│   ├── ready.js                     # Bot-Start
│   ├── guildMemberAdd.js            # Willkommen (Components V2)
│   ├── guildMemberRemove.js         # Member-Leave Logging
│   ├── messageCreate.js             # AutoMod + AFK
│   ├── messageDelete.js             # Snipe + Logging
│   └── interactionCreate.js         # Alle Interactions routen
│
├── models/
│   └── index.js                     # MongoDB: GuildConfig, Ticket, TicketCategory, Fraktion
│
├── utils/
│   ├── guildConfig.js               # DB-Config Helper
│   └── emojiManager.js              # Custom Emoji System
│
├── dashboard/
│   └── server.js                    # Express + Discord OAuth2 Dashboard
│
└── assets/
    └── emojis/                      # 20 bundled emoji PNGs
```

---

## 💡 Platzhalter-System

Willkommens-Nachrichten und Fraktions-Ankündigungen unterstützen Platzhalter:

| Platzhalter | Beschreibung | Verfügbar in |
|---|---|---|
| `{nick}` | Anzeigename des Nutzers | Willkommen |
| `{rules}` | #regelwerk Channel | Willkommen |
| `{roles}` | #rollen Channel | Willkommen |
| `{ticket}` | #ticket Channel | Willkommen |
| `{fraktionen}` | #fraktionen Channel | Willkommen |
| `{name}` | Fraktionsname | Frak-Ankündigungen |
| `{warns}` | Anzahl Verwarnungen | Frak-Ankündigungen |
| `{grund}` | Grund der Aktion | Frak-Ankündigungen |
| `{leitungId}` | Leitungs-Discord-ID | Frak-Ankündigungen |
| `{standort}` | Standort | Frak-Ankündigungen |

---

<div align="center">

[![Made with Discord.js](https://img.shields.io/badge/Made%20with-Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Deployed on Railway](https://img.shields.io/badge/Deployed%20on-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)

**NRW:RP I German**

</div>

<img src="https://capsule-render.vercel.app/api?type=waving&color=5865F2&height=120&section=footer" width="100%"/>
