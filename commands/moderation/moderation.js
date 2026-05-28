/**
 * Moderation commands
 * ban | kick | timeout | untimeout | warn | warnings | clearwarns
 * purge | lock | unlock | slowmode | nick
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { getGuildConfig } = require("../../utils/guildConfig");
const { getEmojis } = require("../../utils/emojiManager");
const { GuildConfig } = require("../../models");

// ── Warning storage (in DB via GuildConfig warnings map) ─────────────────────
async function addWarning(guildId, userId, reason, modId) {
  const entry = { reason, modId, timestamp: Date.now() };
  await GuildConfig.findOneAndUpdate(
    { guildId },
    { $push: { [`warnings.${userId}`]: entry } },
    { upsert: true }
  );
  const cfg = await GuildConfig.findOne({ guildId });
  return cfg?.warnings?.get?.(userId)?.length || 1;
}

async function getWarnings(guildId, userId) {
  const cfg = await GuildConfig.findOne({ guildId });
  return cfg?.warnings?.get?.(userId) || [];
}

async function clearWarnings(guildId, userId) {
  await GuildConfig.findOneAndUpdate(
    { guildId },
    { $unset: { [`warnings.${userId}`]: "" } },
    { upsert: true }
  );
}

function modEmbed(color, title, description) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}

// ── /ban ─────────────────────────────────────────────────────────────────────
const banData = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Einen Nutzer bannen")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund"))
  .addIntegerOption(o => o.setName("delete_days").setDescription("Nachrichten löschen (Tage, 0-7)").setMinValue(0).setMaxValue(7));

async function executeBan(interaction) {
  const user   = interaction.options.getUser("nutzer");
  const grund  = interaction.options.getString("grund") || "Kein Grund angegeben";
  const days   = interaction.options.getInteger("delete_days") ?? 0;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (member && !member.bannable) {
    return interaction.reply({ content: "❌ Ich kann diesen Nutzer nicht bannen.", flags: 64 });
  }

  try {
    await interaction.guild.members.ban(user.id, { reason: `${grund} | Mod: ${interaction.user.tag}`, deleteMessageDays: days });
    await interaction.reply({ embeds: [modEmbed(0xED4245, "🔨 Gebannt", `**${user.tag}** wurde gebannt.\n**Grund:** ${grund}`)] });
    await logAction(interaction, "Ban", user, grund);
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

// ── /kick ────────────────────────────────────────────────────────────────────
const kickData = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Einen Nutzer kicken")
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund"));

async function executeKick(interaction) {
  const user   = interaction.options.getUser("nutzer");
  const grund  = interaction.options.getString("grund") || "Kein Grund angegeben";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) return interaction.reply({ content: "❌ Nutzer nicht gefunden.", flags: 64 });
  if (!member.kickable) return interaction.reply({ content: "❌ Ich kann diesen Nutzer nicht kicken.", flags: 64 });

  try {
    await member.kick(`${grund} | Mod: ${interaction.user.tag}`);
    await interaction.reply({ embeds: [modEmbed(0xFEE75C, "👢 Gekickt", `**${user.tag}** wurde gekickt.\n**Grund:** ${grund}`)] });
    await logAction(interaction, "Kick", user, grund);
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

// ── /timeout ─────────────────────────────────────────────────────────────────
const timeoutData = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Einen Nutzer timeout geben")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  .addStringOption(o =>
    o.setName("dauer").setDescription("Dauer (z.B. 10m, 1h, 1d)").setRequired(true)
  )
  .addStringOption(o => o.setName("grund").setDescription("Grund"));

function parseDuration(str) {
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  return parseInt(match[1]) * (map[match[2].toLowerCase()] || 0);
}

async function executeTimeout(interaction) {
  const user   = interaction.options.getUser("nutzer");
  const dauer  = interaction.options.getString("dauer");
  const grund  = interaction.options.getString("grund") || "Kein Grund angegeben";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) return interaction.reply({ content: "❌ Nutzer nicht gefunden.", flags: 64 });

  const ms = parseDuration(dauer);
  if (!ms) return interaction.reply({ content: "❌ Ungültige Dauer. Beispiele: `10m`, `1h`, `2d`", flags: 64 });
  if (ms > 28 * 24 * 60 * 60 * 1000) return interaction.reply({ content: "❌ Max. 28 Tage.", flags: 64 });

  try {
    await member.timeout(ms, `${grund} | Mod: ${interaction.user.tag}`);
    await interaction.reply({ embeds: [modEmbed(0xFEE75C, "⏱️ Timeout", `**${user.tag}** hat einen Timeout für **${dauer}**.\n**Grund:** ${grund}`)] });
    await logAction(interaction, "Timeout", user, `${grund} (${dauer})`);
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

// ── /untimeout ────────────────────────────────────────────────────────────────
const untimeoutData = new SlashCommandBuilder()
  .setName("untimeout")
  .setDescription("Timeout eines Nutzers aufheben")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true));

async function executeUntimeout(interaction) {
  const user   = interaction.options.getUser("nutzer");
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: "❌ Nutzer nicht gefunden.", flags: 64 });

  try {
    await member.timeout(null);
    await interaction.reply({ embeds: [modEmbed(0x57F287, "✅ Timeout aufgehoben", `**${user.tag}** hat keinen Timeout mehr.`)] });
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

// ── /warn ─────────────────────────────────────────────────────────────────────
const warnData = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Einen Nutzer verwarnen")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  .addStringOption(o => o.setName("grund").setDescription("Grund").setRequired(true));

async function executeWarn(interaction) {
  const user  = interaction.options.getUser("nutzer");
  const grund = interaction.options.getString("grund");
  const count = await addWarning(interaction.guild.id, user.id, grund, interaction.user.id);

  await interaction.reply({
    embeds: [modEmbed(0xFEE75C, "⚠️ Verwarnt", `**${user.tag}** wurde verwarnt.\n**Grund:** ${grund}\n**Verwarnungen gesamt:** ${count}`)],
  });
  await logAction(interaction, "Warn", user, grund);
}

// ── /warnings ─────────────────────────────────────────────────────────────────
const warningsData = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("Verwarnungen eines Nutzers anzeigen")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true));

async function executeWarnings(interaction) {
  const user  = interaction.options.getUser("nutzer");
  const warns = await getWarnings(interaction.guild.id, user.id);

  if (!warns.length) {
    return interaction.reply({ embeds: [modEmbed(0x57F287, "✅ Keine Verwarnungen", `**${user.tag}** hat keine Verwarnungen.`)], flags: 64 });
  }

  const lines = warns.map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.timestamp / 1000)}:R> von <@${w.modId}>`);
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle(`⚠️ Verwarnungen — ${user.tag}`).setDescription(lines.join("\n")).setTimestamp()],
    flags: 64,
  });
}

// ── /clearwarns ───────────────────────────────────────────────────────────────
const clearwarnsData = new SlashCommandBuilder()
  .setName("clearwarns")
  .setDescription("Alle Verwarnungen eines Nutzers löschen")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true));

async function executeClearwarns(interaction) {
  const user = interaction.options.getUser("nutzer");
  await clearWarnings(interaction.guild.id, user.id);
  await interaction.reply({ embeds: [modEmbed(0x57F287, "✅ Verwarnungen gelöscht", `Alle Verwarnungen von **${user.tag}** wurden gelöscht.`)] });
}

// ── /purge ────────────────────────────────────────────────────────────────────
const purgeData = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Nachrichten löschen")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(o => o.setName("anzahl").setDescription("Anzahl (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
  .addUserOption(o => o.setName("nutzer").setDescription("Nur Nachrichten dieses Nutzers löschen"));

async function executePurge(interaction) {
  const anzahl = interaction.options.getInteger("anzahl");
  const user   = interaction.options.getUser("nutzer");

  await interaction.deferReply({ flags: 64 });

  try {
    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    if (user) messages = messages.filter(m => m.author.id === user.id);
    const toDelete = [...messages.values()].slice(0, anzahl);

    await interaction.channel.bulkDelete(toDelete, true);
    await interaction.editReply({ content: `✅ **${toDelete.length}** Nachrichten gelöscht${user ? ` von ${user.tag}` : ""}.` });
  } catch (err) {
    await interaction.editReply({ content: `❌ Fehler: ${err.message}` });
  }
}

// ── /lock / /unlock ───────────────────────────────────────────────────────────
const lockData = new SlashCommandBuilder()
  .setName("lock")
  .setDescription("Channel sperren")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o.setName("grund").setDescription("Grund"));

async function executeLock(interaction) {
  const grund = interaction.options.getString("grund") || "Kein Grund angegeben";
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    await interaction.reply({ embeds: [modEmbed(0xED4245, "🔒 Channel gesperrt", `Dieser Channel wurde gesperrt.\n**Grund:** ${grund}`)] });
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

const unlockData = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("Channel entsperren")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

async function executeUnlock(interaction) {
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await interaction.reply({ embeds: [modEmbed(0x57F287, "🔓 Channel entsperrt", "Dieser Channel ist wieder entsperrt.")] });
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

// ── /slowmode ─────────────────────────────────────────────────────────────────
const slowmodeData = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Slowmode setzen")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption(o => o.setName("sekunden").setDescription("Sekunden (0 = deaktivieren)").setRequired(true).setMinValue(0).setMaxValue(21600));

async function executeSlowmode(interaction) {
  const secs = interaction.options.getInteger("sekunden");
  try {
    await interaction.channel.setRateLimitPerUser(secs);
    await interaction.reply({
      embeds: [modEmbed(0x5865F2, "⏱️ Slowmode", secs === 0 ? "Slowmode wurde deaktiviert." : `Slowmode auf **${secs} Sekunden** gesetzt.`)],
    });
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

// ── /nick ─────────────────────────────────────────────────────────────────────
const nickData = new SlashCommandBuilder()
  .setName("nick")
  .setDescription("Nickname eines Nutzers ändern")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  .addStringOption(o => o.setName("nickname").setDescription("Neuer Nickname (leer = zurücksetzen)"));

async function executeNick(interaction) {
  const user     = interaction.options.getUser("nutzer");
  const nickname = interaction.options.getString("nickname") || null;
  const member   = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) return interaction.reply({ content: "❌ Nutzer nicht gefunden.", flags: 64 });

  try {
    await member.setNickname(nickname);
    await interaction.reply({
      embeds: [modEmbed(0x57F287, "✏️ Nickname geändert", nickname ? `**${user.tag}** → \`${nickname}\`` : `Nickname von **${user.tag}** wurde zurückgesetzt.`)],
    });
  } catch (err) {
    await interaction.reply({ content: `❌ Fehler: ${err.message}`, flags: 64 });
  }
}

// ── Mod Log Helper ────────────────────────────────────────────────────────────
async function logAction(interaction, action, target, reason) {
  try {
    const cfg = await getGuildConfig(interaction.guild.id);
    if (!cfg.modLogChannelId) return;
    const logCh = interaction.guild.channels.cache.get(cfg.modLogChannelId);
    if (!logCh) return;

    const colors = { Ban: 0xED4245, Kick: 0xFEE75C, Timeout: 0xFEE75C, Warn: 0xFEE75C, Mute: 0xFEE75C };

    await logCh.send({
      embeds: [
        new EmbedBuilder()
          .setColor(colors[action] || 0x5865F2)
          .setTitle(`🛡️ Mod Log — ${action}`)
          .addFields(
            { name: "Nutzer",     value: `<@${target.id}> (${target.tag})`, inline: true },
            { name: "Moderator",  value: `<@${interaction.user.id}>`,        inline: true },
            { name: "Grund",      value: reason,                             inline: false },
          )
          .setTimestamp(),
      ],
    });
  } catch {}
}

module.exports = {
  data: banData, execute: executeBan,
  kick:        { data: kickData,       execute: executeKick       },
  timeout:     { data: timeoutData,    execute: executeTimeout    },
  untimeout:   { data: untimeoutData,  execute: executeUntimeout  },
  warn:        { data: warnData,       execute: executeWarn       },
  warnings:    { data: warningsData,   execute: executeWarnings   },
  clearwarns:  { data: clearwarnsData, execute: executeClearwarns },
  purge:       { data: purgeData,      execute: executePurge      },
  lock:        { data: lockData,       execute: executeLock       },
  unlock:      { data: unlockData,     execute: executeUnlock     },
  slowmode:    { data: slowmodeData,   execute: executeSlowmode   },
  nick:        { data: nickData,       execute: executeNick       },
};
