/**
 * /teamlist — Postet die Teamliste
 *
 * Discord limit: 40 total components per message (counted recursively)
 * Each container itself = 1, each TextDisplay = 1, each Separator = 1
 * So a role block (1 container + 1 header + 1 sep + 1 members) = 4 components
 * → ~9 roles per message safely (36 components + 1 header container = 40)
 *
 * Strategy: pack as many role containers as possible per message,
 * start new message when limit is near — no channel spam.
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

// Conservative limit: each component counts recursively
const MAX_TOTAL = 36; // leave 4 spare

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
    return interaction.editReply({ content: "❌ Keine Rollen konfiguriert." });
  }

  await interaction.guild.members.fetch();

  const roles = roleIds
    .map(id => interaction.guild.roles.cache.get(id))
    .filter(Boolean)
    .sort((a, b) => a.position - b.position);

  // ── Build role blocks ─────────────────────────────────────────────────────
  // Each block = { container: ContainerBuilder, cost: number }
  // cost = 1 (container) + components inside it
  const roleBlocks = [];

  for (const role of roles) {
    const members = role.members
      .filter(m => !m.user.bot)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const plural = members.size !== 1 ? "Mitglieder" : "Mitglied";
    const header = "▶ " + role.toString() + " **(" + members.size + " " + plural + ")**";

    // Keep all members in one string — just one TextDisplay component
    const memberLines = members.size > 0
      ? [...members.values()].map(m => `▸ ${m.toString()}`).join("\n")
      : "*Keine Mitglieder*";

    const container = new ContainerBuilder()
      .setAccentColor(role.color || 0x5865F2)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(memberLines));

    // cost: 1 container + 2 textdisplay + 1 separator = 4
    roleBlocks.push({ container, cost: 4 });
  }

  // ── Pack blocks into messages ─────────────────────────────────────────────
  // Header message first (cost = 1 container + 2 text + 1 sep = 4)
  const headerContainer = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 👮 ${interaction.guild.name} | Teamliste`)
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${roles.length} Rollen • <t:${Math.floor(Date.now() / 1000)}:R>`
      )
    );

  await targetChannel.send({
    components: [headerContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // Now pack role blocks greedily into messages
  let currentContainers = [];
  let currentCost = 0;
  let msgCount = 1;

  async function flush() {
    if (!currentContainers.length) return;
    await targetChannel.send({
      components: currentContainers,
      flags: MessageFlags.IsComponentsV2,
    });
    msgCount++;
    currentContainers = [];
    currentCost = 0;
  }

  for (const block of roleBlocks) {
    if (currentCost + block.cost > MAX_TOTAL) {
      await flush();
    }
    currentContainers.push(block.container);
    currentCost += block.cost;
  }
  await flush();

  await interaction.editReply({
    content: `✅ Teamliste in ${targetChannel} gepostet. (${msgCount} Nachrichten, ${roles.length} Rollen)`,
  });
}

module.exports = { data, execute };
