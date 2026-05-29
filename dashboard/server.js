/**
 * NRW:RP Dashboard — Express + Discord OAuth2
 * Full redesign with sidebar, dark theme, responsive layout
 */

const express = require("express");
const session = require("express-session");
const fetch   = require("node-fetch");
const { GuildConfig, Ticket, TicketCategory } = require("../models");

const DISCORD_API   = "https://discord.com/api/v10";
const ADMINISTRATOR = 0x8;
const MANAGE_GUILD  = 0x20;

function canManage(g) {
  const p = parseInt(g.permissions || "0");
  return g.owner || !!(p & ADMINISTRATOR) || !!(p & MANAGE_GUILD);
}
function guildIcon(g, id) {
  return g?.icon ? `https://cdn.discordapp.com/icons/${id || g.id}/${g.icon}.png` : "https://cdn.discordapp.com/embed/avatars/0.png";
}
function userAvatar(u) {
  return u?.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : "https://cdn.discordapp.com/embed/avatars/0.png";
}
function formatUptime(ms) {
  const s = Math.floor((ms||0) / 1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return `${h}h ${m}m`;
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
:root{
  --bg:#0a0509;--sidebar:#100609;--panel:rgba(18,8,12,0.95);--panel2:rgba(12,5,8,0.98);
  --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.13);
  --text:#fff0f2;--muted:#9e7a82;--brand:#ff4d66;--brand-dim:#8f1429;
  --green:#4ade80;--yellow:#fde047;--red:#f87171;--blue:#818cf8;
  --radius:14px;--radius-sm:8px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{color-scheme:dark;scroll-behavior:smooth}
body{min-height:100vh;color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:15px;
  background:var(--bg);display:flex;flex-direction:column}
a{color:inherit;text-decoration:none}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:3px}

/* ── Layout ── */
.app{display:flex;min-height:100vh}
.sidebar{width:240px;min-height:100vh;background:var(--sidebar);border-right:1px solid var(--border);
  display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto;flex-shrink:0}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{padding:14px 24px;border-bottom:1px solid var(--border);background:rgba(10,5,9,.8);
  backdrop-filter:blur(12px);position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:12px}

/* ── Sidebar ── */
.sidebar-header{padding:20px 16px 12px;border-bottom:1px solid var(--border)}
.logo{font-size:1.1rem;font-weight:800;letter-spacing:.05em}
.logo span{color:var(--brand)}
.sidebar-guild{padding:12px 16px;border-bottom:1px solid var(--border)}
.sidebar-guild img{width:36px;height:36px;border-radius:10px;margin-right:10px;vertical-align:middle}
.sidebar-guild strong{font-size:.9rem}
.sidebar-nav{padding:8px 8px;flex:1}
.nav-label{font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;padding:10px 8px 4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-sm);font-size:.9rem;font-weight:500;
  color:var(--muted);transition:all .15s;cursor:pointer;margin-bottom:2px}
.nav-item:hover{background:rgba(255,255,255,.05);color:var(--text)}
.nav-item.active{background:rgba(255,77,102,.12);color:var(--brand);font-weight:600}
.nav-item .icon{width:20px;text-align:center;font-size:1rem}
.sidebar-footer{padding:12px 16px;border-top:1px solid var(--border)}
.user-chip{display:flex;align-items:center;gap:10px}
.user-chip img{width:32px;height:32px;border-radius:8px}
.user-chip .info{flex:1;min-width:0}
.user-chip .name{font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-chip .tag{font-size:.75rem;color:var(--muted)}
.btn-logout{font-size:.75rem;color:var(--muted);padding:4px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:none;transition:all .15s}
.btn-logout:hover{border-color:var(--brand);color:var(--brand)}

/* ── Topbar ── */
.page-title{font-size:1.1rem;font-weight:700}
.breadcrumb{color:var(--muted);font-size:.85rem}
.breadcrumb span{color:var(--text)}

/* ── Content ── */
.content{padding:24px;display:grid;gap:20px;align-content:start}

/* ── Panels ── */
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
.panel-header{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.panel-header h2{font-size:1rem;font-weight:700}
.panel-header p{font-size:.85rem;color:var(--muted);margin-top:3px}

/* ── Hero ── */
.hero{background:linear-gradient(135deg,rgba(255,77,102,.12),rgba(143,20,41,.08));
  border:1px solid rgba(255,77,102,.2);border-radius:var(--radius);padding:28px}
.hero h1{font-size:1.9rem;font-weight:800;letter-spacing:-.03em}
.hero p{color:var(--muted);margin-top:6px;font-size:.95rem}

/* ── Stats grid ── */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.stat{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px}
.stat .label{font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.stat .value{font-size:1.6rem;font-weight:800;letter-spacing:-.04em;margin-top:4px}
.stat .value.green{color:var(--green)}
.stat .value.red{color:var(--red)}
.stat .value.yellow{color:var(--yellow)}
.stat .value.blue{color:var(--blue)}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border:1px solid var(--border);
  border-radius:999px;font-size:.87rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;background:rgba(255,255,255,.04)}
.btn:hover{border-color:var(--border2);background:rgba(255,255,255,.08);transform:translateY(-1px)}
.btn-primary{background:linear-gradient(135deg,var(--brand),var(--brand-dim));border-color:transparent;color:#fff;box-shadow:0 4px 16px rgba(143,20,41,.3)}
.btn-primary:hover{box-shadow:0 6px 20px rgba(143,20,41,.45);transform:translateY(-1px)}
.btn-sm{padding:6px 12px;font-size:.8rem}
.btn-save{width:100%;padding:12px;margin-top:4px;font-size:.95rem;border-radius:var(--radius-sm)}

/* ── Forms ── */
.form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:.82rem;font-weight:600;color:var(--muted)}
.field input,.field select,.field textarea{
  background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:var(--radius-sm);
  color:var(--text);font-size:.9rem;padding:9px 12px;outline:none;transition:border-color .15s;width:100%}
.field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(255,77,102,.4)}
.field select option{background:#1a0a0d}
.field textarea{resize:vertical;min-height:72px}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)}
.toggle-row:last-child{border-bottom:none}
.toggle-row .info strong{font-size:.9rem}
.toggle-row .info p{font-size:.8rem;color:var(--muted);margin-top:2px}
.toggle{position:relative;width:40px;height:22px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;inset:0;background:rgba(255,255,255,.12);border-radius:999px;cursor:pointer;transition:.2s}
.toggle-slider:before{content:"";position:absolute;height:16px;width:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.toggle input:checked+.toggle-slider{background:var(--brand)}
.toggle input:checked+.toggle-slider:before{transform:translateX(18px)}

/* ── Guild list ── */
.guild-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.guild-card{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--radius);
  padding:16px;display:flex;align-items:center;gap:12px;transition:all .2s}
