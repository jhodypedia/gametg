// routes/admin.js
const express = require("express");
const bcrypt = require("bcrypt");
const monitor = require("../utils/monitor");
const router = express.Router();

// render login
router.get("/login", (req, res) => res.render("admin/login", { layout: "layouts/admin", error: null }));

// login using settings.admin_credentials
router.post("/login", async (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body;
  const [rows] = await db.query("SELECT value FROM settings WHERE name='admin_credentials' LIMIT 1");
  if (!rows.length) return res.render("admin/login", { layout: "layouts/admin", error: "Admin credentials not set" });
  let creds;
  try { creds = JSON.parse(rows[0].value); } catch (e) { return res.render("admin/login", { layout: "layouts/admin", error: "Invalid admin credentials" }); }
  const ok = await bcrypt.compare(password, creds.password);
  if (ok && creds.username === username) {
    req.session.admin = { username };
    return res.redirect("/_adm/dashboard");
  }
  res.render("admin/login", { layout: "layouts/admin", error: "Login failed" });
});

// dashboard
router.get("/dashboard", async (req, res) => {
  if (!req.session.admin) return res.redirect("/_adm/login");
  res.render("admin/dashboard", { layout: "layouts/admin", admin: req.session.admin });
});

// API: stats (for admin SPA)
router.get("/api/stats", async (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: "Unauthorized" });
  const db = req.app.locals.db;
  const [[{ revenue = 0 }]] = await db.query("SELECT IFNULL(SUM(amount),0) as revenue FROM finance WHERE type='revenue'").catch(()=>[[{revenue:0}]]);
  const [[{ expense = 0 }]] = await db.query("SELECT IFNULL(SUM(amount),0) as expense FROM finance WHERE type='expense'").catch(()=>[[{expense:0}]]);
  const [users] = await db.query("SELECT id, telegram_id, name, email, points, role, banned, created_at FROM users ORDER BY points DESC LIMIT 1000");
  const [withdraws] = await db.query("SELECT w.*, u.telegram_id, u.name, u.email FROM withdraws w JOIN users u ON w.user_id=u.id ORDER BY w.created_at DESC LIMIT 200");
  const [games] = await db.query("SELECT * FROM games ORDER BY created_at DESC");
  const [adViews] = await db.query("SELECT DATE(viewed_at) as day, COUNT(*) as cnt FROM ad_views GROUP BY DATE(viewed_at) ORDER BY day DESC LIMIT 30");
  res.json({ revenue, expense, users, withdraws, games, adViews });
});

// USERS CRUD API
router.post("/api/users/ban/:id", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const id = req.params.id;
  await db.query("UPDATE users SET banned=1 WHERE id=?", [id]);
  await db.query("INSERT INTO logs (level, message, meta) VALUES ('audit', ?, ?)", ['user_banned', JSON.stringify({id})]);
  res.json({ success:true });
});
router.post("/api/users/unban/:id", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const id = req.params.id;
  await db.query("UPDATE users SET banned=0 WHERE id=?", [id]);
  res.json({ success:true });
});
router.post("/api/users/delete/:id", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const id = req.params.id;
  await db.query("DELETE FROM users WHERE id=?", [id]);
  await db.query("INSERT INTO logs (level, message, meta) VALUES ('audit', ?, ?)", ['user_deleted', JSON.stringify({id})]);
  res.json({ success:true });
});
router.post("/api/users/update/:id", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const id = req.params.id;
  const { name, email, role } = req.body;
  await db.query("UPDATE users SET name=?, email=?, role=? WHERE id=?", [name, email, role, id]);
  res.json({ success:true });
});

// GAMES CRUD (admin)
router.post("/api/games/create", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const { slug, title, description, config } = req.body;
  await db.query("INSERT INTO games (slug, title, description, config) VALUES (?, ?, ?, ?)", [slug, title, description, JSON.stringify(config||{})]);
  res.json({ success:true });
});
router.post("/api/games/update/:id", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const { id } = req.params;
  const { title, description, config } = req.body;
  await db.query("UPDATE games SET title=?, description=?, config=? WHERE id=?", [title, description, JSON.stringify(config||{}), id]);
  res.json({ success:true });
});
router.post("/api/games/delete/:id", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const { id } = req.params;
  await db.query("DELETE FROM games WHERE id=?", [id]);
  res.json({ success:true });
});

// WITHDRAW MANAGEMENT
router.post("/api/withdraw/:id/approve", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const id = req.params.id;
  await db.query("UPDATE withdraws SET status='approved' WHERE id=?", [id]);
  await db.query("INSERT INTO logs (level, message, meta) VALUES ('audit', ?, ?)", ['withdraw_approved', JSON.stringify({id})]);
  res.json({ success:true });
});
router.post("/api/withdraw/:id/reject", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const id = req.params.id;
  // optionally refund points to user
  const [[r]] = await db.query("SELECT * FROM withdraws WHERE id=? LIMIT 1", [id]);
  if (r) {
    await db.query("UPDATE withdraws SET status='rejected' WHERE id=?", [id]);
    // refund
    await db.query("UPDATE users SET points = points + ? WHERE id=?", [r.amount, r.user_id]);
    await db.query("INSERT INTO logs (level, message, meta) VALUES ('audit', ?, ?)", ['withdraw_rejected_and_refunded', JSON.stringify({id, amount:r.amount})]);
  }
  res.json({ success:true });
});

// SETTINGS (superadmin)
router.post("/api/settings", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const adminName = req.session.admin.username;
  if (adminName !== 'superadmin') return res.status(403).json({error:'Only superadmin'});
  const db = req.app.locals.db;
  const { key, value } = req.body;
  await db.query("INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value=?", [key, value, value]);
  res.json({ success:true });
});

// API KEYS management (superadmin)
router.post("/api/apikeys/create", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  if (req.session.admin.username !== 'superadmin') return res.status(403).json({error:'Only superadmin'});
  const db = req.app.locals.db;
  const { name, key_value, description } = req.body;
  await db.query("INSERT INTO api_keys (name, key_value, description) VALUES (?, ?, ?)", [name, key_value, description]);
  res.json({ success:true });
});
router.post("/api/apikeys/delete/:id", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  if (req.session.admin.username !== 'superadmin') return res.status(403).json({error:'Only superadmin'});
  const db = req.app.locals.db;
  await db.query("DELETE FROM api_keys WHERE id=?", [req.params.id]);
  res.json({ success:true });
});

// LOGS view (admin)
router.get("/api/logs", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  const db = req.app.locals.db;
  const [rows] = await db.query("SELECT * FROM logs ORDER BY created_at DESC LIMIT 500");
  res.json({ logs: rows });
});

// SYSTEM MONITOR
router.get("/api/monitor", async (req,res) => {
  if (!req.session.admin) return res.status(403).json({error:'Unauthorized'});
  try {
    const data = await monitor(); // returns cpu, mem, uptime, load etc
    res.json({ ok:true, data });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

module.exports = router;
