const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder, UnfurledMediaItemBuilder,
  MessageFlags,
} = require("discord.js");
const { getGuildConfig } = require("../utils/guildConfig");
const { getEmojis } = require("../utils/emojiManager");

const once = false;

// Replace {placeholders} in text
function fill(text, vars) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), text || "");
}

async function execute(member, client) {
  try {
    const cfg = await getGuildConfig(member.guild.id);
    // Module check
    if (cfg.modules?.welcome === false) return;
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

    // Placeholder variables
    const vars = {
      nick,
      rules:      ch(cfg.welcomeRulesChannel),
      roles:      ch(cfg.welcomeRolesChannel),
      ticket:     ch(cfg.welcomeTicketChannel),
      fraktionen: ch(cfg.welcomeFraktionChannel),
    };

    // Build lines with emoji prefixes
    const lines = [
      { emoji: eVerified, text: cfg.welcomeLine1 || "Lies dir unser {rules} durch." },
      { emoji: eMember,   text: cfg.welcomeLine2 || "Hole dir eine Rolle in {roles} für Pings." },
      { emoji: eTicket,   text: cfg.welcomeLine3 || "Bei Fragen öffne ein Ticket in {ticket}." },
      { emoji: eStaff,    text: cfg.welcomeLine4 || "Fraktionen findest du in {fraktionen}." },
      { emoji: eInfo,     text: cfg.welcomeLine5 || "Bei Interesse kannst du dich auch im Staff Team bewerben!" },
    ];

    const mainText = [
      fill(cfg.welcomeIntro || "Schön, dass du da bist **{nick}**! Bitte lies dir diese Infos aufmerksam durch:", vars),
      "",
      ...lines.flatMap(l => [fill(`${l.emoji} ${l.text}`, vars), ""]),
    ].join("\n").trimEnd();

    const footer = `-# ${fill(cfg.welcomeFooter || "Bitte halte dich an unsere Regeln und viel Spaß im RP!\n-# NRW:RP I German", vars)}`;
    const title  = fill(cfg.welcomeTitle || "Willkommen hier auf NRW:RP I German", vars);

    const container = new ContainerBuilder();

    // Ping
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`<@${member.id}>`)
    );

    // Banner (optional)
    if (cfg.welcomeBannerUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder()
            .setMedia(new UnfurledMediaItemBuilder().setURL(cfg.welcomeBannerUrl))
        )
      );
    }

    container
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${eWelcome} ${title}`))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(mainText))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { users: [member.id] },
    });

  } catch (err) {
    console.error("[WELCOME]", err);
  }
}

module.exports = { once, execute, fill };
