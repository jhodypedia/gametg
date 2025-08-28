// app.js
const express = require("express");
const path = require("path");
const session = require("express-session");
const ejsLayouts = require("express-ejs-layouts");
const helmet = require("helmet");
const mysql = require("mysql2/promise");
const config = require("./config");

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.use(ejsLayouts);
app.set("layout", "layouts/main");

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true in prod with HTTPS
}));

// DB pool
const pool = mysql.createPool(config.db);
app.locals.db = pool;

// routes
app.use("/", require("./routes/user"));
app.use("/games", require("./routes/games"));
app.use("/_adm", require("./routes/admin"));

// start bot
require("./bot");

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
