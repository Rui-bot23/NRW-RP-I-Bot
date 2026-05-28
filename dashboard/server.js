/**
 * dashboard/server.js
 * FastAPI-style dashboard via Express + Discord OAuth2
 * Inspired by Reo bot's surface/server.py
 *
 * Features:
 *  - Discord OAuth2 login
 *  - Server list (guilds you manage)
 *  - Per-guild overview: members, channels, roles, tickets, RP state
 *  - Config panels: Welcome, Tickets, RP, Moderation, Emojis
 *  - Live bot stats
 */

const express    = require("express");
const session    = require("express-session");
const fetch      = require("node-fetch");
const path       = require("path");
const { GuildConfig, Ticket, TicketCategory } = require("../models");

const DISCORD_API   = "https://discord.com/api/v10";
const ADMINISTRATOR = 0x8;
const MANAGE_GUILD  = 0x20;

function canManage(rawGuild) {
  const perms = parseInt(rawGuild.permissions || "0");
  return rawGuild.owner || !!(perms & ADMINISTRATOR) || !!(perms & MANAGE_GUILD);
}

function guildIcon(guild) {
  return guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";
}

function createDashboard(client, config) {
  const app = express();
  const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DASHBOARD_BASE_URL,
    DASHBOARD_SECRET,
    DASHBOARD_PORT,
  } = config;

  const CALLBACK_URL = `${DASHBOARD_BASE_URL}/auth/callback`;

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(session({
    secret: DASHBOARD_SECRET || "nrwrp-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  // ── CSS ─────────────────────────────────────────────────────────────────────
  const CSS = `
    :root {
      --bg: #060203; --panel: rgba(11,6,7,0.92); --panel2: rgba(7,2,4,0.98);
      --line: rgba(255,255,255,0.08); --line2: rgba(255,255,255,0.14);
      --text: #fff4f5; --muted: #b69499; --brand: #ff5067; --brand2: #8f1429;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html{color-scheme:dark}
    body{min-height:100vh;color:var(--text);font-family:system-ui,sans-serif;
      background:radial-gradient(circle at top left,rgba(255,80,103,.16),transparent 24%),
        radial-gradient(circle at top right,rgba(143,20,41,.16),transparent 24%),
        linear-gradient(180deg,#030102,#080304 46%,#050203);
      background-attachment:fixed}
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}
    a{color:inherit;text-decoration:none}
    .frame{width:min(1200px,calc(100% - 24px));margin:16px auto;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));backdrop-filter:blur(18px)}
    .topbar{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line);background:rgba(16,8,10,.72);position:sticky;top:0;z-index:10}
    .brand{font-size:1.1rem;font-weight:800;letter-spacing:.06em}
    .brand span{color:var(--brand)}
    .content{padding:20px;display:grid;gap:16px}
    .panel{border:1px solid var(--line);border-radius:16px;padding:20px;background:linear-gradient(180deg,var(--panel),var(--panel2))}
    h1{font-size:1.8rem;font-weight:800;letter-spacing:-.03em;margin-bottom:8px}
    h2{font-size:1rem;font-weight:700;margin-bottom:12px;color:var(--muted)}
    h3{font-size:.95rem;font-weight:700;margin-bottom:8px}
    .muted{color:var(--muted);font-size:.88rem;line-height:1.6}
    .btn,.save-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border:1px solid var(--line);border-radius:999px;font-weight:700;cursor:pointer;transition:all .18s;white-space:nowrap;font-size:.9rem}
    .btn{background:rgba(255,255,255,.04);color:var(--text)}
    .btn:hover{background:rgba(255,255,255,.08);border-color:var(--line2);transform:translateY(-1px)}
    .btn.active,.btn.brand{background:linear-gradient(135deg,var(--brand),var(--brand2));border-color:transparent;box-shadow:0 8px 20px rgba(143,20,41,.3)}
    .save-btn{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff8f9;border:none;width:100%;margin-top:12px;padding:12px}
    .save-btn:hover{transform:translateY(-1px);box-shadow:0 12px 24px rgba(143,20,41,.4)}
    .guild-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
    .guild-card{border:1px solid var(--line);border-radius:16px;padding:16px;background:rgba(255,255,255,.02);display:flex;align-items:center;gap:12px;transition:all .18s}
    .guild-card:hover{border-color:var(--line2);background:rgba(255,255,255,.05);transform:translateY(-2px)}
    .guild-card img{width:48px;height:48px;border-radius:14px;object-fit:cover}
    .guild-card .info strong{display:block;font-weight:700;font-size:.95rem}
    .guild-card .info span{color:var(--muted);font-size:.82rem}
    .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .stat-card{border:1px solid var(--line);border-radius:14px;padding:16px;background:rgba(255,255,255,.02)}
    .stat-card .label{color:var(--muted);font-size:.82rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
    .stat-card .value{font-size:1.8rem;font-weight:800;letter-spacing:-.04em;margin-top:4px}
    .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
    .tab{padding:8px 14px;border:1px solid var(--line);border-radius:999px;font-size:.88rem;font-weight:600;background:rgba(255,255,255,.02);transition:all .18s}
    .tab:hover{background:rgba(255,255,255,.06);border-color:var(--line2)}
    .tab.active{background:rgba(255,80,103,.14);border-color:rgba(255,80,103,.3)}
    .form-group{margin-bottom:14px}
    .form-group label{display:block;font-size:.85rem;font-weight:600;color:var(--muted);margin-bottom:6px}
    .form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 14px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:.9rem;outline:none;transition:border-color .18s}
    .form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:rgba(255,80,103,.4)}
    .form-group select option{background:#1a0a0d;color:var(--text)}
    .form-group textarea{resize:vertical;min-height:80px}
    .toggle{display:flex;align-items:center;gap:10px;cursor:pointer}
    .toggle input[type=checkbox]{width:36px;height:20px;appearance:none;background:rgba(255,255,255,.1);border-radius:999px;border:1px solid var(--line);cursor:pointer;transition:all .18s;position:relative}
    .toggle input[type=checkbox]:checked{background:var(--brand);border-color:var(--brand)}
    .badge{display:inline-flex;padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:700}
    .badge.green{background:rgba(87,242,135,.15);color:#57f287;border:1px solid rgba(87,242,135,.3)}
    .badge.red{background:rgba(237,66,69,.15);color:#ed4245;border:1px solid rgba(237,66,69,.3)}
    .badge.yellow{background:rgba(254,231,92,.15);color:#fee75c;border:1px solid rgba(254,231,92,.3)}
    .notice{padding:12px 16px;border-radius:12px;border:1px solid rgba(255,80,103,.24);background:rgba(255,80,103,.1);color:#ffe3e7;margin-bottom:16px}
    .cat-list{display:grid;gap:8px}
    .cat-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02)}
    .cat-row .name{font-weight:700}
    .cat-row .meta{color:var(--muted);font-size:.82rem}
    @media(max-width:600px){.grid-3,.grid-2{grid-template-columns:1fr}}
  `;

  // ── Layout helper ──────────────────────────────────────────────────────────
  function layout(title, body, user = null, notice = "") {
    const userHtml = user
      ? `<div style="display:flex;align-items:center;gap:10px">
           <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png"}" style="width:36px;height:36px;border-radius:10px">
           <strong>${user.username}</strong>
           <a href="/logout" class="btn" style="padding:6px 12px;font-size:.82rem">Logout</a>
         </div>`
      : `<a href="/login" class="btn brand">Mit Discord anmelden</a>`;

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — NRW:RP Dashboard</title>
  <style>${CSS}</style>
</head>
<body>
<div class="frame">
  <div class="topbar">
    <div class="brand">NRW:RP <span>Dashboard</span></div>
    ${userHtml}
  </div>
  <div class="content">
    ${notice ? `<div class="notice">${notice}</div>` : ""}
    ${body}
  </div>
</div>
</body>
</html>`;
  }

  // ── Auth Routes ─────────────────────────────────────────────────────────────
  app.get("/login", (req, res) => {
    const state = Math.random().toString(36).slice(2);
    req.session.oauthState = state;
    const params = new URLSearchParams({
      client_id:     DISCORD_CLIENT_ID,
      redirect_uri:  CALLBACK_URL,
      response_type: "code",
      scope:         "identify guilds",
      state,
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code || state !== req.session.oauthState) return res.redirect("/?error=state");

    try {
      // Exchange code for token
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type:    "authorization_code",
          code,
          redirect_uri:  CALLBACK_URL,
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) return res.redirect("/?error=token");

      // Get user info
      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await userRes.json();

      // Get guilds
      const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const guilds = await guildsRes.json();

      req.session.user      = user;
      req.session.guilds    = guilds;
      req.session.oauthState = null;

      res.redirect("/servers");
    } catch (err) {
      console.error("[DASHBOARD AUTH]", err);
      res.redirect("/?error=auth");
    }
  });

  app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
  });

  // ── Home ────────────────────────────────────────────────────────────────────
  app.get("/", (req, res) => {
    const user = req.session.user;
    const body = `
      <div class="panel" style="text-align:center;padding:48px 32px">
        <h1>NRW:RP <span style="color:var(--brand)">Dashboard</span></h1>
        <p class="muted" style="margin:12px 0 24px;max-width:480px;margin-left:auto;margin-right:auto">
          Verwalte deinen NRW:RP Server direkt im Browser — Tickets, Willkommen, RP Start/Stop, Moderation und mehr.
        </p>
        ${user
          ? `<a href="/servers" class="btn brand">Meine Server →</a>`
          : `<a href="/login" class="btn brand">Mit Discord anmelden</a>`}
      </div>
      <div class="grid-3">
        <div class="stat-card">
          <div class="label">Server</div>
          <div class="value">${client.guilds.cache.size}</div>
        </div>
        <div class="stat-card">
          <div class="label">Uptime</div>
          <div class="value">${formatUptime(client.uptime || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Ping</div>
          <div class="value">${client.ws.ping}ms</div>
        </div>
      </div>
    `;
    res.send(layout("Home", body, user));
  });

  // ── Server List ─────────────────────────────────────────────────────────────
  app.get("/servers", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const manageable = (req.session.guilds || [])
      .filter(canManage)
      .filter(g => client.guilds.cache.has(g.id));

    const cards = manageable.map(g => {
      const botGuild = client.guilds.cache.get(g.id);
      return `
        <a class="guild-card" href="/guild/${g.id}">
          <img src="${guildIcon(g)}" alt="${g.name}">
          <div class="info">
            <strong>${g.name}</strong>
            <span>${botGuild?.memberCount || "?"} Mitglieder</span>
          </div>
        </a>
      `;
    }).join("");

    const body = `
      <div class="panel">
        <h1>Deine Server</h1>
        <p class="muted">Wähle einen Server den du verwalten möchtest.</p>
      </div>
      <div class="guild-grid">${cards || '<p class="muted">Keine Server gefunden auf denen der Bot ist und du Admin bist.</p>'}</div>
    `;
    res.send(layout("Server", body, req.session.user));
  });

  // ── Guild Overview ──────────────────────────────────────────────────────────
  app.get("/guild/:id", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.redirect("/servers");

    const cfg = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const [openTickets, totalTickets, ticketCats] = await Promise.all([
      Ticket.countDocuments({ guildId: req.params.id, status: "open" }),
      Ticket.countDocuments({ guildId: req.params.id }),
      TicketCategory.countDocuments({ guildId: req.params.id }),
    ]);

    const rpActive = cfg.rpState === "active";
    const tabs     = guildTabs(req.params.id, "overview");

    const body = `
      <div class="panel">
        <h1>${guild.name}</h1>
        <p class="muted">Server-Übersicht und Konfiguration</p>
      </div>
      ${tabs}
      <div class="grid-3">
        <div class="stat-card">
          <div class="label">Mitglieder</div>
          <div class="value">${guild.memberCount}</div>
        </div>
        <div class="stat-card">
          <div class="label">Channels</div>
          <div class="value">${guild.channels.cache.size}</div>
        </div>
        <div class="stat-card">
          <div class="label">Rollen</div>
          <div class="value">${guild.roles.cache.size}</div>
        </div>
        <div class="stat-card">
          <div class="label">Offene Tickets</div>
          <div class="value">${openTickets}</div>
        </div>
        <div class="stat-card">
          <div class="label">Tickets Gesamt</div>
          <div class="value">${totalTickets}</div>
        </div>
        <div class="stat-card">
          <div class="label">RP Status</div>
          <div class="value" style="font-size:1.2rem">
            ${rpActive
              ? '<span class="badge green">🟢 Aktiv</span>'
              : '<span class="badge red">🔴 Inaktiv</span>'}
          </div>
        </div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <h3>🎫 Ticket Kategorien</h3>
          <div class="stat-card"><div class="label">Kategorien</div><div class="value">${ticketCats}</div></div>
          <a href="/guild/${guild.id}/tickets" class="btn" style="margin-top:12px;display:inline-flex">Konfigurieren →</a>
        </div>
        <div class="panel">
          <h3>⚙️ Konfiguration</h3>
          <p class="muted" style="margin-bottom:12px">Willkommen, RP, Moderation und mehr.</p>
          <a href="/guild/${guild.id}/welcome" class="btn">Willkommen →</a>
        </div>
      </div>
    `;
    res.send(layout(guild.name, body, req.session.user));
  });

  // ── Welcome Config ──────────────────────────────────────────────────────────
  app.get("/guild/:id/welcome", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.redirect("/servers");

    const cfg    = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const notice = req.query.saved ? "✅ Einstellungen gespeichert!" : "";
    const tabs   = guildTabs(req.params.id, "welcome");

    const channelOpts = guild.channels.cache
      .filter(c => c.type === 0)
      .map(c => `<option value="${c.id}" ${cfg.welcomeChannelId === c.id ? "selected" : ""}>#${c.name}</option>`)
      .join("");

    const body = `
      <div class="panel"><h1>👋 Willkommen</h1><p class="muted">Automatische Willkommensnachrichten konfigurieren.</p></div>
      ${tabs}
      <form method="POST" action="/guild/${req.params.id}/welcome">
        <div class="panel">
          <h3>Einstellungen</h3>
          <div class="form-group">
            <label>Willkommens-Channel</label>
            <select name="welcomeChannelId"><option value="">— Nicht gesetzt —</option>${channelOpts}</select>
          </div>
          <div class="form-group">
            <label>Banner URL</label>
            <input type="text" name="welcomeBannerUrl" value="${cfg.welcomeBannerUrl || ""}" placeholder="https://...">
          </div>
        </div>
        <div class="panel">
          <h3>Channel-Erwähnungen</h3>
          <div class="grid-2">
            ${channelField("Regelwerk", "welcomeRulesChannel", cfg.welcomeRulesChannel, guild)}
            ${channelField("Rollen", "welcomeRolesChannel", cfg.welcomeRolesChannel, guild)}
            ${channelField("Ticket", "welcomeTicketChannel", cfg.welcomeTicketChannel, guild)}
            ${channelField("Fraktionen", "welcomeFraktionChannel", cfg.welcomeFraktionChannel, guild)}
          </div>
        </div>
        <div class="panel">
          <button type="submit" class="save-btn">💾 Speichern</button>
        </div>
      </form>
    `;
    res.send(layout("Willkommen", body, req.session.user, notice));
  });

  app.post("/guild/:id/welcome", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { welcomeChannelId, welcomeBannerUrl, welcomeRulesChannel, welcomeRolesChannel, welcomeTicketChannel, welcomeFraktionChannel } = req.body;

    await GuildConfig.findOneAndUpdate(
      { guildId: req.params.id },
      { $set: { welcomeChannelId: welcomeChannelId || null, welcomeBannerUrl: welcomeBannerUrl || null, welcomeRulesChannel: welcomeRulesChannel || null, welcomeRolesChannel: welcomeRolesChannel || null, welcomeTicketChannel: welcomeTicketChannel || null, welcomeFraktionChannel: welcomeFraktionChannel || null } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/welcome?saved=1`);
  });

  // ── RP Config ───────────────────────────────────────────────────────────────
  app.get("/guild/:id/rp", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const guild  = client.guilds.cache.get(req.params.id);
    if (!guild) return res.redirect("/servers");

    const cfg    = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const notice = req.query.saved ? "✅ Gespeichert!" : "";
    const tabs   = guildTabs(req.params.id, "rp");

    const channelOpts = guildChannelOptions(guild, cfg.rpChannelId);
    const roleOpts    = guildRoleOptions(guild, cfg.rpAllowedRoleId);
    const pingRoleOpts = guildRoleOptions(guild, cfg.rpPingRoleId);

    const body = `
      <div class="panel"><h1>🎮 RP Start/Stop</h1><p class="muted">Roleplay Ankündigungen konfigurieren.</p></div>
      ${tabs}
      <form method="POST" action="/guild/${req.params.id}/rp">
        <div class="panel">
          <div class="form-group"><label>Ankündigungs-Channel</label><select name="rpChannelId"><option value="">— Nicht gesetzt —</option>${channelOpts}</select></div>
          <div class="form-group"><label>Erlaubte Rolle (wer /rp nutzen darf)</label><select name="rpAllowedRoleId"><option value="">— Nicht gesetzt —</option>${roleOpts}</select></div>
          <div class="form-group"><label>Ping-Rolle (wird bei Start/Stop gepingt)</label><select name="rpPingRoleId"><option value="">— Nicht gesetzt —</option>${pingRoleOpts}</select></div>
          <button type="submit" class="save-btn">💾 Speichern</button>
        </div>
      </form>
    `;
    res.send(layout("RP", body, req.session.user, notice));
  });

  app.post("/guild/:id/rp", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { rpChannelId, rpAllowedRoleId, rpPingRoleId } = req.body;
    await GuildConfig.findOneAndUpdate(
      { guildId: req.params.id },
      { $set: { rpChannelId: rpChannelId || null, rpAllowedRoleId: rpAllowedRoleId || null, rpPingRoleId: rpPingRoleId || null } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/rp?saved=1`);
  });

  // ── Ticket Config ───────────────────────────────────────────────────────────
  app.get("/guild/:id/tickets", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.redirect("/servers");

    const cfg    = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const cats   = await TicketCategory.find({ guildId: req.params.id }).sort({ createdAt: 1 });
    const notice = req.query.saved ? "✅ Gespeichert!" : "";
    const tabs   = guildTabs(req.params.id, "tickets");

    const catRows = cats.map(c => `
      <div class="cat-row">
        <div>
          <div class="name">${c.emoji} ${c.name}</div>
          <div class="meta">${c.description} · Präfix: <code>${c.prefix}</code></div>
        </div>
        <span class="badge green">Aktiv</span>
      </div>
    `).join("") || '<p class="muted">Noch keine Kategorien. Nutze <code>/createticket</code> im Discord.</p>';

    const body = `
      <div class="panel"><h1>🎫 Tickets</h1><p class="muted">Ticket-System konfigurieren.</p></div>
      ${tabs}
      <form method="POST" action="/guild/${req.params.id}/tickets">
        <div class="panel">
          <h3>Einstellungen</h3>
          <div class="form-group"><label>Log-Channel</label><select name="ticketLogChannelId"><option value="">— Nicht gesetzt —</option>${guildChannelOptions(guild, cfg.ticketLogChannelId)}</select></div>
          <div class="form-group"><label>Max Tickets pro Nutzer</label><input type="number" name="ticketMaxPerUser" value="${cfg.ticketMaxPerUser || 1}" min="1" max="5"></div>
          <label class="toggle"><input type="checkbox" name="ticketDmTranscript" ${cfg.ticketDmTranscript !== false ? "checked" : ""}> DM Transcript bei Schließen</label>
          <button type="submit" class="save-btn">💾 Speichern</button>
        </div>
      </form>
      <div class="panel">
        <h3>Ticket-Kategorien</h3>
        <p class="muted" style="margin-bottom:12px">Kategorien werden über <code>/createticket</code> im Discord erstellt.</p>
        <div class="cat-list">${catRows}</div>
      </div>
    `;
    res.send(layout("Tickets", body, req.session.user, notice));
  });

  app.post("/guild/:id/tickets", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { ticketLogChannelId, ticketMaxPerUser, ticketDmTranscript } = req.body;
    await GuildConfig.findOneAndUpdate(
      { guildId: req.params.id },
      { $set: { ticketLogChannelId: ticketLogChannelId || null, ticketMaxPerUser: parseInt(ticketMaxPerUser) || 1, ticketDmTranscript: ticketDmTranscript === "on" } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/tickets?saved=1`);
  });

  // ── Moderation Config ───────────────────────────────────────────────────────
  app.get("/guild/:id/moderation", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.redirect("/servers");

    const cfg    = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const notice = req.query.saved ? "✅ Gespeichert!" : "";
    const tabs   = guildTabs(req.params.id, "moderation");

    const body = `
      <div class="panel"><h1>🛡️ Moderation</h1><p class="muted">Moderation-Log konfigurieren.</p></div>
      ${tabs}
      <form method="POST" action="/guild/${req.params.id}/moderation">
        <div class="panel">
          <div class="form-group"><label>Mod-Log Channel</label><select name="modLogChannelId"><option value="">— Nicht gesetzt —</option>${guildChannelOptions(guild, cfg.modLogChannelId)}</select></div>
          <button type="submit" class="save-btn">💾 Speichern</button>
        </div>
      </form>
    `;
    res.send(layout("Moderation", body, req.session.user, notice));
  });

  app.post("/guild/:id/moderation", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { modLogChannelId } = req.body;
    await GuildConfig.findOneAndUpdate(
      { guildId: req.params.id },
      { $set: { modLogChannelId: modLogChannelId || null } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/moderation?saved=1`);
  });

  // ── 404 ─────────────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).send(layout("404", '<div class="panel" style="text-align:center"><h1>404</h1><p class="muted">Seite nicht gefunden.</p><a href="/" class="btn" style="margin-top:16px">← Zurück</a></div>'));
  });

  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function guildTabs(guildId, active) {
  const tabs = [
    ["overview",   "Übersicht"],
    ["welcome",    "Willkommen"],
    ["rp",         "RP"],
    ["tickets",    "Tickets"],
    ["moderation", "Moderation"],
  ];
  return `<div class="tabs">${tabs.map(([slug, label]) =>
    `<a class="tab${slug === active ? " active" : ""}" href="/guild/${guildId}${slug === "overview" ? "" : "/" + slug}">${label}</a>`
  ).join("")}</div>`;
}

function guildChannelOptions(guild, selectedId) {
  return guild.channels.cache
    .filter(c => c.type === 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `<option value="${c.id}" ${selectedId === c.id ? "selected" : ""}>#${c.name}</option>`)
    .join("");
}

function guildRoleOptions(guild, selectedId) {
  return guild.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => `<option value="${r.id}" ${selectedId === r.id ? "selected" : ""}>@${r.name}</option>`)
    .join("");
}

function channelField(label, name, selectedId, guild) {
  return `<div class="form-group"><label>${label}</label><select name="${name}"><option value="">— Nicht gesetzt —</option>${guildChannelOptions(guild, selectedId)}</select></div>`;
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

module.exports = { createDashboard };
