const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

app.listen(3000, () => {
  console.log("Uptime server running");
});
// index.js — Single-file Discord.js v14 bot with XP, Levels, Leagues, Rank & Leaderboard

require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

// ====== CONFIG ======
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("Missing TOKEN, CLIENT_ID, or GUILD_ID in Replit Secrets.");
  process.exit(1);
}

// ====== LEAGUES ======
const LEAGUES = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 100 },
  { name: "Gold", min: 300 },
  { name: "Platinum", min: 600 },
  { name: "Diamond", min: 1000 },
  { name: "Master", min: 1500 },
  { name: "Grandmaster", min: 2000 }
];

// ====== DATABASE ======
const DB_FILE = "database.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "{}");
}

let db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(id) {
  if (!db[id]) {
    db[id] = { xp: 0, level: 1 };
    saveDB();
  }
  return db[id];
}

function addXP(id, amount) {
  const user = getUser(id);
  user.xp += amount;

  const needed = user.level * 100;
  if (user.xp >= needed) {
    user.level++;
  }

  saveDB();
  return user;
}

function getLeague(xp) {
  let league = LEAGUES[0].name;
  for (const l of LEAGUES) {
    if (xp >= l.min) league = l.name;
  }
  return league;
}

// ====== CLIENT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// ====== SLASH COMMANDS ======
const rankCommand = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Shows your rank, XP, level, and league"),
  async execute(interaction) {
    const user = getUser(interaction.user.id);
    const league = getLeague(user.xp);

    await interaction.reply(
      `🏅 **${interaction.user.username}'s Rank**\n` +
      `**XP:** ${user.xp}\n` +
      `**Level:** ${user.level}\n` +
      `**League:** ${league}`
    );
  }
};

const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Shows the top players"),
  async execute(interaction) {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    const sorted = Object.entries(db)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 10);

    if (sorted.length === 0) {
      return interaction.reply("No data yet. Start chatting to earn XP!");
    }

    let text = "🏆 **Leaderboard**\n\n";

    sorted.forEach(([id, data], i) => {
      text += `**${i + 1}. <@${id}>** — XP: ${data.xp}, Level: ${data.level}, League: ${getLeague(data.xp)}\n`;
    });

    await interaction.reply(text);
  }
};

// Register commands in memory
client.commands.set(rankCommand.data.name, rankCommand);
client.commands.set(leaderboardCommand.data.name, leaderboardCommand);

// ====== REGISTER SLASH COMMANDS ======
async function registerCommands() {
  const commandsJSON = [
    rankCommand.data.toJSON(),
    leaderboardCommand.data.toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandsJSON }
    );
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Error registering commands:", err);
  }
}

// ====== EVENTS ======
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      await interaction.reply("There was an error executing this command.");
    }
  }
});

client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  addXP(msg.author.id, 10);
});

// ====== START BOT ======
(async () => {
  await registerCommands();   // Register commands FIRST
  console.log("Commands registered. Logging in...");
  await client.login(TOKEN);  // THEN log in
})();