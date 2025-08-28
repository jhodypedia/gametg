// init-superadmin.js
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const config = require("./config");

(async () => {
  const pool = mysql.createPool(config.db);
  const username = "Jhody";
  const passwordPlain = "Arsleg32"; // CHANGE BEFORE RUN
  const hashed = await bcrypt.hash(passwordPlain, 10);

  // upsert superadmin user record
  await pool.query("INSERT INTO users (telegram_id, username, name, email, points, role) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), name=VALUES(name), role=VALUES(role)",
    [0, username, username, "pansastore86@gmail.com", 0, "superadmin"]);

  // store admin credentials in settings
  await pool.query("INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value=?", [
    "admin_credentials",
    JSON.stringify({ username, password: hashed }),
    JSON.stringify({ username, password: hashed })
  ]);

  console.log("Superadmin created. Username:", username, "Password (plain):", passwordPlain);
  process.exit(0);
})();
