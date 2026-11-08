const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random value with at least 32 characters.");
  process.exit(1);
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters) in .env.");
  process.exit(1);
}

const db = new Database(path.join(dataDir, "nexora.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    banned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const countAdmins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n;
if (!countAdmins) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?, 'admin')")
    .run(process.env.ADMIN_USERNAME.trim(), hash);
  console.log("Initial admin account created.");
}

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

function safeUser(user) {
  return { id: user.id, username: user.username, role: user.role, banned: !!user.banned };
}
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Bitte zuerst einloggen." });
  const user = db.prepare("SELECT id, username, role, banned FROM users WHERE id=?").get(req.session.userId);
  if (!user || user.banned) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Dieses Konto ist nicht verfügbar." });
  }
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Nur für Admins." });
  next();
}
function requireCsrf(req, res, next) {
  const token = req.get("x-csrf-token");
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden." });
  }
  next();
}
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.path.startsWith("/auth/login") && !req.path.startsWith("/auth/register")) {
    return requireAuth(req, res, () => requireCsrf(req, res, next));
  }
  next();
});

app.get("/api/config", (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require("crypto").randomBytes(32).toString("hex");
  }
  res.json({ csrfToken: req.session.csrfToken });
});

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(username)) {
    return res.status(400).json({ error: "Benutzername: 3–24 Zeichen, nur Buchstaben, Zahlen, _ und -." });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: "Das Passwort muss mindestens 12 Zeichen lang sein." });
  }
  if (db.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").get(username)) {
    return res.status(409).json({ error: "Dieser Benutzername ist bereits vergeben." });
  }
  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(username, hash);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Registrierung fehlgeschlagen." });
    req.session.userId = result.lastInsertRowid;
    req.session.csrfToken = require("crypto").randomBytes(32).toString("hex");
    const user = db.prepare("SELECT id,username,role,banned FROM users WHERE id=?").get(result.lastInsertRowid);
    res.json({ user: safeUser(user), csrfToken: req.session.csrfToken });
  });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Benutzername oder Passwort stimmt nicht." });
  }
  if (user.banned) return res.status(403).json({ error: "Dieses Konto wurde gesperrt." });
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Anmeldung fehlgeschlagen." });
    req.session.userId = user.id;
    req.session.csrfToken = require("crypto").randomBytes(32).toString("hex");
    res.json({ user: safeUser(user), csrfToken: req.session.csrfToken });
  });
});

app.post("/api/auth/logout", requireAuth, requireCsrf, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));

app.get("/api/notes", requireAuth, (req, res) => {
  const notes = db.prepare("SELECT id,title,body,updated_at AS updatedAt FROM notes WHERE user_id=? ORDER BY updated_at DESC, id DESC").all(req.user.id);
  res.json({ notes });
});
app.post("/api/notes", requireAuth, requireCsrf, (req, res) => {
  const title = String(req.body.title || "").slice(0, 120);
  const body = String(req.body.body || "").slice(0, 20000);
  const result = db.prepare("INSERT INTO notes(user_id,title,body) VALUES(?,?,?)").run(req.user.id, title, body);
  res.json({ note: db.prepare("SELECT id,title,body,updated_at AS updatedAt FROM notes WHERE id=?").get(result.lastInsertRowid) });
});
app.patch("/api/notes/:id", requireAuth, requireCsrf, (req, res) => {
  const id = Number(req.params.id);
  const note = db.prepare("SELECT id FROM notes WHERE id=? AND user_id=?").get(id, req.user.id);
  if (!note) return res.status(404).json({ error: "Notiz nicht gefunden." });
  db.prepare("UPDATE notes SET title=?, body=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(String(req.body.title || "").slice(0,120), String(req.body.body || "").slice(0,20000), id);
  res.json({ ok: true });
});
app.delete("/api/notes/:id", requireAuth, requireCsrf, (req, res) => {
  const result = db.prepare("DELETE FROM notes WHERE id=? AND user_id=?").run(Number(req.params.id), req.user.id);
  if (!result.changes) return res.status(404).json({ error: "Notiz nicht gefunden." });
  res.json({ ok: true });
});

// Admin API: users and their notes are visible to admins, as disclosed on the signup screen.
app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id,u.username,u.role,u.banned,u.created_at AS createdAt,
    (SELECT COUNT(*) FROM notes n WHERE n.user_id=u.id) AS noteCount
    FROM users u ORDER BY u.created_at DESC
  `).all();
  res.json({ users });
});
app.get("/api/admin/users/:id/notes", requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare("SELECT id,username FROM users WHERE id=?").get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  const notes = db.prepare("SELECT id,title,body,updated_at AS updatedAt FROM notes WHERE user_id=? ORDER BY updated_at DESC").all(user.id);
  res.json({ user, notes });
});
app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare("SELECT id,role,banned FROM users WHERE id=?").get(id);
  if (!target) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  const action = req.body.action;
  if (!["ban","unban","promote","demote"].includes(action)) return res.status(400).json({ error: "Ungültige Aktion." });
  if (id === req.user.id && ["ban","demote"].includes(action)) return res.status(400).json({ error: "Du kannst dein eigenes Admin-Konto hier nicht sperren oder herabstufen." });
  if (action === "demote" && target.role === "admin") {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n;
    if (admins <= 1) return res.status(400).json({ error: "Mindestens ein Admin muss bleiben." });
  }
  if (action === "ban" && target.role === "admin") {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND banned=0").get().n;
    if (admins <= 1) return res.status(400).json({ error: "Mindestens ein aktiver Admin muss bleiben." });
  }
  if (action === "ban") db.prepare("UPDATE users SET banned=1 WHERE id=?").run(id);
  if (action === "unban") db.prepare("UPDATE users SET banned=0 WHERE id=?").run(id);
  if (action === "promote") db.prepare("UPDATE users SET role='admin' WHERE id=?").run(id);
  if (action === "demote") db.prepare("UPDATE users SET role='user' WHERE id=?").run(id);
  res.json({ ok: true });
});
app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "Du kannst dein eigenes Konto nicht löschen." });
  const target = db.prepare("SELECT role FROM users WHERE id=?").get(id);
  if (!target) return res.status(404).json({ error: "Nutzer nicht gefunden." });
  if (target.role === "admin" && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n <= 1) {
    return res.status(400).json({ error: "Der letzte Admin kann nicht gelöscht werden." });
  }
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log(`NEXORA läuft auf Port ${PORT}`));
