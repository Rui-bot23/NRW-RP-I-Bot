const chalk = require("chalk");
const { ActivityType } = require("discord.js");
const once = true;

async function execute(client) {
  client.user.setPresence({
    status: "online",
    activities: [{ name: "NRW:RP I German", type: ActivityType.Watching }],
  });

  console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║       NRW:RP BOT — BEREIT            ║
╠══════════════════════════════════════╣
║  Bot:     ${(client.user.tag + " ").padEnd(29)}║
║  Server:  ${String(client.guilds.cache.size).padEnd(29)}║
╚══════════════════════════════════════╝
  `));
}

module.exports = { once, execute };