.guild-card:hover{border-color:rgba(255,77,102,.3);background:rgba(255,77,102,.05);transform:translateY(-2px)}
.guild-card img{width:44px;height:44px;border-radius:12px;object-fit:cover}
.guild-card strong{display:block;font-size:.9rem;font-weight:700}
.guild-card span{font-size:.78rem;color:var(--muted)}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:999px;font-size:.75rem;font-weight:700}
.badge-green{background:rgba(74,222,128,.12);color:var(--green);border:1px solid rgba(74,222,128,.25)}
.badge-red{background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.25)}
.badge-yellow{background:rgba(253,224,71,.12);color:var(--yellow);border:1px solid rgba(253,224,71,.25)}
.badge-blue{background:rgba(129,140,248,.12);color:var(--blue);border:1px solid rgba(129,140,248,.25)}

/* ── Tables ── */
.table{width:100%;border-collapse:collapse}
.table th{font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;
  text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)}
.table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);font-size:.88rem}
.table tr:last-child td{border-bottom:none}
.table tr:hover td{background:rgba(255,255,255,.02)}

/* ── Notice ── */
.notice{padding:12px 16px;border-radius:var(--radius-sm);font-size:.88rem;margin-bottom:16px}
.notice-success{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.2);color:#86efac}
.notice-error{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2);color:#fca5a5}

/* ── Login page ── */
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 30% 40%,rgba(255,77,102,.15),transparent 50%),
    radial-gradient(circle at 70% 60%,rgba(143,20,41,.12),transparent 50%),var(--bg)}
.login-card{background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:40px;
  text-align:center;max-width:400px;width:calc(100% - 32px)}
.login-card h1{font-size:1.7rem;font-weight:800;margin-bottom:8px}
.login-card p{color:var(--muted);margin-bottom:24px;line-height:1.6}

/* ── Divider ── */
.divider{border:none;border-top:1px solid var(--border);margin:16px 0}

/* ── Responsive ── */
@media(max-width:768px){
  .sidebar{display:none}
  .content{padding:16px}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .hero h1{font-size:1.4rem}
}
`;

// ── Nav items ──────────────────────────────────────────────────────────────────
function sidebarNav(guildId, active) {
  const home   = `<a class="nav-item${active==="home"?" active":""}" href="/"><span class="icon">🏠</span>Home</a>`;
  if (!guildId) return home;

  const items = [
    ["overview",   "📊", "Übersicht"],
    ["welcome",    "👋", "Willkommen"],
    ["rp",         "🎮", "RP Start/Stop"],
    ["tickets",    "🎫", "Tickets"],
    ["moderation", "🛡️", "Moderation"],
    ["automod",    "🤖", "AutoMod"],
    ["logging",    "📋", "Logging"],
    ["giveaways",  "🎉", "Giveaways"],
    ["messages",   "✏️", "Nachrichten"],
    ["staff",      "👮", "Staff Rollen"],
  ];

  const links = items.map(([slug, icon, label]) => {
    const href   = slug === "overview" ? `/guild/${guildId}` : `/guild/${guildId}/${slug}`;
    const isActive = active === slug;
    return `<a class="nav-item${isActive?" active":""}" href="${href}"><span class="icon">${icon}</span>${label}</a>`;
  }).join("");

  return `
    <a class="nav-item${active==="home"?" active":""}" href="/"><span class="icon">🏠</span>Home</a>
    <a class="nav-item" href="/servers"><span class="icon">🌐</span>Server wechseln</a>
    <div class="nav-label">Server</div>
    ${links}
  `;
}

// ── Layout ────────────────────────────────────────────────────────────────────
function layout({ title, body, user = null, guildId = null, guildName = null, guildIconUrl = null, active = "home", notice = "" }) {
  const userSidebar = user ? `
    <div class="sidebar-footer">
      <div class="user-chip">
        <img src="${userAvatar(user)}" alt="">
        <div class="info">
          <div class="name">${user.username}</div>
          <div class="tag">#${user.discriminator || "0000"}</div>
        </div>
        <a href="/logout"><button class="btn-logout">Logout</button></a>
      </div>
    </div>` : "";

  const guildSidebar = guildName ? `
    <div class="sidebar-guild">
      ${guildIconUrl ? `<img src="${guildIconUrl}" alt="">` : ""}
      <strong>${guildName}</strong>
    </div>` : "";

  const noticeHtml = notice
    ? `<div class="notice ${notice.startsWith("✅") ? "notice-success" : "notice-error"}">${notice}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — NRW:RP Dashboard</title>
  <style>${CSS}</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">NRW:RP <span>Panel</span></div>
    </div>
    ${guildSidebar}
    <nav class="sidebar-nav">
      ${sidebarNav(guildId, active)}
    </nav>
    ${userSidebar}
  </aside>
  <div class="main">
    <div class="topbar">
      <div>
        <div class="page-title">${title}</div>
        ${guildName ? `<div class="breadcrumb"><span>${guildName}</span></div>` : ""}
      </div>
      ${!user ? `<a href="/login" class="btn btn-primary">Mit Discord anmelden</a>` : ""}
    </div>
    <div class="content">
      ${noticeHtml}
      ${body}
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Select helpers ────────────────────────────────────────────────────────────
function chOpts(guild, selId) {
  return guild.channels.cache.filter(c=>c.type===0).sort((a,b)=>a.name.localeCompare(b.name))
    .map(c=>`<option value="${c.id}"${selId===c.id?" selected":""}>#${c.name}</option>`).join("");
}
function roleOpts(guild, selId) {
  return guild.roles.cache.filter(r=>r.id!==guild.id).sort((a,b)=>b.position-a.position)
    .map(r=>`<option value="${r.id}"${selId===r.id?" selected":""}>${r.name}</option>`).join("");
}
function field(label, name, selId, guild, type = "channel") {
  const opts = type === "channel" ? chOpts(guild, selId) : roleOpts(guild, selId);
  return `<div class="field"><label>${label}</label><select name="${name}"><option value="">— Nicht gesetzt —</option>${opts}</select></div>`;
}

