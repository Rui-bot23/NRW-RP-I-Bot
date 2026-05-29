/**
 * /teamlist — Postet die Teamliste (konfigurierbare Rollen)
 * Sortiert von niedrigster Rolle (unten) zu höchster (oben)
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../../utils/guildConfig");

const data = new SlashCommandBuilder()
  .setName("teamlist")
  .setDescription("Teamliste posten/aktualisieren")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o => o.setName("channel").setDescription("Channel (Standard: konfigurierter Channel)"));

async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg = await getGuildConfig(interaction.guild.id);

  const channel = interaction.options.getChannel("channel");
  if (channel) {
    await updateGuildConfig(interaction.guild.id, { teamlistChannelId: channel.id });
    cfg.teamlistChannelId = channel.id;
  }

  if (!cfg.teamlistChannelId) {
    return interaction.editReply({ content: "❌ Kein Channel gesetzt. Nutze `/teamlist channel:#kanal` oder konfiguriere ihn im Dashboard." });
  }

  const targetChannel = interaction.guild.channels.cache.get(cfg.teamlistChannelId);
  if (!targetChannel) return interaction.editReply({ content: "❌ Channel nicht gefunden." });

  const roleIds = cfg.teamlistRoleIds || [];
  if (!roleIds.length) {
    return interaction.editReply({ content: "❌ Keine Rollen konfiguriert. Füge sie im Dashboard unter **Team Liste** hinzu." });
  }

  // Fetch all members
  await interaction.guild.members.fetch();

  // Sort roles by position (lowest first = bottom of role list)
  const roles = roleIds
    .map(id => interaction.guild.roles.cache.get(id))
    .filter(Boolean)
    .sort((a, b) => a.position - b.position);

  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 👮 ${interaction.guild.name} | Teamliste`)
    )
    .addSeparatorComponents(new SeparatorBuilder());

  for (const role of roles) {
    const members = role.members
      .filter(m => !m.user.bot)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const memberLines = members.size > 0
      ? [...members.values()].map(m => `▸ ${m.toString()}`).join("\n")
      : "*Keine Mitglieder*";

    const plural = members.size !== 1 ? "Mitglieder" : "Mitglied";
    const line = "▶ " + role.toString() + " **(" + members.size + " " + plural + ")**\n" + memberLines;
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(line)
    );
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# NRW:RP I German • ${roles.length} Rollen • Zuletzt aktualisiert <t:${Math.floor(Date.now() / 1000)}:R>`)
  );

  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  await targetChannel.send(payload);
  await interaction.editReply({ content: `✅ Teamliste wurde in ${targetChannel} gepostet.` });
}

module.exports = { data, execute };
