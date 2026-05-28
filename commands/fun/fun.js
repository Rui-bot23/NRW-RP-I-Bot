/**
 * Fun & Utility commands inspired by Reo bot
 * /slap /hug /kiss /coinflip /8ball /roll /avatar /serverinfo /userinfo /afk /snipe
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

// Snipe store (in-memory, last deleted message per channel)
const snipeStore = new Map(); // channelId -> { content, author, timestamp }

// AFK store (in-memory)
const afkStore = new Map(); // userId -> { reason, timestamp }

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

async function getGif(query) {
  // Uses tenor free API (no key needed for basic use)
  try {
    const res = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=20&contentfilter=medium`);
    const data = await res.json();
    const results = data?.results || [];
    if (!results.length) return null;
    const pick = results[Math.floor(Math.random() * results.length)];
    return pick?.media?.[0]?.gif?.url || pick?.media?.[0]?.tinygif?.url || null;
  } catch { return null; }
}

// ── /slap ─────────────────────────────────────────────────────────────────────
const slapData = new SlashCommandBuilder()
  .setName("slap")
  .setDescription("👋 Jemanden schlagen")
  .addUserOption(o => o.setName("nutzer").setDescription("Wen?").setRequired(true));

async function executeSlap(interaction) {
  const target = interaction.options.getUser("nutzer");
  const gif    = await getGif("anime slap");
  const embed  = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${interaction.user.username} hat ${target.id === interaction.user.id ? "sich selbst" : target.username} geohrfeigt!`)
    .setFooter({ text: `Von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  if (gif) embed.setImage(gif);
  await interaction.reply({ embeds: [embed] });
}

// ── /hug ──────────────────────────────────────────────────────────────────────
const hugData = new SlashCommandBuilder()
  .setName("hug")
  .setDescription("🤗 Jemanden umarmen")
  .addUserOption(o => o.setName("nutzer").setDescription("Wen?").setRequired(true));

async function executeHug(interaction) {
  const target = interaction.options.getUser("nutzer");
  const gif    = await getGif("anime hug");
  const embed  = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${interaction.user.username} hat ${target.id === interaction.user.id ? "sich selbst" : target.username} umarmt! 🤗`)
    .setFooter({ text: `Von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  if (gif) embed.setImage(gif);
  await interaction.reply({ embeds: [embed] });
}

// ── /kiss ─────────────────────────────────────────────────────────────────────
const kissData = new SlashCommandBuilder()
  .setName("kiss")
  .setDescription("💋 Jemanden küssen")
  .addUserOption(o => o.setName("nutzer").setDescription("Wen?").setRequired(true));

async function executeKiss(interaction) {
  const target = interaction.options.getUser("nutzer");
  const gif    = await getGif("anime kiss");
  const embed  = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${interaction.user.username} hat ${target.id === interaction.user.id ? "sich selbst" : target.username} geküsst! 💋`)
    .setFooter({ text: `Von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  if (gif) embed.setImage(gif);
  await interaction.reply({ embeds: [embed] });
}

// ── /coinflip ─────────────────────────────────────────────────────────────────
const coinflipData = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("🪙 Münze werfen");

async function executeCoinflip(interaction) {
  const result = Math.random() < 0.5 ? "Kopf 👑" : "Zahl 🔢";
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle("🪙 Münzwurf").setDescription(`**${result}**`).setTimestamp()],
  });
}

// ── /8ball ────────────────────────────────────────────────────────────────────
const eightballData = new SlashCommandBuilder()
  .setName("8ball")
  .setDescription("🎱 Frag die magische 8-Ball")
  .addStringOption(o => o.setName("frage").setDescription("Deine Frage").setRequired(true));

const ANSWERS_DE = [
  "Ja, definitiv!", "Es ist gewiss.", "Ohne Zweifel.", "Ja.",
  "Die Zeichen sagen Ja.", "Antworte ist nebulös, versuch's nochmal.",
  "Lieber nicht jetzt.", "Sehr zweifelhaft.", "Nein.", "Absolut nicht."
];

async function executeEightball(interaction) {
  const frage  = interaction.options.getString("frage");
  const answer = ANSWERS_DE[Math.floor(Math.random() * ANSWERS_DE.length)];
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎱 Magische 8-Ball")
        .addFields(
          { name: "❓ Frage",    value: frage,  inline: false },
          { name: "🎱 Antwort", value: answer, inline: false },
        )
        .setTimestamp(),
    ],
  });
}

// ── /roll ─────────────────────────────────────────────────────────────────────
const rollData = new SlashCommandBuilder()
  .setName("roll")
  .setDescription("🎲 Würfeln")
  .addIntegerOption(o => o.setName("seiten").setDescription("Anzahl Seiten (Standard: 6)").setMinValue(2).setMaxValue(1000));

async function executeRoll(interaction) {
  const sides  = interaction.options.getInteger("seiten") || 6;
  const result = Math.floor(Math.random() * sides) + 1;
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x57F287).setTitle(`🎲 Würfel (1-${sides})`).setDescription(`Du hast eine **${result}** gewürfelt!`).setTimestamp()],
  });
}

// ── /avatar ───────────────────────────────────────────────────────────────────
const avatarData = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("🖼️ Avatar eines Nutzers anzeigen")
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer (leer = du)"));

async function executeAvatar(interaction) {
  const user = interaction.options.getUser("nutzer") || interaction.user;
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(randomColor())
        .setTitle(`🖼️ Avatar von ${user.username}`)
        .setImage(user.displayAvatarURL({ size: 512, dynamic: true }))
        .addFields({ name: "Links", value: `[PNG](${user.displayAvatarURL({ size: 512, format: "png" })}) · [JPG](${user.displayAvatarURL({ size: 512, format: "jpg" })}) · [WEBP](${user.displayAvatarURL({ size: 512, format: "webp" })})` })
        .setTimestamp(),
    ],
  });
}

// ── /serverinfo ───────────────────────────────────────────────────────────────
const serverinfoData = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("📊 Server-Informationen anzeigen");

async function executeServerinfo(interaction) {
  const guild   = interaction.guild;
  const owner   = await guild.fetchOwner().catch(() => null);
  const created = Math.floor(guild.createdTimestamp / 1000);
  const online  = guild.members.cache.filter(m => m.presence?.status !== "offline").size;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📊 ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: "👑 Owner",       value: owner ? `${owner.user.tag}` : "Unbekannt",     inline: true  },
      { name: "📅 Erstellt",    value: `<t:${created}:F>`,                            inline: true  },
      { name: "👥 Mitglieder",  value: `${guild.memberCount}`,                        inline: true  },
      { name: "💬 Channels",    value: `${guild.channels.cache.size}`,                inline: true  },
      { name: "🎭 Rollen",      value: `${guild.roles.cache.size}`,                   inline: true  },
      { name: "😀 Emojis",      value: `${guild.emojis.cache.size}`,                  inline: true  },
      { name: "🌐 Region",      value: guild.preferredLocale || "en-US",              inline: true  },
      { name: "🆙 Boosts",      value: `${guild.premiumSubscriptionCount || 0} (Level ${guild.premiumTier})`, inline: true },
    )
    .setFooter({ text: `ID: ${guild.id}` })
    .setTimestamp();

  if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 512 }));
  await interaction.reply({ embeds: [embed] });
}

// ── /userinfo ─────────────────────────────────────────────────────────────────
const userinfoData = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("👤 Nutzer-Informationen anzeigen")
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer (leer = du)"));

async function executeUserinfo(interaction) {
  const user   = interaction.options.getUser("nutzer") || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const created = Math.floor(user.createdTimestamp / 1000);
  const joined  = member ? Math.floor(member.joinedTimestamp / 1000) : null;

  const roles = member
    ? member.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position).map(r => `<@&${r.id}>`).slice(0, 10).join(", ") || "*Keine*"
    : "*Nicht im Server*";

  const embed = new EmbedBuilder()
    .setColor(member?.displayHexColor || 0x5865F2)
    .setTitle(`👤 ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: "🆔 ID",           value: user.id,                           inline: true },
      { name: "📅 Registriert",  value: `<t:${created}:F>`,               inline: true },
      { name: "📥 Beigetreten",  value: joined ? `<t:${joined}:F>` : "—", inline: true },
      { name: "🤖 Bot",          value: user.bot ? "Ja" : "Nein",         inline: true },
      { name: "🎭 Rollen",       value: roles,                             inline: false },
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ── /afk ──────────────────────────────────────────────────────────────────────
const afkData = new SlashCommandBuilder()
  .setName("afk")
  .setDescription("💤 AFK Status setzen")
  .addStringOption(o => o.setName("grund").setDescription("Grund (optional)"));

async function executeAfk(interaction) {
  const grund = interaction.options.getString("grund") || "AFK";

  if (afkStore.has(interaction.user.id)) {
    afkStore.delete(interaction.user.id);
    return interaction.reply({ content: "✅ Dein AFK Status wurde entfernt. Willkommen zurück!", flags: 64 });
  }

  afkStore.set(interaction.user.id, { reason: grund, timestamp: Date.now() });
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("💤 AFK gesetzt")
        .setDescription(`Du bist jetzt AFK: **${grund}**`)
        .setFooter({ text: "Schreibe eine Nachricht um AFK zu entfernen" })
        .setTimestamp(),
    ],
  });
}

// ── /snipe ────────────────────────────────────────────────────────────────────
const snipeData = new SlashCommandBuilder()
  .setName("snipe")
  .setDescription("🔍 Letzte gelöschte Nachricht anzeigen");

async function executeSnipe(interaction) {
  const data = snipeStore.get(interaction.channel.id);
  if (!data) {
    return interaction.reply({ content: "❌ Keine gelöschten Nachrichten im Cache.", flags: 64 });
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔍 Gelöschte Nachricht")
        .setDescription(data.content || "*Kein Text (Embed/Anhang)*")
        .setAuthor({ name: data.authorTag, iconURL: data.authorAvatar })
        .setFooter({ text: `Gelöscht` })
        .setTimestamp(data.timestamp),
    ],
  });
}

// ── /ping ─────────────────────────────────────────────────────────────────────
const pingData = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("🏓 Bot-Latenz anzeigen");

async function executePing(interaction) {
  const sent = await interaction.reply({ content: "🏓 Messe...", fetchReply: true });
  const rt   = sent.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply({
    content: "",
    embeds: [
      new EmbedBuilder()
        .setColor(rt < 100 ? 0x57F287 : rt < 300 ? 0xFEE75C : 0xED4245)
        .setTitle("🏓 Pong!")
        .addFields(
          { name: "⚡ Roundtrip",  value: `${rt}ms`,                          inline: true },
          { name: "💓 WebSocket",  value: `${interaction.client.ws.ping}ms`,  inline: true },
        )
        .setTimestamp(),
    ],
  });
}

module.exports = {
  data: slapData, execute: executeSlap,
  hug:        { data: hugData,        execute: executeHug        },
  kiss:       { data: kissData,       execute: executeKiss       },
  coinflip:   { data: coinflipData,   execute: executeCoinflip   },
  eightball:  { data: eightballData,  execute: executeEightball  },
  roll:       { data: rollData,       execute: executeRoll       },
  avatar:     { data: avatarData,     execute: executeAvatar     },
  serverinfo: { data: serverinfoData, execute: executeServerinfo },
  userinfo:   { data: userinfoData,   execute: executeUserinfo   },
  afk:        { data: afkData,        execute: executeAfk        },
  snipe:      { data: snipeData,      execute: executeSnipe      },
  ping:       { data: pingData,       execute: executePing       },
  // Exported stores for event access
  snipeStore,
  afkStore,
};
