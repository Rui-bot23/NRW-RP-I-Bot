const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder, UnfurledMediaItemBuilder,
  MessageFlags,
} = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");
const { getEmojis } = require("../utils/emojiManager");

const once = false;

async function execute(member, client) {
  try {
    const cfg = await getGuildConfig(member.guild.id);
    if (!cfg.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (!channel) return;

    const emojis = await getEmojis(member.guild, cfg);
    const nick   = member.displayName || member.user.username;
    const ch     = (id) => id ? `<#${id}>` : "`(nicht gesetzt)`";

    const eWelcome  = emojis.welcome  || emojis.member  || "👤";
    const eVerified = emojis.verified || "✅";
    const eMember   = emojis.member   || "👤";
    const eTicket   = emojis.ticket   || "🎫";
    const eStaff    = emojis.staff    || "⭐";
    const eInfo     = emojis.info     || "ℹ️";

    // ── Always use Components V2 — banner is optional ─────────────────────────
    const container = new ContainerBuilder();

    // Ping
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`<@${member.id}>`)
    );

    // Banner — only if set
    if (cfg.welcomeBannerUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder()
            .setMedia(new UnfurledMediaItemBuilder().setURL(cfg.welcomeBannerUrl))
        )
      );
    }

    // Title
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ${eWelcome} Willkommen hier auf NRW:RP I German`
      )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    // Main content
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `Schön, dass du da bist **${nick}**! Bitte lies dir diese Infos aufmerksam durch:`,
          ``,
          `${eVerified} Lies dir unsere ${ch(cfg.welcomeRulesChannel)} durch.`,
          `${eMember} Hole dir eine Rolle in ${ch(cfg.welcomeRolesChannel)} für Pings.`,
          `${eTicket} Bei Fragen öffne ein Ticket in ${ch(cfg.welcomeTicketChannel)}.`,
          `${eStaff} Fraktionen findest du in ${ch(cfg.welcomeFraktionChannel)}.`,
          `${eInfo} Bei Interesse kannst du dich auch im Staff Team bewerben!`,
        ].join("\n")
      )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    // Footer
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Bitte halte dich an unsere Regeln und viel Spaß im RP!\n-# NRW:RP I German`
      )
    );

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { users: [member.id] },
    });

  } catch (err) {
    console.error("[WELCOME]", err);
  }
}

module.exports = { once, execute };
