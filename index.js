require("dotenv").config();
const { Client, GatewayIntentBits, Collection, Partials } = require("discord.js");
const fs      = require("fs");
const path    = require("path");
const mongoose = require("mongoose");
const chalk   = require("chalk");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember],
});

client.commands = new Collection();

// ── Load Commands ─────────────────────────────────────────────────────────────
function registerCmd(cmd) {
  if (cmd?.data && cmd?.execute) client.commands.set(cmd.data.name, cmd);
}

function loadCommands(dir) {
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith(".js")) {
      try {
        const mod = require(fullPath);
        registerCmd(mod);
        for (const key of Object.keys(mod)) {
          if (key !== "data" && key !== "execute" && typeof mod[key] === "object") {
            registerCmd(mod[key]);
          }
        }
      } catch (err) {
        console.error(chalk.red(`[CMD] Failed to load ${fullPath}: ${err.message}`));
      }
    }
  }
}
loadCommands(path.join(__dirname, "commands"));

// ── Load Events ───────────────────────────────────────────────────────────────
function loadEvents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
    const event = require(path.join(dir, file));
    // Use explicit name if provided, otherwise derive from filename
    const name  = event.name || file.replace(".js", "");
    event.once
      ? client.once(name,  (...args) => event.execute(...args, client))
      : client.on(name,    (...args) => event.execute(...args, client));
  }
}
loadEvents(path.join(__dirname, "events"));

// ── MongoDB ───────────────────────────────────────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error(chalk.red("[DB] No MONGO_URI set.")); process.exit(1); }
  await mongoose.connect(uri);
  console.log(chalk.green("[DB] Connected to MongoDB"));
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  await connectDB();
  const token = process.env.DISCORD_TOKEN;
  if (!token) { console.error(chalk.red("[BOT] No DISCORD_TOKEN set.")); process.exit(1); }
  await client.login(token);
})();

process.on("unhandledRejection", err => console.error(chalk.red("[ERROR]"), err));
