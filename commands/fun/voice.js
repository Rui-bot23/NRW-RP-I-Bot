/**
 * Voice commands inspired by Reo bot
 * /vcmute /vcunmute /vcdeafen /vcundeafen /vcmuteall /vcunmuteall /vckickall /vcmove
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

function ok(text)  { return new EmbedBuilder().setColor(0x57F287).setDescription(`✅ ${text}`).setTimestamp(); }
function err(text) { return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`).setTimestamp(); }

// ── /vcmute ───────────────────────────────────────────────────────────────────
const vcmuteData = new SlashCommandBuilder()
  .setName("vcmute")
  .setDescription("🔇 Nutzer im Voice stumm schalten")
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true));

async function executeVcmute(interaction) {
  const member = await interaction.guild.members.fetch(interaction.options.getUser("nutzer").id).catch(() => null);
  if (!member?.voice?.channel) return interaction.reply({ embeds: [err("Nutzer ist in keinem Voice-Channel.")], flags: 64 });
  await member.voice.setMute(true);
  await interaction.reply({ embeds: [ok(`${member} wurde stummgeschaltet.`)] });
}

// ── /vcunmute ─────────────────────────────────────────────────────────────────
const vcunmuteData = new SlashCommandBuilder()
  .setName("vcunmute")
  .setDescription("🔊 Stummschaltung aufheben")
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true));

async function executeVcunmute(interaction) {
  const member = await interaction.guild.members.fetch(interaction.options.getUser("nutzer").id).catch(() => null);
  if (!member?.voice?.channel) return interaction.reply({ embeds: [err("Nutzer ist in keinem Voice-Channel.")], flags: 64 });
  await member.voice.setMute(false);
  await interaction.reply({ embeds: [ok(`Stummschaltung von ${member} wurde aufgehoben.`)] });
}

// ── /vcdeafen ─────────────────────────────────────────────────────────────────
const vcdeafenData = new SlashCommandBuilder()
  .setName("vcdeafen")
  .setDescription("🔕 Nutzer im Voice taubschalten")
  .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true));

async function executeVcdeafen(interaction) {
  const member = await interaction.guild.members.fetch(interaction.options.getUser("nutzer").id).catch(() => null);
  if (!member?.voice?.channel) return interaction.reply({ embeds: [err("Nutzer ist in keinem Voice-Channel.")], flags: 64 });
  await member.voice.setDeaf(true);
  await interaction.reply({ embeds: [ok(`${member} wurde taubgeschaltet.`)] });
}

// ── /vcundeafen ───────────────────────────────────────────────────────────────
const vcundeafenData = new SlashCommandBuilder()
  .setName("vcundeafen")
  .setDescription("🔔 Taubschaltung aufheben")
  .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true));

async function executeVcundeafen(interaction) {
  const member = await interaction.guild.members.fetch(interaction.options.getUser("nutzer").id).catch(() => null);
  if (!member?.voice?.channel) return interaction.reply({ embeds: [err("Nutzer ist in keinem Voice-Channel.")], flags: 64 });
  await member.voice.setDeaf(false);
  await interaction.reply({ embeds: [ok(`Taubschaltung von ${member} wurde aufgehoben.`)] });
}

// ── /vcmuteall ────────────────────────────────────────────────────────────────
const vcmuteallData = new SlashCommandBuilder()
  .setName("vcmuteall")
  .setDescription("🔇 Alle in einem Voice-Channel stumm schalten")
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .addChannelOption(o => o.setName("channel").setDescription("Channel (leer = dein Channel)"));

async function executeVcmuteall(interaction) {
  await interaction.deferReply();
  const ch = interaction.options.getChannel("channel")
    || interaction.member?.voice?.channel;

  if (!ch) return interaction.editReply({ embeds: [err("Du bist in keinem Voice-Channel.")] });

  let count = 0;
  for (const [, member] of ch.members) {
    try { await member.voice.setMute(true); count++; } catch {}
  }
  await interaction.editReply({ embeds: [ok(`${count} Nutzer in **${ch.name}** wurden stummgeschaltet.`)] });
}

// ── /vcunmuteall ──────────────────────────────────────────────────────────────
const vcunmuteallData = new SlashCommandBuilder()
  .setName("vcunmuteall")
  .setDescription("🔊 Stummschaltung aller Nutzer aufheben")
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .addChannelOption(o => o.setName("channel").setDescription("Channel (leer = dein Channel)"));

async function executeVcunmuteall(interaction) {
  await interaction.deferReply();
  const ch = interaction.options.getChannel("channel") || interaction.member?.voice?.channel;
  if (!ch) return interaction.editReply({ embeds: [err("Du bist in keinem Voice-Channel.")] });

  let count = 0;
  for (const [, member] of ch.members) {
    try { await member.voice.setMute(false); count++; } catch {}
  }
  await interaction.editReply({ embeds: [ok(`Stummschaltung von ${count} Nutzern in **${ch.name}** aufgehoben.`)] });
}

// ── /vckickall ────────────────────────────────────────────────────────────────
const vckickallData = new SlashCommandBuilder()
  .setName("vckickall")
  .setDescription("👢 Alle aus einem Voice-Channel kicken")
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addChannelOption(o => o.setName("channel").setDescription("Channel (leer = dein Channel)"));

async function executeVckickall(interaction) {
  await interaction.deferReply();
  const ch = interaction.options.getChannel("channel") || interaction.member?.voice?.channel;
  if (!ch) return interaction.editReply({ embeds: [err("Du bist in keinem Voice-Channel.")] });

  let count = 0;
  for (const [, member] of ch.members) {
    try { await member.voice.disconnect(); count++; } catch {}
  }
  await interaction.editReply({ embeds: [ok(`${count} Nutzer aus **${ch.name}** gekickt.`)] });
}

// ── /vcmove ───────────────────────────────────────────────────────────────────
const vcmoveData = new SlashCommandBuilder()
  .setName("vcmove")
  .setDescription("➡️ Nutzer in anderen Voice-Channel verschieben")
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addUserOption(o => o.setName("nutzer").setDescription("Nutzer").setRequired(true))
  .addChannelOption(o => o.setName("ziel").setDescription("Ziel-Channel").setRequired(true));

async function executeVcmove(interaction) {
  const user   = interaction.options.getUser("nutzer");
  const target = interaction.options.getChannel("ziel");
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member?.voice?.channel) return interaction.reply({ embeds: [err("Nutzer ist in keinem Voice-Channel.")], flags: 64 });

  try {
    await member.voice.setChannel(target);
    await interaction.reply({ embeds: [ok(`${member} wurde nach **${target.name}** verschoben.`)] });
  } catch (e) {
    await interaction.reply({ embeds: [err(`Fehler: ${e.message}`)], flags: 64 });
  }
}

module.exports = {
  data: vcmuteData, execute: executeVcmute,
  vcunmute:   { data: vcunmuteData,   execute: executeVcunmute   },
  vcdeafen:   { data: vcdeafenData,   execute: executeVcdeafen   },
  vcundeafen: { data: vcundeafenData, execute: executeVcundeafen },
  vcmuteall:  { data: vcmuteallData,  execute: executeVcmuteall  },
  vcunmuteall:{ data: vcunmuteallData,execute: executeVcunmuteall},
  vckickall:  { data: vckickallData,  execute: executeVckickall  },
  vcmove:     { data: vcmoveData,     execute: executeVcmove     },
};
