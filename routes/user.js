// routes/user.js
const express = require("express");
const crypto = require("crypto");
const config = require("../config");
const router = express.Router();

function genToken() {
  return crypto.randomBytes(20).toString("hex");
}

// render WebApp (EJS inject ads script)
router.get("/webapp", async (req, res) => {
  const db = req.app.locals.db;
  const [[adsRow]] = await db.query("SELECT value FROM settings WHERE name='ads_script' LIMIT 1").catch(()=>[[]]);
  const adsScript = adsRow ? adsRow.value : "<!-- ads not configured -->";
  res.render("user/dashboard", { layout: "layouts/user", adsScript });
});

// upsert/fetch user after client sends init data
router.post("/api/user-info", async (req, res) => {
  const db = req.app.locals.db;
  const { telegram_id, username, name } = req.body;
  if (!telegram_id) return res.status(400).json({ error: "telegram_id required" });
  const [rows] = await db.query("SELECT * FROM users WHERE telegram_id=?", [telegram_id]);
  if (!rows.length) {
    const [ins] = await db.query("INSERT INTO users (telegram_id, username, name) VALUES (?, ?, ?)", [telegram_id, username || null, name || null]);
    const [newRow] = await db.query("SELECT * FROM users WHERE id=?", [ins.insertId]);
    return res.json({ user: newRow[0] });
  }
  res.json({ user: rows[0] });
});

// SAVE EMAIL
router.post("/api/save-email", async (req, res) => {
  const db = req.app.locals.db;
  const { telegram_id, email } = req.body;
  if (!telegram_id || !email) return res.status(400).json({ error: "telegram_id & email required" });
  await db.query("UPDATE users SET email=? WHERE telegram_id=?", [email, telegram_id]);
  res.json({ success: true });
});

// REQUEST AD TOKEN (for client to show ad with ad_token custom param)
router.post("/api/request-ad", async (req, res) => {
  const db = req.app.locals.db;
  const { telegram_id } = req.body;
  if (!telegram_id) return res.status(400).json({ error: "telegram_id required" });

  // ensure user exists
  const [users] = await db.query("SELECT * FROM users WHERE telegram_id=?", [telegram_id]);
  if (!users.length) await db.query("INSERT INTO users (telegram_id) VALUES (?)", [telegram_id]);

  const token = genToken();
  await db.query("INSERT INTO ad_sessions (token, telegram_id) VALUES (?, ?)", [token, telegram_id]);
  res.json({ token, expires_in: 300 });
});

// ADSTERRA POSTBACK (server-to-server)
router.post("/api/adsterra-postback", async (req, res) => {
  const db = req.app.locals.db;
  const { ad_token, secret } = req.body;
  if (!ad_token || !secret) return res.status(400).send("bad request");
  if (secret !== config.adsterraSecret) return res.status(403).send("forbidden");

  const [rows] = await db.query("SELECT * FROM ad_sessions WHERE token=? LIMIT 1", [ad_token]);
  if (!rows.length) return res.status(404).send("token not found");
  const sess = rows[0];
  if (sess.completed_at) return res.status(200).send("already completed");

  // mark completed
  await db.query("UPDATE ad_sessions SET completed_at=NOW() WHERE token=?", [ad_token]);

  // credit points server-side (if daily limit not exceeded)
  const [userRows] = await db.query("SELECT * FROM users WHERE telegram_id=? LIMIT 1", [sess.telegram_id]);
  if (userRows.length) {
    const user = userRows[0];
    const [[{count}]] = await db.query("SELECT COUNT(*) as count FROM ad_views WHERE user_id=? AND DATE(viewed_at)=CURDATE()", [user.id]);
    const DAILY_LIMIT = 5;
    if (count < DAILY_LIMIT) {
      const reward = 100;
      await db.query("UPDATE users SET points = points + ? WHERE id=?", [reward, user.id]);
      await db.query("INSERT INTO ad_views (user_id) VALUES (?)", [user.id]);
      await db.query("INSERT INTO logs (level, message, meta) VALUES ('audit', ?, ?)", [`ad_reward_credited to ${user.telegram_id}`, JSON.stringify({ ad_token, reward })]);
      console.log(`Credited ${reward} points to ${user.telegram_id}`);
    } else {
      console.log("Daily ad limit reached, not crediting");
    }
  }

  res.status(200).send("OK");
});

// helper to consume ad_session
async function consumeAdSession(db, token, telegram_id) {
  const [rows] = await db.query("SELECT * FROM ad_sessions WHERE token=? AND telegram_id=? LIMIT 1", [token, telegram_id]);
  if (!rows.length) return { ok:false, message: "ad session not found" };
  const s = rows[0];
  if (!s.completed_at) return { ok:false, message: "ad not completed yet" };
  if (s.used) return { ok:false, message: "ad token already used" };
  await db.query("UPDATE ad_sessions SET used=1 WHERE token=?", [token]);
  return { ok:true };
}

// CHECKIN that requires ad (client gives ad_token after postback)
router.post("/api/checkin-with-ad", async (req, res) => {
  const db = req.app.locals.db;
  const { telegram_id, ad_token } = req.body;
  if (!telegram_id || !ad_token) return res.status(400).json({ error: "telegram_id & ad_token required" });

  const [users] = await db.query("SELECT * FROM users WHERE telegram_id=?", [telegram_id]);
  if (!users.length) return res.status(404).json({ error: "user not found" });
  const user = users[0];

  const consumed = await consumeAdSession(db, ad_token, telegram_id);
  if (!consumed.ok) return res.status(400).json({ success:false, message: consumed.message });

  const [[last]] = await db.query("SELECT * FROM checkins WHERE user_id=? ORDER BY checkin_at DESC LIMIT 1", [user.id]);
  const today = new Date().toISOString().split("T")[0];
  if (last && last.checkin_at && last.checkin_at.toISOString().split("T")[0] === today) {
    return res.json({ success:false, message: "Already checked-in today" });
  }

  const points = 50;
  await db.query("UPDATE users SET points = points + ? WHERE id=?", [points, user.id]);
  await db.query("INSERT INTO checkins (user_id) VALUES (?)", [user.id]);
  res.json({ success:true, message: `Check-in sukses! +${points} poin` });
});

// watch ad: client should call request-ad -> show ad -> wait for postback -> claim via ad_token (if you want additional endpoint)
router.post("/api/claim-ad", async (req, res) => {
  // in our flow, Adsterra postback already credited, so this endpoint can be used to confirm or to consume session for actions
  res.json({ success: true, message: "Use adsterra postback flow; this endpoint is optional." });
});

// withdraw (no ad required)
router.post("/api/withdraw", async (req, res) => {
  const db = req.app.locals.db;
  const { telegram_id, amount, method, account } = req.body;
  if (!telegram_id || !amount || !method || !account) return res.status(400).json({ error: "telegram_id, amount, method, account required" });

  const [rows] = await db.query("SELECT * FROM users WHERE telegram_id=?", [telegram_id]);
  if (!rows.length) return res.status(404).json({ error: "user not found" });
  const user = rows[0];

  if (user.points < amount) return res.json({ success: false, message: "Insufficient points" });

  await db.query("INSERT INTO withdraws (user_id, amount, method, account) VALUES (?, ?, ?, ?)", [user.id, amount, method, account]);
  await db.query("UPDATE users SET points = points - ? WHERE id=?", [amount, user.id]);
  await db.query("INSERT INTO logs (level, message, meta) VALUES ('audit', ?, ?)", ['withdraw_requested', JSON.stringify({ user_id: user.id, amount, method, account })]);

  res.json({ success: true, message: "Withdraw request created" });
});

module.exports = router;
