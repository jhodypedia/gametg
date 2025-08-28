// routes/games.js
const express = require("express");
const router = express.Router();

async function consumeAdSession(db, token, telegram_id) {
  const [rows] = await db.query("SELECT * FROM ad_sessions WHERE token=? AND telegram_id=? LIMIT 1", [token, telegram_id]);
  if (!rows.length) return { ok:false, message: "ad session not found" };
  const s = rows[0];
  if (!s.completed_at) return { ok:false, message: "ad not completed yet" };
  if (s.used) return { ok:false, message: "ad token already used" };
  await db.query("UPDATE ad_sessions SET used=1 WHERE token=?", [token]);
  return { ok:true };
}

// get list games
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  const [rows] = await db.query("SELECT * FROM games ORDER BY created_at DESC");
  res.render("games/list", { layout: "layouts/user", games: rows });
});

// admin CRUD (for SPA admin, admin routes have own)
router.post("/api/create", async (req, res) => {
  const db = req.app.locals.db;
  const { slug, title, description, config } = req.body;
  await db.query("INSERT INTO games (slug, title, description, config) VALUES (?, ?, ?, ?)", [slug, title, description, JSON.stringify(config || {})]);
  res.json({ success: true });
});

router.post("/api/update/:id", async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { title, description, config } = req.body;
  await db.query("UPDATE games SET title=?, description=?, config=? WHERE id=?", [title, description, JSON.stringify(config || {}), id]);
  res.json({ success: true });
});

router.post("/api/delete/:id", async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  await db.query("DELETE FROM games WHERE id=?", [id]);
  res.json({ success: true });
});

// Start simple game but require ad_token consumed
router.post("/api/start-with-ad/:slug", async (req, res) => {
  const db = req.app.locals.db;
  const { slug } = req.params;
  const { telegram_id, ad_token } = req.body;
  if (!telegram_id || !ad_token) return res.status(400).json({ error: "telegram_id & ad_token required" });

  const [games] = await db.query("SELECT * FROM games WHERE slug=? LIMIT 1", [slug]);
  if (!games.length) return res.status(404).json({ error: "game not found" });

  const consumed = await consumeAdSession(db, ad_token, telegram_id);
  if (!consumed.ok) return res.status(400).json({ success:false, message: consumed.message });

  // Example: start tebak angka session (demo)
  const secret = Math.floor(Math.random()*10) + 1;
  // For demo we return secret in response (in prod store session server-side)
  res.json({ success: true, message: "Game started", game: { slug, secret } });
});

module.exports = router;
