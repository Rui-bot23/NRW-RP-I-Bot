require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs   = require("fs");
const path = require("path");

const commands = [];

function loadCommands(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith(".js")) {
      try {
        const mod = require(fullPath);
        if (mod.data) commands.push(mod.data.toJSON());
        for (const key of Object.keys(mod)) {
          if (key !== "data" && key !== "execute" && mod[key]?.data) {
            commands.push(mod[key].data.toJSON());
          }
        }
      } catch (err) {
        console.error(`Failed to load ${fullPath}:`, err.message);
      }
    }
  }
}

loadCommands(path.join(__dirname, "commands"));

const token    = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId  = process.env.GUILD_ID;

if (!token)    { console.error("ERROR: Kein DISCORD_TOKEN gesetzt."); process.exit(1); }
if (!clientId) { console.error("ERROR: Keine CLIENT_ID gesetzt.");    process.exit(1); }

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`Registriere ${commands.length} Slash-Commands...`);
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ ${commands.length} Commands für Guild ${guildId} registriert.`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`✅ ${commands.length} Commands global registriert.`);
    }
  } catch (err) {
    console.error("Fehler beim Registrieren:", err);
    process.exit(1);
  }
})();
