/**
 * /teamlist — Postet die Teamliste
 * Auto-splits into multiple containers when component limit (40) is reached
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

const MAX_COMPONENTS = 38; // safe limit per container (Discord allows 40)

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

  // Fetch all members
  await interaction.guild.members.fetch();

  // Sort roles by position (lowest first)
  const roles = roleIds
    .map(id => interaction.guild.roles.cache.get(id))
    .filter(Boolean)
    .sort((a, b) => a.position - b.position);

  // ── Build all text blocks first ───────────────────────────────────────────
  const blocks = []; // each block = { type: "header"|"role"|"footer", content }

  blocks.push({
    type: "header",
    content: `# 👮 ${interaction.guild.name} | Teamliste`,
  });

  for (const role of roles) {
    const members = role.members
      .filter(m => !m.user.bot)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const plural = members.size !== 1 ? "Mitglieder" : "Mitglied";
    const memberLines = members.size > 0
      ? [...members.values()].map(m => `▸ ${m.toString()}`).join("\n")
      : "*Keine Mitglieder*";

    blocks.push({
      type: "role",
      header: "▶ " + role.toString() + " **(" + members.size + " " + plural + ")**",
      members: memberLines,
    });
  }

  blocks.push({
    type: "footer",
    content: `-# NRW:RP I German • ${roles.length} Rollen • <t:${Math.floor(Date.now() / 1000)}:R>`,
  });

  // ── Pack blocks into containers respecting the 40-component limit ─────────
  const containers = [];
  let current = new ContainerBuilder().setAccentColor(0x5865F2);
  let count = 0;

  function flush() {
    if (count > 0) {
      containers.push(current);
      current = new ContainerBuilder().setAccentColor(0x5865F2);
      count = 0;
    }
  }

  function addText(content) {
    // Each TextDisplay = 1 component
    if (count + 1 > MAX_COMPONENTS) flush();
    current.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    count++;
  }

  function addSep() {
    // Separator = 1 component
    if (count + 1 > MAX_COMPONENTS) flush();
    current.addSeparatorComponents(new SeparatorBuilder());
    count++;
  }

  for (const block of blocks) {
    if (block.type === "header") {
      addText(block.content);
      addSep();
    } else if (block.type === "footer") {
      addSep();
      addText(block.content);
    } else {
      // Role block: header + separator + members = 3 components minimum
      // If members are very long, split across containers
      addText(block.header);
      addSep();
      addText(block.members);
    }
  }

  flush();

  // ── Send all containers in one or more messages ───────────────────────────
  // Discord allows up to 10 top-level components per message
  const MAX_PER_MSG = 10;
  let sent = 0;

  for (let i = 0; i < containers.length; i += MAX_PER_MSG) {
    const chunk = containers.slice(i, i + MAX_PER_MSG);
    await targetChannel.send({
      components: chunk,
      flags: MessageFlags.IsComponentsV2,
    });
    sent++;
  }

  await interaction.editReply({
    content: `✅ Teamliste wurde in ${targetChannel} gepostet. (${sent} Nachricht${sent !== 1 ? "en" : ""}, ${roles.length} Rollen)`,
  });
}

module.exports = { data, execute };
