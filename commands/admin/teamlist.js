/**
 * /teamlist — Postet die Teamliste
 * Each role = its own message to avoid component limits
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
  .addChannelOption(o =>
    o.setName("channel").setDescription("Channel (Standard: konfigurierter Channel)")
  );

async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg = await getGuildConfig(interaction.guild.id);

  const channel = interaction.options.getChannel("channel");
  if (channel) {
    await updateGuildConfig(interaction.guild.id, { teamlistChannelId: channel.id });
    cfg.teamlistChannelId = channel.id;
  }

  if (!cfg.teamlistChannelId) {
    return interaction.editReply({ content: "❌ Kein Channel gesetzt. Nutze `/teamlist channel:#kanal`." });
  }

  const targetChannel = interaction.guild.channels.cache.get(cfg.teamlistChannelId);
  if (!targetChannel) return interaction.editReply({ content: "❌ Channel nicht gefunden." });

  const roleIds = cfg.teamlistRoleIds || [];
  if (!roleIds.length) {
    return interaction.editReply({ content: "❌ Keine Rollen konfiguriert. Füge sie im Dashboard unter **Team Liste** hinzu." });
  }

  await interaction.guild.members.fetch();

  const roles = roleIds
    .map(id => interaction.guild.roles.cache.get(id))
    .filter(Boolean)
    .sort((a, b) => a.position - b.position);

  // ── Header message ────────────────────────────────────────────────────────
  await targetChannel.send({
    components: [
      new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# 👮 ${interaction.guild.name} | Teamliste`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# ${roles.length} Rollen • <t:${Math.floor(Date.now() / 1000)}:R>`
          )
        ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  // ── One message per role ──────────────────────────────────────────────────
  for (const role of roles) {
    const members = role.members
      .filter(m => !m.user.bot)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const plural = members.size !== 1 ? "Mitglieder" : "Mitglied";

    // Split members into chunks of 15 to stay safe within one container
    const memberArray = [...members.values()];
    const CHUNK = 15;

    for (let i = 0; i < Math.max(1, Math.ceil(memberArray.length / CHUNK)); i++) {
      const chunk = memberArray.slice(i * CHUNK, (i + 1) * CHUNK);
      const isFirst = i === 0;

      const memberLines = chunk.length > 0
        ? chunk.map(m => `▸ ${m.toString()}`).join("\n")
        : "*Keine Mitglieder*";

      const header = isFirst
        ? "▶ " + role.toString() + " **(" + members.size + " " + plural + ")**"
        : "▶ " + role.toString() + " *(Fortsetzung)*";

      const container = new ContainerBuilder()
        .setAccentColor(role.color || 0x5865F2)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(memberLines));

      await targetChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }

  await interaction.editReply({
    content: `✅ Teamliste in ${targetChannel} gepostet. (${roles.length} Rollen)`,
  });
}

module.exports = { data, execute };
