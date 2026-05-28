/**
 * /automod — AutoMod system inspired by Reo bot
 * antilink | antispam | antibadwords | status
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../../utils/guildConfig");

const data = new SlashCommandBuilder()
  .setName("automod")
  .setDescription("🤖 AutoMod System verwalten")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  .addSubcommand(sub =>
    sub.setName("antilink")
      .setDescription("Anti-Link Schutz ein/ausschalten")
      .addBooleanOption(o => o.setName("aktiviert").setDescription("Ein oder Aus").setRequired(true))
      .addStringOption(o =>
        o.setName("aktion").setDescription("Was passiert bei Links?")
          .addChoices(
            { name: "Löschen",          value: "delete"  },
            { name: "Löschen + Warnen", value: "warn"    },
            { name: "Löschen + Kick",   value: "kick"    },
            { name: "Löschen + Ban",    value: "ban"     },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName("antispam")
      .setDescription("Anti-Spam Schutz ein/ausschalten")
      .addBooleanOption(o => o.setName("aktiviert").setDescription("Ein oder Aus").setRequired(true))
      .addIntegerOption(o => o.setName("limit").setDescription("Max Nachrichten in 5 Sek (Standard: 5)").setMinValue(2).setMaxValue(20))
  )
  .addSubcommand(sub =>
    sub.setName("antibadwords")
      .setDescription("Anti-Schimpfwörter ein/ausschalten")
      .addBooleanOption(o => o.setName("aktiviert").setDescription("Ein oder Aus").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("addword")
      .setDescription("Wort zur Blacklist hinzufügen")
      .addStringOption(o => o.setName("wort").setDescription("Blacklist-Wort").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("removeword")
      .setDescription("Wort von der Blacklist entfernen")
      .addStringOption(o => o.setName("wort").setDescription("Blacklist-Wort").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("ignore")
      .setDescription("Channel/Rolle vom AutoMod ausnehmen")
      .addStringOption(o =>
        o.setName("typ").setDescription("Typ").setRequired(true)
          .addChoices({ name: "Channel", value: "channel" }, { name: "Rolle", value: "role" })
      )
      .addStringOption(o => o.setName("id").setDescription("Channel- oder Rollen-ID").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("status")
      .setDescription("AutoMod Status anzeigen")
  );

async function execute(interaction) {
  const sub  = interaction.options.getSubcommand();
  const cfg  = await getGuildConfig(interaction.guild.id);

  if (sub === "status") return await showStatus(interaction, cfg);
  if (sub === "antilink")     return await toggleAntilink(interaction, cfg);
  if (sub === "antispam")     return await toggleAntispam(interaction, cfg);
  if (sub === "antibadwords") return await toggleAntibadwords(interaction, cfg);
  if (sub === "addword")      return await addWord(interaction, cfg);
  if (sub === "removeword")   return await removeWord(interaction, cfg);
  if (sub === "ignore")       return await addIgnore(interaction, cfg);
}

async function showStatus(interaction, cfg) {
  const am = cfg.automod || {};
  const toggle = (v) => v ? "✅ Aktiv" : "❌ Inaktiv";

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🤖 AutoMod Status")
        .addFields(
          { name: "🔗 Anti-Link",       value: `${toggle(am.antilinkEnabled)}\nAktion: ${am.antilinkAction || "delete"}`, inline: true },
          { name: "🌊 Anti-Spam",       value: `${toggle(am.antispamEnabled)}\nLimit: ${am.antispamLimit || 5}/5s`,       inline: true },
          { name: "🤬 Anti-Badwords",   value: toggle(am.antibadwordsEnabled),                                             inline: true },
          { name: "📝 Blacklist",        value: `${(am.blacklist || []).length} Wörter`,                                   inline: true },
          { name: "🙈 Ignorierte IDs",  value: `${(am.ignoreList || []).length} Einträge`,                                inline: true },
        )
        .setTimestamp(),
    ],
    flags: 64,
  });
}

async function toggleAntilink(interaction, cfg) {
  const enabled = interaction.options.getBoolean("aktiviert");
  const action  = interaction.options.getString("aktion") || cfg.automod?.antilinkAction || "delete";
  await updateGuildConfig(interaction.guild.id, { "automod.antilinkEnabled": enabled, "automod.antilinkAction": action });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(enabled ? 0x57F287 : 0xED4245).setTitle(`🔗 Anti-Link ${enabled ? "aktiviert" : "deaktiviert"}`).setDescription(`Aktion: **${action}**`).setTimestamp()],
  });
}

async function toggleAntispam(interaction, cfg) {
  const enabled = interaction.options.getBoolean("aktiviert");
  const limit   = interaction.options.getInteger("limit") || 5;
  await updateGuildConfig(interaction.guild.id, { "automod.antispamEnabled": enabled, "automod.antispamLimit": limit });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(enabled ? 0x57F287 : 0xED4245).setTitle(`🌊 Anti-Spam ${enabled ? "aktiviert" : "deaktiviert"}`).setDescription(`Limit: **${limit}** Nachrichten in 5 Sekunden`).setTimestamp()],
  });
}

async function toggleAntibadwords(interaction, cfg) {
  const enabled = interaction.options.getBoolean("aktiviert");
  await updateGuildConfig(interaction.guild.id, { "automod.antibadwordsEnabled": enabled });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(enabled ? 0x57F287 : 0xED4245).setTitle(`🤬 Anti-Badwords ${enabled ? "aktiviert" : "deaktiviert"}`).setTimestamp()],
  });
}

async function addWord(interaction, cfg) {
  const word      = interaction.options.getString("wort").toLowerCase();
  const blacklist = cfg.automod?.blacklist || [];
  if (blacklist.includes(word)) return interaction.reply({ content: "⚠️ Dieses Wort ist bereits in der Blacklist.", flags: 64 });
  blacklist.push(word);
  await updateGuildConfig(interaction.guild.id, { "automod.blacklist": blacklist });
  await interaction.reply({ content: `✅ \`${word}\` wurde zur Blacklist hinzugefügt.`, flags: 64 });
}

async function removeWord(interaction, cfg) {
  const word      = interaction.options.getString("wort").toLowerCase();
  const blacklist = (cfg.automod?.blacklist || []).filter(w => w !== word);
  await updateGuildConfig(interaction.guild.id, { "automod.blacklist": blacklist });
  await interaction.reply({ content: `✅ \`${word}\` wurde aus der Blacklist entfernt.`, flags: 64 });
}

async function addIgnore(interaction, cfg) {
  const id        = interaction.options.getString("id");
  const ignoreList = cfg.automod?.ignoreList || [];
  if (!ignoreList.includes(id)) {
    ignoreList.push(id);
    await updateGuildConfig(interaction.guild.id, { "automod.ignoreList": ignoreList });
  }
  await interaction.reply({ content: `✅ \`${id}\` wurde zur Ignore-Liste hinzugefügt.`, flags: 64 });
}

module.exports = { data, execute };