// ── App factory ───────────────────────────────────────────────────────────────
function createDashboard(client, config) {
  const app = express();
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DASHBOARD_BASE_URL, DASHBOARD_SECRET } = config;
  const CALLBACK = `${DASHBOARD_BASE_URL}/auth/callback`;

  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(express.json());
  app.use(session({ secret: DASHBOARD_SECRET || "nrwrp", resave: false, saveUninitialized: false, cookie: { maxAge: 7*24*60*60*1000 } }));

  // ── Auth ──────────────────────────────────────────────────────────────────
  app.get("/login", (req, res) => {
    const state = Math.random().toString(36).slice(2);
    req.session.state = state;
    const p = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: CALLBACK, response_type: "code", scope: "identify guilds", state });
    res.redirect(`https://discord.com/api/oauth2/authorize?${p}`);
  });

  app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code || state !== req.session.state) return res.redirect("/?error=1");
    try {
      const tok = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: CALLBACK }),
      }).then(r => r.json());
      if (!tok.access_token) return res.redirect("/?error=2");

      const [user, guilds] = await Promise.all([
        fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then(r => r.json()),
        fetch(`${DISCORD_API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then(r => r.json()),
      ]);
      req.session.user = user;
      req.session.guilds = guilds;
      req.session.state = null;
      res.redirect("/servers");
    } catch { res.redirect("/?error=3"); }
  });

  app.get("/logout", (req, res) => { req.session.destroy(); res.redirect("/"); });

  // ── Home ──────────────────────────────────────────────────────────────────
  app.get("/", (req, res) => {
    const u = req.session.user;
    res.send(layout({
      title: "Home", active: "home", user: u,
      body: `
        <div class="hero">
          <h1>NRW:RP <span style="color:var(--brand)">Dashboard</span></h1>
          <p>Verwalte deinen Server — Tickets, Willkommen, RP, Moderation, AutoMod, Logging und mehr.</p>
          <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
            ${u ? `<a href="/servers" class="btn btn-primary">Meine Server →</a>` : `<a href="/login" class="btn btn-primary">Mit Discord anmelden →</a>`}
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat"><div class="label">Server</div><div class="value blue">${client.guilds.cache.size}</div></div>
          <div class="stat"><div class="label">Uptime</div><div class="value green">${formatUptime(client.uptime)}</div></div>
          <div class="stat"><div class="label">Ping</div><div class="value yellow">${client.ws.ping}ms</div></div>
          <div class="stat"><div class="label">Commands</div><div class="value">${client.commands?.size || 0}</div></div>
        </div>
      `,
    }));
  });

  // ── Server list ───────────────────────────────────────────────────────────
  app.get("/servers", (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const manageable = (req.session.guilds || []).filter(canManage).filter(g => client.guilds.cache.has(g.id));

    const cards = manageable.map(g => {
      const bg = client.guilds.cache.get(g.id);
      return `<a class="guild-card" href="/guild/${g.id}">
        <img src="${guildIcon(g)}" alt="">
        <div><strong>${g.name}</strong><span>${bg?.memberCount||"?"} Mitglieder</span></div>
      </a>`;
    }).join("") || `<p style="color:var(--muted)">Keine passenden Server gefunden. Lade den Bot auf deinen Server ein.</p>`;

    res.send(layout({ title: "Server", active: "home", user: req.session.user, body: `
      <div class="hero" style="padding:20px 24px">
        <h1>Deine Server</h1>
        <p>Wähle einen Server den du verwalten möchtest.</p>
      </div>
      <div class="guild-grid">${cards}</div>
    ` }));
  });

  // ── Guild helper ──────────────────────────────────────────────────────────
  function requireGuild(req, res) {
    if (!req.session.user) { res.redirect("/login"); return null; }
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) { res.redirect("/servers"); return null; }
    return guild;
  }

  // ── Overview ──────────────────────────────────────────────────────────────
  app.get("/guild/:id", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const [openT, totalT, cats] = await Promise.all([
      Ticket.countDocuments({ guildId: req.params.id, status: "open" }),
      Ticket.countDocuments({ guildId: req.params.id }),
      TicketCategory.countDocuments({ guildId: req.params.id }),
    ]);
    const rpActive = cfg.rpState === "active";

    res.send(layout({ title: "Übersicht", active: "overview", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(),
      body: `
        <div class="hero" style="padding:20px 24px">
          <h1>${guild.name}</h1>
          <p>Server-Übersicht • alles auf einen Blick</p>
        </div>
        <div class="stats-grid">
          <div class="stat"><div class="label">Mitglieder</div><div class="value">${guild.memberCount}</div></div>
          <div class="stat"><div class="label">Channels</div><div class="value">${guild.channels.cache.size}</div></div>
          <div class="stat"><div class="label">Rollen</div><div class="value">${guild.roles.cache.size}</div></div>
          <div class="stat"><div class="label">Offene Tickets</div><div class="value yellow">${openT}</div></div>
          <div class="stat"><div class="label">Tickets Gesamt</div><div class="value">${totalT}</div></div>
          <div class="stat"><div class="label">Ticket Kategorien</div><div class="value blue">${cats}</div></div>
          <div class="stat"><div class="label">RP Status</div><div class="value ${rpActive?"green":"red"}">${rpActive?"🟢 Aktiv":"🔴 Inaktiv"}</div></div>
          <div class="stat"><div class="label">AutoMod</div><div class="value ${cfg.automod?.antilinkEnabled||cfg.automod?.antispamEnabled?"green":"red"}">${cfg.automod?.antilinkEnabled||cfg.automod?.antispamEnabled?"Aktiv":"Inaktiv"}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="panel">
            <div class="panel-header"><h2>🚀 Schnellstart</h2><p>Wichtige Konfigurationen</p></div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <a href="/guild/${req.params.id}/welcome"    class="btn">👋 Willkommen einrichten</a>
              <a href="/guild/${req.params.id}/tickets"    class="btn">🎫 Ticket-System</a>
              <a href="/guild/${req.params.id}/rp"         class="btn">🎮 RP konfigurieren</a>
              <a href="/guild/${req.params.id}/moderation" class="btn">🛡️ Moderation</a>
              <a href="/guild/${req.params.id}/automod"    class="btn">🤖 AutoMod</a>
              <a href="/guild/${req.params.id}/logging"    class="btn">📋 Logging</a>
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>📋 Bot Info</h2></div>
            <table class="table">
              <tr><td>Uptime</td><td>${formatUptime(client.uptime)}</td></tr>
              <tr><td>Ping</td><td>${client.ws.ping}ms</td></tr>
              <tr><td>Bot Tag</td><td>${client.user?.tag || "—"}</td></tr>
              <tr><td>Server gesamt</td><td>${client.guilds.cache.size}</td></tr>
            </table>
          </div>
        </div>
      `,
    }));
  });

  // ── Welcome ───────────────────────────────────────────────────────────────
  app.get("/guild/:id/welcome", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const n     = req.query.saved ? "✅ Gespeichert!" : "";

    res.send(layout({ title: "Willkommen", active: "welcome", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <form method="POST" action="/guild/${req.params.id}/welcome">
          <div class="panel">
            <div class="panel-header"><h2>👋 Willkommen Channel</h2><p>Wo sollen Willkommensnachrichten gepostet werden?</p></div>
            <div class="form-grid">
              ${field("Willkommens-Channel", "welcomeChannelId", cfg.welcomeChannelId, guild)}
              <div class="field"><label>Banner URL</label><input type="text" name="welcomeBannerUrl" value="${cfg.welcomeBannerUrl||""}" placeholder="https://..."></div>
            </div>
          </div>
          <div class="panel" style="margin-top:16px">
            <div class="panel-header"><h2>🔗 Channel-Erwähnungen</h2><p>Diese Channels werden in der Willkommensnachricht erwähnt.</p></div>
            <div class="form-grid">
              ${field("📖 Regelwerk", "welcomeRulesChannel", cfg.welcomeRulesChannel, guild)}
              ${field("🏷️ Rollen", "welcomeRolesChannel", cfg.welcomeRolesChannel, guild)}
              ${field("🎫 Ticket", "welcomeTicketChannel", cfg.welcomeTicketChannel, guild)}
              ${field("⚔️ Fraktionen", "welcomeFraktionChannel", cfg.welcomeFraktionChannel, guild)}
            </div>
          </div>
          <div style="margin-top:16px"><button type="submit" class="btn btn-primary btn-save">💾 Speichern</button></div>
        </form>
      `,
    }));
  });

  app.post("/guild/:id/welcome", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { welcomeChannelId, welcomeBannerUrl, welcomeRulesChannel, welcomeRolesChannel, welcomeTicketChannel, welcomeFraktionChannel } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id },
      { $set: { welcomeChannelId: welcomeChannelId||null, welcomeBannerUrl: welcomeBannerUrl||null, welcomeRulesChannel: welcomeRulesChannel||null, welcomeRolesChannel: welcomeRolesChannel||null, welcomeTicketChannel: welcomeTicketChannel||null, welcomeFraktionChannel: welcomeFraktionChannel||null } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/welcome?saved=1`);
  });

  // ── RP ────────────────────────────────────────────────────────────────────
  app.get("/guild/:id/rp", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const n     = req.query.saved ? "✅ Gespeichert!" : "";

    res.send(layout({ title: "RP Start/Stop", active: "rp", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <form method="POST" action="/guild/${req.params.id}/rp">
          <div class="panel">
            <div class="panel-header"><h2>🎮 RP Konfiguration</h2><p>Wer darf RP starten/stoppen und wo wird es gepostet?</p></div>
            <div class="form-grid">
              ${field("📣 Ankündigungs-Channel", "rpChannelId", cfg.rpChannelId, guild)}
              ${field("🔑 Erlaubte Rolle (/rp nutzen)", "rpAllowedRoleId", cfg.rpAllowedRoleId, guild, "role")}
              ${field("🔔 Ping-Rolle (bei Start/Stop)", "rpPingRoleId", cfg.rpPingRoleId, guild, "role")}
            </div>
          </div>
          <div style="margin-top:16px"><button type="submit" class="btn btn-primary btn-save">💾 Speichern</button></div>
        </form>
      `,
    }));
  });

  app.post("/guild/:id/rp", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { rpChannelId, rpAllowedRoleId, rpPingRoleId } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id }, { $set: { rpChannelId: rpChannelId||null, rpAllowedRoleId: rpAllowedRoleId||null, rpPingRoleId: rpPingRoleId||null } }, { upsert: true });
    res.redirect(`/guild/${req.params.id}/rp?saved=1`);
  });

  // ── Tickets ───────────────────────────────────────────────────────────────
  app.get("/guild/:id/tickets", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const cats  = await TicketCategory.find({ guildId: req.params.id }).sort({ createdAt: 1 });
    const n     = req.query.saved ? "✅ Gespeichert!" : "";

    const catRows = cats.map(c => `
      <tr>
        <td>${c.emoji} <strong>${c.name}</strong></td>
        <td><code>${c.prefix}</code></td>
        <td>${c.teamPingId ? `<@&${c.teamPingId}>` : "—"}</td>
        <td><span class="badge badge-green">Aktiv</span></td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:20px">Noch keine Kategorien — nutze /createticket im Discord</td></tr>`;

    res.send(layout({ title: "Tickets", active: "tickets", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <form method="POST" action="/guild/${req.params.id}/tickets">
          <div class="panel">
            <div class="panel-header"><h2>🎫 Ticket Einstellungen</h2></div>
            <div class="form-grid">
              ${field("📋 Log-Channel (Transcripts)", "ticketLogChannelId", cfg.ticketLogChannelId, guild)}
              <div class="field"><label>Max Tickets pro Nutzer</label><input type="number" name="ticketMaxPerUser" value="${cfg.ticketMaxPerUser||1}" min="1" max="5"></div>
              <div class="field"><label>Close-Delay (Sekunden)</label><input type="number" name="ticketCloseDelay" value="${cfg.ticketCloseDelay||5}" min="0" max="60"></div>
            </div>
            <hr class="divider">
            <div class="toggle-row">
              <div class="info"><strong>DM Transcript</strong><p>Sendet dem Nutzer beim Schließen eine Kopie der Unterhaltung</p></div>
              <label class="toggle"><input type="checkbox" name="ticketDmTranscript" ${cfg.ticketDmTranscript!==false?"checked":""}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div style="margin-top:16px"><button type="submit" class="btn btn-primary btn-save">💾 Speichern</button></div>
        </form>
        <div class="panel" style="margin-top:16px">
          <div class="panel-header"><h2>📂 Ticket Kategorien (${cats.length})</h2><p>Erstelle neue Kategorien mit /createticket im Discord</p></div>
          <table class="table"><thead><tr><th>Name</th><th>Präfix</th><th>Team Ping</th><th>Status</th></tr></thead><tbody>${catRows}</tbody></table>
        </div>
      `,
    }));
  });

  app.post("/guild/:id/tickets", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { ticketLogChannelId, ticketMaxPerUser, ticketCloseDelay, ticketDmTranscript } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id },
      { $set: { ticketLogChannelId: ticketLogChannelId||null, ticketMaxPerUser: parseInt(ticketMaxPerUser)||1, ticketCloseDelay: parseInt(ticketCloseDelay)||5, ticketDmTranscript: ticketDmTranscript==="on" } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/tickets?saved=1`);
  });

  // ── Moderation ────────────────────────────────────────────────────────────
  app.get("/guild/:id/moderation", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const n     = req.query.saved ? "✅ Gespeichert!" : "";

    res.send(layout({ title: "Moderation", active: "moderation", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <form method="POST" action="/guild/${req.params.id}/moderation">
          <div class="panel">
            <div class="panel-header"><h2>🛡️ Mod-Log</h2><p>Alle Moderations-Aktionen werden in diesen Channel geloggt.</p></div>
            <div class="form-grid">
              ${field("📋 Mod-Log Channel", "modLogChannelId", cfg.modLogChannelId, guild)}
            </div>
          </div>
          <div style="margin-top:16px"><button type="submit" class="btn btn-primary btn-save">💾 Speichern</button></div>
        </form>
        <div class="panel" style="margin-top:16px">
          <div class="panel-header"><h2>⚡ Verfügbare Commands</h2></div>
          <table class="table">
            <thead><tr><th>Command</th><th>Beschreibung</th><th>Berechtigung</th></tr></thead>
            <tbody>
              <tr><td>/ban</td><td>Nutzer bannen</td><td>Ban Members</td></tr>
              <tr><td>/kick</td><td>Nutzer kicken</td><td>Kick Members</td></tr>
              <tr><td>/timeout</td><td>Nutzer timeout geben</td><td>Moderate Members</td></tr>
              <tr><td>/warn</td><td>Nutzer verwarnen</td><td>Moderate Members</td></tr>
              <tr><td>/warnings</td><td>Verwarnungen anzeigen</td><td>Moderate Members</td></tr>
              <tr><td>/purge</td><td>Nachrichten löschen</td><td>Manage Messages</td></tr>
              <tr><td>/lock / /unlock</td><td>Channel sperren</td><td>Manage Channels</td></tr>
              <tr><td>/slowmode</td><td>Slowmode setzen</td><td>Manage Channels</td></tr>
            </tbody>
          </table>
        </div>
      `,
    }));
  });

  app.post("/guild/:id/moderation", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { modLogChannelId } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id }, { $set: { modLogChannelId: modLogChannelId||null } }, { upsert: true });
    res.redirect(`/guild/${req.params.id}/moderation?saved=1`);
  });

  // ── AutoMod ───────────────────────────────────────────────────────────────
  app.get("/guild/:id/automod", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const am    = cfg.automod || {};
    const n     = req.query.saved ? "✅ Gespeichert!" : "";

    res.send(layout({ title: "AutoMod", active: "automod", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <form method="POST" action="/guild/${req.params.id}/automod">
          <div class="panel">
            <div class="panel-header"><h2>🤖 AutoMod Module</h2></div>
            <div class="toggle-row">
              <div class="info"><strong>🔗 Anti-Link</strong><p>Löscht automatisch Links im Chat</p></div>
              <label class="toggle"><input type="checkbox" name="antilinkEnabled" ${am.antilinkEnabled?"checked":""}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <div class="info"><strong>🌊 Anti-Spam</strong><p>Erkennt und stoppt Spam-Nachrichten</p></div>
              <label class="toggle"><input type="checkbox" name="antispamEnabled" ${am.antispamEnabled?"checked":""}><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <div class="info"><strong>🤬 Anti-Badwords</strong><p>Löscht Nachrichten mit Blacklist-Wörtern</p></div>
              <label class="toggle"><input type="checkbox" name="antibadwordsEnabled" ${am.antibadwordsEnabled?"checked":""}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="panel" style="margin-top:16px">
            <div class="panel-header"><h2>⚙️ Einstellungen</h2></div>
            <div class="form-grid">
              <div class="field"><label>Anti-Link Aktion</label>
                <select name="antilinkAction">
                  <option value="delete"  ${am.antilinkAction==="delete"?"selected":""}>Nur löschen</option>
                  <option value="warn"    ${am.antilinkAction==="warn"?"selected":""}>Löschen + Warnen</option>
                  <option value="kick"    ${am.antilinkAction==="kick"?"selected":""}>Löschen + Kick</option>
                  <option value="ban"     ${am.antilinkAction==="ban"?"selected":""}>Löschen + Ban</option>
                </select>
              </div>
              <div class="field"><label>Anti-Spam Limit (Nachrichten/5s)</label>
                <input type="number" name="antispamLimit" value="${am.antispamLimit||5}" min="2" max="20">
              </div>
              <div class="field" style="grid-column:span 2">
                <label>Blacklist Wörter (komma-getrennt)</label>
                <textarea name="blacklist">${(am.blacklist||[]).join(", ")}</textarea>
              </div>
            </div>
          </div>
          <div style="margin-top:16px"><button type="submit" class="btn btn-primary btn-save">💾 Speichern</button></div>
        </form>
      `,
    }));
  });

  app.post("/guild/:id/automod", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { antilinkEnabled, antispamEnabled, antibadwordsEnabled, antilinkAction, antispamLimit, blacklist } = req.body;
    const words = (blacklist||"").split(",").map(w=>w.trim().toLowerCase()).filter(Boolean);
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id },
      { $set: { "automod.antilinkEnabled": antilinkEnabled==="on", "automod.antispamEnabled": antispamEnabled==="on", "automod.antibadwordsEnabled": antibadwordsEnabled==="on", "automod.antilinkAction": antilinkAction||"delete", "automod.antispamLimit": parseInt(antispamLimit)||5, "automod.blacklist": words } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/automod?saved=1`);
  });

  // ── Logging ───────────────────────────────────────────────────────────────
  app.get("/guild/:id/logging", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const log   = cfg.logging || {};
    const n     = req.query.saved ? "✅ Gespeichert!" : "";

    const events = [
      ["messageDelete",  "🗑️ Nachricht gelöscht"],
      ["messageEdit",    "✏️ Nachricht bearbeitet"],
      ["memberJoin",     "📥 Mitglied beigetreten"],
      ["memberLeave",    "📤 Mitglied verlassen"],
      ["memberBan",      "🔨 Mitglied gebannt"],
      ["memberUpdate",   "👤 Mitglied bearbeitet"],
      ["roleCreate",     "🎭 Rolle erstellt"],
      ["roleDelete",     "🎭 Rolle gelöscht"],
      ["channelCreate",  "💬 Channel erstellt"],
      ["channelDelete",  "💬 Channel gelöscht"],
      ["voiceUpdate",    "🎤 Voice Update"],
    ];

    const rows = events.map(([key, label]) => `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:.9rem">${label}</span>
        ${field("", key, log[key], guild)}
      </div>
    `).join("");

    res.send(layout({ title: "Logging", active: "logging", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <form method="POST" action="/guild/${req.params.id}/logging">
          <div class="panel">
            <div class="panel-header"><h2>📋 Server-Logging</h2><p>Wähle für jedes Event einen Log-Channel.</p></div>
            <div class="toggle-row">
              <div class="info"><strong>Logging aktiviert</strong><p>Alle konfigurierten Events werden geloggt</p></div>
              <label class="toggle"><input type="checkbox" name="enabled" ${log.enabled?"checked":""}><span class="toggle-slider"></span></label>
            </div>
            <hr class="divider">
            ${rows}
          </div>
          <div style="margin-top:16px"><button type="submit" class="btn btn-primary btn-save">💾 Speichern</button></div>
        </form>
      `,
    }));
  });

  app.post("/guild/:id/logging", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const body = req.body;
    const updates = { "logging.enabled": body.enabled === "on" };
    const events = ["messageDelete","messageEdit","memberJoin","memberLeave","memberBan","memberUpdate","roleCreate","roleDelete","channelCreate","channelDelete","voiceUpdate"];
    for (const e of events) updates[`logging.${e}`] = body[e] || null;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id }, { $set: updates }, { upsert: true });
    res.redirect(`/guild/${req.params.id}/logging?saved=1`);
  });

  // ── Giveaways ─────────────────────────────────────────────────────────────
  app.get("/guild/:id/giveaways", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    res.send(layout({ title: "Giveaways", active: "giveaways", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(),
      body: `
        <div class="panel">
          <div class="panel-header"><h2>🎉 Giveaway System</h2><p>Giveaways werden über Discord-Commands verwaltet.</p></div>
          <table class="table">
            <thead><tr><th>Command</th><th>Beschreibung</th></tr></thead>
            <tbody>
              <tr><td>/giveaway start</td><td>Neues Giveaway starten (Preis, Dauer, Gewinner)</td></tr>
              <tr><td>/giveaway end</td><td>Giveaway sofort beenden</td></tr>
              <tr><td>/giveaway reroll</td><td>Neuen Gewinner auswählen</td></tr>
              <tr><td>/giveaway list</td><td>Aktive Giveaways anzeigen</td></tr>
            </tbody>
          </table>
        </div>
      `,
    }));
  });

  // ── Messages ──────────────────────────────────────────────────────────────
  app.get("/guild/:id/messages", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const n     = req.query.saved ? "✅ Gespeichert!" : "";

    const tip = `<p style="font-size:.8rem;color:var(--muted);margin-top:6px">
      Verfügbare Platzhalter: <code>{nick}</code> (Nutzername) · <code>{rules}</code> · <code>{roles}</code> · <code>{ticket}</code> · <code>{fraktionen}</code>
    </p>`;

    res.send(layout({ title: "Nachrichten", active: "messages", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <form method="POST" action="/guild/${req.params.id}/messages">
          <div class="panel">
            <div class="panel-header"><h2>👋 Willkommensnachricht</h2><p>Passe den Text der Willkommensnachricht an.</p></div>
            ${tip}
            <div style="display:grid;gap:14px;margin-top:14px">
              <div class="field"><label>Titel</label><input type="text" name="welcomeTitle" value="${cfg.welcomeTitle||"Willkommen hier auf NRW:RP I German"}" placeholder="Willkommen hier auf NRW:RP I German"></div>
              <div class="field"><label>Intro-Zeile</label><input type="text" name="welcomeIntro" value="${cfg.welcomeIntro||"Schön, dass du da bist **{nick}**! Bitte lies dir diese Infos aufmerksam durch:"}" placeholder="Schön, dass du da bist **{nick}**..."></div>
              <div class="field"><label>Zeile 1 (Regelwerk)</label><input type="text" name="welcomeLine1" value="${cfg.welcomeLine1||"Lies dir unser {rules} durch."}"></div>
              <div class="field"><label>Zeile 2 (Rollen)</label><input type="text" name="welcomeLine2" value="${cfg.welcomeLine2||"Hole dir eine Rolle in {roles} für Pings."}"></div>
              <div class="field"><label>Zeile 3 (Ticket)</label><input type="text" name="welcomeLine3" value="${cfg.welcomeLine3||"Bei Fragen öffne ein Ticket in {ticket}."}"></div>
              <div class="field"><label>Zeile 4 (Fraktionen)</label><input type="text" name="welcomeLine4" value="${cfg.welcomeLine4||"Fraktionen findest du in {fraktionen}."}"></div>
              <div class="field"><label>Zeile 5 (Extra)</label><input type="text" name="welcomeLine5" value="${cfg.welcomeLine5||"Bei Interesse kannst du dich auch im Staff Team bewerben!"}"></div>
              <div class="field"><label>Footer</label><textarea name="welcomeFooter">${(cfg.welcomeFooter||"Bitte halte dich an unsere Regeln und viel Spaß im RP!\n-# NRW:RP I German").replace(/\\n/g,"\n")}</textarea></div>
            </div>
          </div>
          <div class="panel" style="margin-top:16px">
            <div class="panel-header"><h2>🎮 RP Start Nachricht</h2></div>
            <div style="display:grid;gap:14px">
              <div class="field"><label>Titel</label><input type="text" name="rpStartTitle" value="${cfg.rpStartTitle||"Roleplay Start"}"></div>
              <div class="field"><label>Text</label><textarea name="rpStartText" style="min-height:100px">${(cfg.rpStartText||"Der Server ist ab jetzt moderiert und das Roleplay ist eroeffnet.\n\nDanke, dass du ein Teil der Community bist!\nViel Spass beim Spielen!").replace(/\\n/g,"\n")}</textarea></div>
            </div>
          </div>
          <div class="panel" style="margin-top:16px">
            <div class="panel-header"><h2>🔴 RP Stop Nachricht</h2></div>
            <div style="display:grid;gap:14px">
              <div class="field"><label>Titel</label><input type="text" name="rpStopTitle" value="${cfg.rpStopTitle||"Roleplay Stop"}"></div>
              <div class="field"><label>Text</label><textarea name="rpStopText" style="min-height:100px">${(cfg.rpStopText||"Der Server ist nicht mehr moderiert und das Roleplay ist beendet.\n\nDanke, dass du dabei warst!\nBis zum naechsten Mal!").replace(/\\n/g,"\n")}</textarea></div>
            </div>
          </div>
          <div style="margin-top:16px"><button type="submit" class="btn btn-primary btn-save">💾 Speichern</button></div>
        </form>
      `,
    }));
  });

  app.post("/guild/:id/messages", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { welcomeTitle, welcomeIntro, welcomeLine1, welcomeLine2, welcomeLine3, welcomeLine4, welcomeLine5, welcomeFooter, rpStartTitle, rpStartText, rpStopTitle, rpStopText } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id },
      { $set: { welcomeTitle, welcomeIntro, welcomeLine1, welcomeLine2, welcomeLine3, welcomeLine4, welcomeLine5, welcomeFooter, rpStartTitle, rpStartText, rpStopTitle, rpStopText } },
      { upsert: true }
    );
    res.redirect(`/guild/${req.params.id}/messages?saved=1`);
  });

  // ── Staff Roles ───────────────────────────────────────────────────────────
  app.get("/guild/:id/staff", async (req, res) => {
    const guild = requireGuild(req, res); if (!guild) return;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const n     = req.query.saved ? "✅ Gespeichert!" : req.query.removed ? "✅ Rolle entfernt!" : "";

    const supportRoles = cfg.ticketSupportRoleIds || [];
    const reviewAdmins = cfg.reviewAdminRoleIds   || [];

    const supportRows = supportRoles.map(id => {
      const role = guild.roles.cache.get(id);
      return `<tr>
        <td>${role ? `<span style="color:#${role.hexColor||'fff'}">${role.name}</span>` : `<span style="color:var(--muted)">Unbekannte Rolle (${id})</span>`}</td>
        <td>${role?.members.size || "?"} Mitglieder</td>
        <td><a href="/guild/${req.params.id}/staff/remove/support/${id}" class="btn btn-sm" style="color:var(--red);border-color:rgba(248,113,113,.3)">Entfernen</a></td>
      </tr>`;
    }).join("") || `<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:16px">Keine Support-Rollen konfiguriert</td></tr>`;

    const reviewRows = reviewAdmins.map(id => {
      const role = guild.roles.cache.get(id);
      return `<tr>
        <td>${role ? role.name : `Unbekannte Rolle (${id})`}</td>
        <td><a href="/guild/${req.params.id}/staff/remove/review/${id}" class="btn btn-sm" style="color:var(--red);border-color:rgba(248,113,113,.3)">Entfernen</a></td>
      </tr>`;
    }).join("") || `<tr><td colspan="2" style="color:var(--muted);text-align:center;padding:16px">Keine Review-Admin-Rollen konfiguriert</td></tr>`;

    res.send(layout({ title: "Staff Rollen", active: "staff", user: req.session.user, guildId: req.params.id, guildName: guild.name, guildIconUrl: guild.iconURL(), notice: n,
      body: `
        <div class="panel">
          <div class="panel-header"><h2>👮 Support-Rollen</h2><p>Diese Rollen können Tickets sehen, beanspruchen und schließen.</p></div>
          <form method="POST" action="/guild/${req.params.id}/staff/support" style="display:flex;gap:10px;margin-bottom:16px">
            <select name="roleId" style="flex:1;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
              <option value="">— Rolle auswählen —</option>
              ${guild.roles.cache.filter(r=>r.id!==guild.id&&!supportRoles.includes(r.id)).sort((a,b)=>b.position-a.position).map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}
            </select>
            <button type="submit" class="btn btn-primary">➕ Hinzufügen</button>
          </form>
          <table class="table"><thead><tr><th>Rolle</th><th>Mitglieder</th><th></th></tr></thead><tbody>${supportRows}</tbody></table>
        </div>

        <div class="panel" style="margin-top:16px">
          <div class="panel-header"><h2>⭐ Review-Admin-Rollen</h2><p>Diese Rollen können Reviews löschen und die Blacklist verwalten.</p></div>
          <form method="POST" action="/guild/${req.params.id}/staff/review" style="display:flex;gap:10px;margin-bottom:16px">
            <select name="roleId" style="flex:1;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
              <option value="">— Rolle auswählen —</option>
              ${guild.roles.cache.filter(r=>r.id!==guild.id&&!reviewAdmins.includes(r.id)).sort((a,b)=>b.position-a.position).map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}
            </select>
            <button type="submit" class="btn btn-primary">➕ Hinzufügen</button>
          </form>
          <table class="table"><thead><tr><th>Rolle</th><th></th></tr></thead><tbody>${reviewRows}</tbody></table>
        </div>

        <div class="panel" style="margin-top:16px">
          <div class="panel-header"><h2>ℹ️ Hinweis</h2></div>
          <p style="font-size:.88rem;color:var(--muted)">
            Support-Rollen können auch über Discord mit <code>/setup tickets addrole</code> hinzugefügt werden.<br>
            Review-Admin-Rollen über <code>/setup reviews adminrole action:Add</code>.
          </p>
        </div>
      `,
    }));
  });

  app.post("/guild/:id/staff/support", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { roleId } = req.body;
    if (!roleId) return res.redirect(`/guild/${req.params.id}/staff`);
    const cfg = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const roles = [...(cfg.ticketSupportRoleIds||[])];
    if (!roles.includes(roleId)) roles.push(roleId);
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id }, { $set: { ticketSupportRoleIds: roles } }, { upsert: true });
    res.redirect(`/guild/${req.params.id}/staff?saved=1`);
  });

  app.post("/guild/:id/staff/review", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { roleId } = req.body;
    if (!roleId) return res.redirect(`/guild/${req.params.id}/staff`);
    const cfg = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const roles = [...(cfg.reviewAdminRoleIds||[])];
    if (!roles.includes(roleId)) roles.push(roleId);
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id }, { $set: { reviewAdminRoleIds: roles } }, { upsert: true });
    res.redirect(`/guild/${req.params.id}/staff?saved=1`);
  });

  app.get("/guild/:id/staff/remove/:type/:roleId", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    const { type, roleId } = req.params;
    const cfg   = await GuildConfig.findOne({ guildId: req.params.id }) || {};
    const field = type === "support" ? "ticketSupportRoleIds" : "reviewAdminRoleIds";
    const roles = (cfg[field]||[]).filter(id => id !== roleId);
    await GuildConfig.findOneAndUpdate({ guildId: req.params.id }, { $set: { [field]: roles } }, { upsert: true });
    res.redirect(`/guild/${req.params.id}/staff?removed=1`);
  });

  // ── 404 ───────────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).send(layout({ title: "404", body: `<div class="hero" style="text-align:center"><h1>404</h1><p>Seite nicht gefunden.</p><a href="/" class="btn" style="margin-top:16px">← Zurück</a></div>` }));
  });

  return app;
}

module.exports = { createDashboard };
