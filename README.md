# NRW:RP Bot

Der offizielle Discord Bot für **NRW:RP I German** — mit automatischen Willkommensnachrichten, Ticket-System und RP Start/Stop Ankündigungen. Alles wird direkt über Slash-Commands in Discord konfiguriert — keine Config-Dateien bearbeiten.

---

## Features

| System | Beschreibung |
|--------|-------------|
| 👋 **Willkommen** | Automatische Willkommensnachricht mit Banner, Channel-Erwähnungen und Nutzer-Mention wenn jemand dem Server beitritt |
| 🎫 **Tickets** | Vollständiges Ticket-System mit Kategorien, Dropdown-Panel, Transcripts und Staff-Verwaltung |
| 🎮 **RP Start/Stop** | Ankündigungen wenn das Roleplay startet oder endet, mit Rollen-Ping |
| ⚙️ **Setup** | Alles wird über `/setup` direkt in Discord konfiguriert — kein Bearbeiten von Dateien nötig |

---

## Voraussetzungen

- **Node.js** v18 oder höher
- **MongoDB** Datenbank ([kostenlos bei MongoDB Atlas](https://mongodb.com/atlas))
- **Discord Bot** ([discord.com/developers](https://discord.com/developers/applications))

---

## Installation

### 1. Repository klonen oder ZIP entpacken

```bash
cd NRWBot
npm install
```

### 2. Umgebungsvariablen setzen

Kopiere `.env.example` zu `.env` und fülle die Werte aus:

```env
DISCORD_TOKEN=dein_bot_token_hier
CLIENT_ID=deine_application_id
GUILD_ID=deine_server_id
DEVELOPER_ID=deine_discord_user_id
MONGO_URI=mongodb+srv://user:passwort@cluster0.xxxxx.mongodb.net/nrwrp
NODE_ENV=production
```

### 3. Slash-Commands registrieren

```bash
node deploy-commands.js
```

Du solltest folgende Ausgabe sehen:
```
Registriere 8 Slash-Commands...
✅ 8 Commands für Guild DEINE_GUILD_ID registriert.
```

### 4. Bot starten

```bash
node index.js
```

---

## Deployment auf Railway

### Schritt 1 — Code auf GitHub pushen

```bash
git init
git add .
git commit -m "NRW:RP Bot Initial"
git remote add origin https://github.com/DEIN_NAME/nrwrp-bot.git
git push -u origin main
```

### Schritt 2 — Railway Projekt erstellen

1. Gehe zu [railway.app](https://railway.app) und melde dich mit GitHub an
2. **New Project → Deploy from GitHub repo**
3. Wähle dein Repository aus

### Schritt 3 — Umgebungsvariablen in Railway setzen

Gehe zu deinem Service → **Variables** Tab und füge folgende ein:

| Variable | Wert |
|----------|------|
| `DISCORD_TOKEN` | Dein Bot Token |
| `CLIENT_ID` | Deine Application ID |
| `GUILD_ID` | Deine Server ID |
| `DEVELOPER_ID` | Deine Discord User ID |
| `MONGO_URI` | Dein MongoDB Connection String |
| `NODE_ENV` | `production` |

### Schritt 4 — Fertig

Railway deployt automatisch. Der Bot geht online und registriert die Slash-Commands beim Start.

---

## Erstkonfiguration in Discord

Nachdem der Bot online ist, führe diese Commands in deinem Server aus:

### 👋 Willkommen einrichten

```
/setup welcome channel channel:#willkommen
```
```
/setup welcome banner url:https://deine-banner-url.png
```
```
/setup welcome channels regeln:#regeln rollen:#rollen ticket:#ticket fraktionen:#fraktionen
```

Vorschau testen:
```
/setup welcome test
```

### 🎫 Ticket-System einrichten

```
/setup tickets logs channel:#ticket-logs
/setup tickets category kategorie:#TICKETS
/setup tickets addrole role:@Support
/setup tickets options max_per_user:1 dm_transcript:true close_delay:5
```

Ticket-Kategorien erstellen:
```
/createticket name:Support emoji:🎫 description:Allgemeiner Support teampingid:@Support
/createticket name:Technik emoji:🔧 description:Technische Probleme teampingid:@Support
/createticket name:Bewerbung emoji:📋 description:Bewirb dich im Team
/createticket name:Beschwerde emoji:⚖️ description:Beschwerde einreichen
```

Panel senden:
```
/ticketpanel channel:#support
```

### 🎮 RP Start/Stop einrichten

```
/setup rp channel channel:#ankündigungen
/setup rp role role:@Moderator
/setup rp pingrole role:@RP-Spieler
```

---

## Alle Commands

### ⚙️ Setup

| Command | Beschreibung |
|---------|-------------|
| `/setup view` | Aktuelle Konfiguration anzeigen |
| `/setup welcome channel` | Willkommens-Channel setzen |
| `/setup welcome banner` | Banner-URL setzen |
| `/setup welcome channels` | Alle Channel-Erwähnungen auf einmal setzen |
| `/setup welcome test` | Willkommensnachricht als Vorschau senden |
| `/setup tickets logs` | Log-Channel für Transcripts |
| `/setup tickets category` | Discord-Kategorie für Ticket-Channels |
| `/setup tickets addrole` | Support-Rolle hinzufügen |
| `/setup tickets removerole` | Support-Rolle entfernen |
| `/setup tickets options` | Max pro Nutzer, DM Transcript, Verzögerung |
| `/setup rp channel` | RP Ankündigungs-Channel |
| `/setup rp role` | Rolle die `/rp` benutzen darf |
| `/setup rp pingrole` | Rolle die bei Start/Stop gepingt wird |
| `/setup reset` | Einen Abschnitt zurücksetzen |

### 🎫 Tickets (Admin)

| Command | Beschreibung |
|---------|-------------|
| `/createticket` | Neue Ticket-Kategorie erstellen |
| `/deleteticket` | Ticket-Kategorie löschen (mit Autocomplete) |
| `/listtickets` | Alle Kategorien anzeigen |
| `/ticketpanel` | Panel in einen Channel senden |

### 🎫 Tickets (Staff & Nutzer)

| Command | Beschreibung |
|---------|-------------|
| `/ticket close` | Ticket schließen (erstellt Transcript) |
| `/ticket claim` | Ticket übernehmen |
| `/ticket unclaim` | Ticket freigeben |
| `/ticket add` | Nutzer zum Ticket hinzufügen |
| `/ticket remove` | Nutzer aus Ticket entfernen |
| `/ticket rename` | Channel umbenennen |
| `/ticket priority` | Priorität setzen (Low/Normal/High/Critical) |
| `/ticket list` | Offene Tickets anzeigen |
| `/ticket stats` | Ticket-Statistiken |

### 🎮 RP Start/Stop

| Command | Beschreibung |
|---------|-------------|
| `/rp start` | Roleplay starten — postet Embed + pingt Rolle |
| `/rp stop` | Roleplay beenden — postet Embed + pingt Rolle |
| `/rp status` | Aktuellen RP-Status anzeigen |

---

## Berechtigungen

Der Bot benötigt folgende Discord-Berechtigungen:

- `Manage Channels` — Ticket-Channels erstellen und löschen
- `Manage Roles` — Berechtigungen in Ticket-Channels setzen
- `Send Messages` — Nachrichten senden
- `Embed Links` — Embeds senden
- `Attach Files` — Transcripts als Datei anhängen
- `Read Message History` — Für Transcript-Erstellung
- `View Channels` — Channels sehen

Und folgende **Privileged Gateway Intents** im Developer Portal:
- ✅ Server Members Intent
- ✅ Message Content Intent
- ✅ Presence Intent

---

## Projektstruktur

```
NRWBot/
├── index.js                    # Einstiegspunkt
├── deploy-commands.js          # Slash-Commands registrieren
├── package.json
├── .env.example                # Vorlage für Umgebungsvariablen
├── commands/
│   ├── admin/
│   │   ├── setup.js            # /setup — komplette Konfiguration
│   │   ├── createticket.js     # /createticket /deleteticket /ticketpanel /listtickets
│   │   └── ticket.js           # /ticket — Staff-Verwaltung
│   └── rp/
│       └── rp.js               # /rp start/stop/status
├── events/
│   ├── ready.js                # Bot-Start Event
│   ├── guildMemberAdd.js       # Automatische Willkommensnachricht
│   └── interactionCreate.js    # Slash-Commands, Buttons, Modals, Dropdowns
├── models/
│   └── index.js                # MongoDB Modelle (GuildConfig, Ticket, TicketCategory)
└── utils/
    └── guildConfig.js          # Hilfsfunktionen für Guild-Konfiguration
```

---

## Wie funktioniert das Ticket-System?

1. Admin schickt das Panel mit `/ticketpanel` in einen Channel
2. Nutzer wählt eine Kategorie aus dem Dropdown
3. Ein Modal öffnet sich — Nutzer gibt Betreff und Beschreibung ein
4. Ein privater Channel wird erstellt (nur Nutzer + Support-Rollen sehen ihn)
5. Staff kann das Ticket mit dem **Übernehmen** Button beanspruchen
6. Ticket wird mit **Ticket schließen** Button oder `/ticket close` geschlossen
7. Ein Transcript wird automatisch im Log-Channel gepostet und dem Nutzer per DM gesendet
8. Der Channel wird nach der konfigurierten Verzögerung automatisch gelöscht

---

*NRW:RP I German*
