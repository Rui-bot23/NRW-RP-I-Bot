const {
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");

const once = false;

async function execute(member, client) {
  try {
    const cfg = await getGuildConfig(member.guild.id);

    if (!cfg.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (!channel) return;

    const nickname = member.displayName || member.user.username;

    // Build channel mention helpers
    const ch = (id) => id ? `<#${id}>` : "`(nicht gesetzt)`";

    // Build the message using Components V2 (matching your JSON structure)
    // Discord.js v14 supports this via flags: IsComponentsV2
    const content = [
      `# Willkommen hier auf NRW:RP I German`,
      ``,
      `Schön, dass du da bist **${nickname}**! Bitte lies dir diese Infos aufmerksam durch, damit du weißt, wie es weitergeht:`,
      `1. Lies dir unsere ${ch(cfg.welcomeRulesChannel)} durch.`,
      `2. Hole dir dann eine Rolle in ${ch(cfg.welcomeRolesChannel)}, für Pings.`,
      `3. Bei Fragen kannst du dann ein Ticket im ${ch(cfg.welcomeTicketChannel)} Channel öffnen.`,
      `4. Fraktionen kannst du in unserem ${ch(cfg.welcomeFraktionChannel)} Channel finden.`,
      `5. Bei Interesse kannst du dich auch gerne im Staff Team bewerben!`,
    ].join("\n");

    const footer = `-# Bitte halte dich an unsere Server Regeln und viel Spaß im RP!\n-# NRW:RP I German`;

    // Use Components V2 if banner is set, otherwise fall back to a clean embed
    if (cfg.welcomeBannerUrl) {
      // Components V2 layout matching your JSON exactly
      await channel.send({
        content: `${member}`,
        flags: 32768, // IS_COMPONENTS_V2
        components: [
          {
            type: 17, // Container
            components: [
              {
                type: 12, // MediaGallery
                items: [{ media: { url: cfg.welcomeBannerUrl } }],
              },
              {
                type: 10, // TextDisplay
                content: `# Willkommen hier auf NRW:RP I German`,
              },
              { type: 14 }, // Separator
              {
                type: 10,
                content: [
                  `Schön, dass du da bist **${nickname}**! Bitte lies dir diese Infos aufmerksam durch, damit du weißt, wie es weitergeht:`,
                  `1. Lies dir unsere ${ch(cfg.welcomeRulesChannel)} durch.`,
                  `2. Hole dir dann eine Rolle in ${ch(cfg.welcomeRolesChannel)}, für Pings.`,
                  `3. Bei Fragen kannst du dann ein Ticket im ${ch(cfg.welcomeTicketChannel)} Channel öffnen.`,
                  `4. Fraktionen kannst du in unserem ${ch(cfg.welcomeFraktionChannel)} Channel finden.`,
                  `5. Bei Interesse kannst du dich auch gerne im Staff Team bewerben!`,
                ].join("\n"),
              },
              { type: 14 },
              {
                type: 10,
                content: `-# Bitte halte dich an unsere Server Regeln und viel Spaß im RP!\n-# NRW:RP I German`,
              },
              { type: 14 },
            ],
          },
        ],
      });
    } else {
      // Clean embed fallback (no banner set yet)
      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle("Willkommen hier auf NRW:RP I German")
        .setDescription(content + "\n\n" + footer)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await channel.send({ content: `${member}`, embeds: [embed] });
    }
  } catch (err) {
    console.error("[WELCOME]", err.message);
  }
}

module.exports = { once, execute };
