/**
 * /emoji — Manage custom emojis for the bot
 *
 * /emoji upload   — Upload all bundled emojis to this server
 * /emoji list     — Show all registered emojis and their status
 * /emoji set      — Assign a server emoji to a bot slot by name
 * /emoji reset    — Clear all stored emoji IDs (forces re-upload)
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { ensureEmojis, getEmojis, BUNDLED_EMOJIS, fallbackEmoji } = require("../../utils/emojiManager");
const { GuildConfig } = require("../../models");

const data = new SlashCommandBuilder()
  .setName("emoji")
  .setDescription("Emojis für den Bot verwalten")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  .addSubcommand(sub =>
    sub.setName("upload")
      .setDescription("Alle mitgelieferten Emojis auf diesen Server hochladen")
  )
  .addSubcommand(sub =>
    sub.setName("list")
      .setDescription("Alle Bot-Emojis und ihren Status anzeigen")
  )
  .addSubcommand(sub =>
    sub.setName("set")
      .setDescription("Einen Server-Emoji einem Bot-Slot zuweisen")
      .addStringOption(o =>
        o.setName("slot").setDescription("Bot-Emoji-Slot (z.B. staff, ticket, ok, error...)").setRequired(true)
          .addChoices(...Object.keys(BUNDLED_EMOJIS).map(k => ({ name: k, value: k })))
      )
      .addStringOption(o =>
        o.setName("emoji").setDescription("Emoji-ID oder Name des Server-Emojis").setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName("reset")
      .setDescription("Alle gespeicherten Emoji-IDs löschen (erzwingt erneutes Hochladen)")
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();

  try {
    if (sub === "upload") return await handleUpload(interaction);
    if (sub === "list")   return await handleList(interaction);
    if (sub === "set")    return await handleSet(interaction);
    if (sub === "reset")  return await handleReset(interaction);
  } catch (err) {
    console.error("[EMOJI CMD]", err);
    return interaction.editReply({ content: `❌ Fehler: ${err.message}` });
  }
}

async function handleUpload(interaction) {
  await interaction.editReply({ content: "⏳ Emojis werden hochgeladen... (kann einige Sekunden dauern)" });

  const results = await ensureEmojis(interaction.guild);
  const lines   = Object.entries(results).map(([name, str]) => `${str} \`${name}\``);

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle("✅  Emojis hochgeladen")
    .setDescription(lines.join("  ·  ") || "*Keine Emojis hochgeladen*")
    .setFooter({ text: `${Object.keys(results).length} Emojis • Nutze /emoji list für Details` })
    .setTimestamp();

  return interaction.editReply({ content: "", embeds: [embed] });
}

async function handleList(interaction) {
  const emojis = await getEmojis(interaction.guild);
  const cfg    = await GuildConfig.findOne({ guildId: interaction.guild.id });
  const stored = cfg?.customEmojis || {};

  const lines = Object.keys(BUNDLED_EMOJIS).map(name => {
    const emojiStr = emojis[name];
    const isUploaded = stored[name] && interaction.guild.emojis.cache.get(stored[name]);
    const status = isUploaded ? "✅" : "⚠️";
    return `${status} ${emojiStr} \`${name}\``;
  });

  const uploaded = Object.values(stored).filter(id => interaction.guild.emojis.cache.get(id)).length;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🎨  Bot Emojis")
    .setDescription(lines.join("\n"))
    .addFields({ name: "Status", value: `**${uploaded}/${Object.keys(BUNDLED_EMOJIS).length}** Emojis hochgeladen\n✅ = aktiv · ⚠️ = Fallback (Unicode)` })
    .setFooter({ text: "Nutze /emoji upload um fehlende hochzuladen" })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleSet(interaction) {
  const slot     = interaction.options.getString("slot");
  const emojiInput = interaction.options.getString("emoji").trim();

  // Try to find emoji by ID or name
  let emoji = interaction.guild.emojis.cache.get(emojiInput)
    || interaction.guild.emojis.cache.find(e => e.name === emojiInput);

  if (!emoji) {
    // Try parsing <:name:id> format
    const match = emojiInput.match(/<a?:(\w+):(\d+)>/);
    if (match) {
      emoji = interaction.guild.emojis.cache.get(match[2]);
    }
  }

  if (!emoji) {
    return interaction.editReply({ content: `❌ Emoji nicht gefunden. Gib die Emoji-ID, den Namen oder den vollen Emoji-String an.` });
  }

  await GuildConfig.findOneAndUpdate(
    { guildId: interaction.guild.id },
    { $set: { [`customEmojis.${slot}`]: emoji.id } },
    { upsert: true }
  );

  return interaction.editReply({
    content: `✅ Slot \`${slot}\` wurde auf <:${emoji.name}:${emoji.id}> gesetzt.`,
  });
}

async function handleReset(interaction) {
  await GuildConfig.findOneAndUpdate(
    { guildId: interaction.guild.id },
    { $set: { customEmojis: {} } },
    { upsert: true }
  );
  return interaction.editReply({
    content: "✅ Alle Emoji-IDs wurden gelöscht. Benutze `/emoji upload` um sie neu hochzuladen.",
  });
}

module.exports = { data, execute };
