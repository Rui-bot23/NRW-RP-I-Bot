const { model, Schema } = require("mongoose");

// Stores all per-guild settings configured via slash commands
const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },

  // Welcome — customizable text
  welcomeTitle:    { type: String, default: "Willkommen hier auf NRW:RP I German" },
  welcomeIntro:    { type: String, default: "Schön, dass du da bist **{nick}**! Bitte lies dir diese Infos aufmerksam durch:" },
  welcomeLine1:    { type: String, default: "Lies dir unser {rules} durch." },
  welcomeLine2:    { type: String, default: "Hole dir eine Rolle in {roles} für Pings." },
  welcomeLine3:    { type: String, default: "Bei Fragen öffne ein Ticket in {ticket}." },
  welcomeLine4:    { type: String, default: "Fraktionen findest du in {fraktionen}." },
  welcomeLine5:    { type: String, default: "Bei Interesse kannst du dich auch im Staff Team bewerben!" },
  welcomeFooter:   { type: String, default: "Bitte halte dich an unsere Regeln und viel Spaß im RP!\n-# NRW:RP I German" },

  // RP messages — customizable text
  rpStartTitle:   { type: String, default: "Roleplay Start" },
  rpStartText:    { type: String, default: "Der Server ist ab jetzt moderiert und das Roleplay ist eröffnet.\n\nDanke, dass du ein Teil der Community bist!\nViel Spaß beim Spielen! 🎮" },
  rpStopTitle:    { type: String, default: "Roleplay Stop" },
  rpStopText:     { type: String, default: "Der Server ist nicht mehr moderiert und das Roleplay ist beendet.\n\nDanke, dass du dabei warst!\nBis zum nächsten Mal! 👋" },

  // Welcome
  welcomeChannelId:   { type: String, default: null },  // channel to send welcome message
  welcomeBannerUrl:   { type: String, default: null },  // attachment or image URL for banner
  welcomeRulesChannel:     { type: String, default: null },  // #regeln channel mention
  welcomeRolesChannel:     { type: String, default: null },  // #rollen channel mention
  welcomeTicketChannel:    { type: String, default: null },  // #ticket channel mention
  welcomeFraktionChannel:  { type: String, default: null },  // #fraktionen channel mention

  // AutoMod
  automod: {
    antilinkEnabled:    { type: Boolean, default: false },
    antilinkAction:     { type: String,  default: "delete" },
    antispamEnabled:    { type: Boolean, default: false },
    antispamLimit:      { type: Number,  default: 5 },
    antibadwordsEnabled:{ type: Boolean, default: false },
    blacklist:          { type: [String], default: [] },
    ignoreList:         { type: [String], default: [] },
  },

  // Logging
  logging: {
    enabled:           { type: Boolean, default: false },
    messageDelete:     { type: String,  default: null },
    messageEdit:       { type: String,  default: null },
    memberJoin:        { type: String,  default: null },
    memberLeave:       { type: String,  default: null },
    memberBan:         { type: String,  default: null },
    memberUpdate:      { type: String,  default: null },
    roleCreate:        { type: String,  default: null },
    roleDelete:        { type: String,  default: null },
    channelCreate:     { type: String,  default: null },
    channelDelete:     { type: String,  default: null },
    voiceUpdate:       { type: String,  default: null },
  },

  // Moderation
  modLogChannelId: { type: String, default: null },
  warnings: { type: Map, of: Array, default: {} },

  // Tickets
  ticketLogChannelId:   { type: String, default: null },
  ticketCategoryId:     { type: String, default: null },
  ticketSupportRoleIds: { type: [String], default: [] },
  ticketMaxPerUser:     { type: Number, default: 1 },
  ticketDmTranscript:   { type: Boolean, default: true },
  ticketCloseDelay:     { type: Number, default: 5 },

  // RP — persistent message
  rpMessageId:        { type: String, default: null },  // ID of the message to edit
  rpState:            { type: String, default: 'inactive' }, // 'active' | 'inactive'

  // Custom emoji slots — set via /setup emojis
  customEmojis: { type: Map, of: String, default: {} },
  emojiWelcome:  { type: String, default: null },  // shown in welcome header
  emojiTicket:   { type: String, default: null },  // ticket panel + intro
  emojiStaff:    { type: String, default: null },  // staff ping line
  emojiMember:   { type: String, default: null },  // member/user line
  emojiVerified: { type: String, default: null },  // rules line
  emojiInfo:     { type: String, default: null },  // info line
  emojiOk:       { type: String, default: null },  // success / rp start
  emojiError:    { type: String, default: null },  // error / rp stop
  emojiWarning:  { type: String, default: null },  // warning / priority
  emojiRpStart:  { type: String, default: null },  // rp start header
  emojiRpStop:   { type: String, default: null },  // rp stop header

  // RP Start/Stop
  rpChannelId:        { type: String, default: null },  // channel to post rp start/stop
  rpAllowedRoleId:    { type: String, default: null },  // role allowed to trigger start/stop
  rpPingRoleId:       { type: String, default: null },  // role to ping on start/stop
});

const GuildConfig = model("NRWGuildConfig", guildConfigSchema);

const { model: m2, Schema: S2 } = require("mongoose");

const ticketCategorySchema = new S2({
  guildId:     { type: String, required: true },
  categoryId:  { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  description: { type: String, default: "Öffne ein Support-Ticket" },
  emoji:       { type: String, default: "🎫" },
  prefix:      { type: String, required: true },
  teamPingId:  { type: String, default: null },
  createdAt:   { type: Number, default: () => Date.now() },
});

const ticketSchema = new S2({
  ticketId:    { type: String, required: true, unique: true },
  channelId:   { type: String, required: true },
  guildId:     { type: String, required: true },
  ownerId:     { type: String, required: true },
  ownerTag:    { type: String, required: true },
  category:    { type: String, default: "Support" },
  subject:     { type: String, default: "" },
  description: { type: String, default: "" },
  status:      { type: String, default: "open" },
  claimedBy:   { type: String, default: null },
  priority:    { type: String, default: "Normal" },
  createdAt:   { type: Number, default: () => Date.now() },
  closedAt:    { type: Number, default: null },
});

const TicketCategory = m2("NRWTicketCategory", ticketCategorySchema);
const Ticket         = m2("NRWTicket",         ticketSchema);

module.exports = { GuildConfig, TicketCategory, Ticket };
