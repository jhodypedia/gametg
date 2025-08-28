// config.js
module.exports = {
  port: process.env.PORT || 3000,
  webappUrl: process.env.WEBAPP_URL || "https://pansa.my.id",
  telegramToken: process.env.TELEGRAM_TOKEN || "7112423841:AAFYvgn-ksNi8hZ_qWNDP3FgIwIll9jRqH4",
  adsterraSecret: process.env.ADSTER_SECRET || "REPLACE_WITH_ADSTERRA_POSTBACK_SECRET",
  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "Arsleg32@",
    database: process.env.DB_NAME || "tg_game",
    waitForConnections: true,
    connectionLimit: 12,
    queueLimit: 0
  },
  sessionSecret: process.env.SESSION_SECRET || "replace_with_strong_secret",
  adminTelegramId: Number(process.env.ADMIN_TELEGRAM_ID || 5983722113)
};
