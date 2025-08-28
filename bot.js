// bot.js
const { Telegraf, Markup } = require("telegraf");
const config = require("./config");
const mysql = require("mysql2/promise");

const bot = new Telegraf(config.telegramToken);

(async () => {
  const pool = mysql.createPool(config.db);

  bot.start(async (ctx) => {
    try {
      const tg = ctx.from;
      await pool.query(
        `INSERT INTO users (telegram_id, username, name) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE username=VALUES(username), name=VALUES(name)`,
        [tg.id, tg.username || null, (tg.first_name || "") + (tg.last_name ? " " + tg.last_name : "")]
      );
      const keyboard = Markup.keyboard([
        [Markup.button.webApp("🎮 Main Game", config.webappUrl)],
        [Markup.button.webApp("🎁 Dashboard", config.webappUrl)]
      ]).resize();

      await ctx.reply("Selamat datang! Klik tombol untuk membuka game & dashboard.", keyboard);
    } catch (e) {
      console.error("bot.start error:", e);
      ctx.reply("Terjadi error server.");
    }
  });

  bot.command("myid", (ctx) => ctx.reply(`ID: ${ctx.from.id}`));

  await bot.launch();
  console.log("Telegram bot started");
})();
