const chalk = require("chalk");
const { ActivityType } = require("discord.js");

const once = true;
const name = "clientReady";

async function execute(client) {
  console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║       NRW:RP BOT — BEREIT            ║
╠══════════════════════════════════════╣
║  Bot:     ${(client.user.tag + " ").padEnd(29)}║
║  Server:  ${String(client.guilds.cache.size).padEnd(29)}║
╚══════════════════════════════════════╝
  `));

  // ── Rotating Rich Presence ──────────────────────────────────────────────────
  function getActivities() {
    // Gather live stats from the bot
    const memberCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const guildCount  = client.guilds.cache.size;

    // Get the primary guild's name (first guild or fallback)
    const primaryGuild = client.guilds.cache.first();
    const serverName   = primaryGuild?.name || "NRW:RP I German";

    return [
      {
        name: `${memberCount} Members from ${serverName}`,
        type: ActivityType.Custom,
        state: `🛡️ Guarding ${memberCount} Members from ${serverName}`,
      },
      {
        name: "NRW:RP I German",
        type: ActivityType.Watching,
      },
      {
        name: `${guildCount} Server${guildCount !== 1 ? "n" : ""}`,
        type: ActivityType.Watching,
      },
      {
        name: "NRW:RP I German",
        type: ActivityType.Custom,
        state: "🎮 Roleplay läuft — Viel Spaß!",
      },
      {
        name: "Fraktionen auf NRW:RP",
        type: ActivityType.Watching,
      },
      {
        name: "NRW:RP I German",
        type: ActivityType.Custom,
        state: `🎫 Bereit für Tickets`,
      },
      {
        name: "das RP auf NRW:RP",
        type: ActivityType.Watching,
      },
      {
        name: "NRW:RP I German",
        type: ActivityType.Custom,
        state: `⚔️ ${memberCount} Mitglieder geschützt`,
      },
    ];
  }

  let index = 0;

  function rotate() {
    const activities = getActivities();
    const activity   = activities[index % activities.length];

    client.user.setPresence({
      status: "online",
      activities: [activity],
    });

    index = (index + 1) % activities.length;
  }

  // Set immediately, then rotate every 30 seconds
  rotate();
  setInterval(rotate, 30_000);
}

module.exports = { once, name, execute };
