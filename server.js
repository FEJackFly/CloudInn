import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load .env if present (zero-dependency with Node.js fallback)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch {
      loadEnvFallback(envPath);
    }
  } else {
    loadEnvFallback(envPath);
  }
}

function loadEnvFallback(file) {
  try {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn('[Env] Notice: could not parse .env file:', err.message);
  }
}

const PORT = parseInt(process.env.PORT || '8088', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'cloud_inn_secret_key_2026';

const BOSS_USERNAME = (process.env.BOSS_USERNAME || 'boss').trim();
const BOSS_PASSWORD = process.env.BOSS_PASSWORD || 'boss12345';
const BOSS_NAME = (process.env.BOSS_NAME || '老板').trim();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Initialize SQLite database (prioritize data/hotel.db if it exists)
const defaultDbPath = fs.existsSync(path.join(__dirname, 'data', 'hotel.db'))
  ? path.join(__dirname, 'data', 'hotel.db')
  : path.join(__dirname, 'hotel.db');

const dbPath = process.env.DB_PATH || defaultDbPath;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new sqlite3.Database(dbPath);

// Helper promise wrappers for sqlite3
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Database initialization with WAL mode & indexes
async function initDb() {
  // SQLite Performance & Concurrency Pragmas
  await dbRun(`PRAGMA journal_mode = WAL`);
  await dbRun(`PRAGMA synchronous = NORMAL`);
  await dbRun(`PRAGMA foreign_keys = ON`);
  await dbRun(`PRAGMA busy_timeout = 5000`);

  // Create tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      status TEXT NOT NULL DEFAULT 'active',
      permissions TEXT DEFAULT '["report"]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await dbRun(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '["report"]'`);
  } catch {
    // Column already exists
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      shift TEXT DEFAULT '',
      room_number TEXT NOT NULL,
      amount REAL NOT NULL,
      channel TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create performance indexes
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`);

  // Ensure default Boss account exists and is synchronized
  const bossUser = await dbGet(`SELECT * FROM users WHERE username = ?`, [BOSS_USERNAME]);
  const bossPermissions = JSON.stringify(['report', 'expense', 'stats', 'users']);

  if (!bossUser) {
    const hashedPassword = await bcrypt.hash(BOSS_PASSWORD, 10);
    await dbRun(
      `INSERT INTO users (username, password, name, role, status, permissions) VALUES (?, ?, ?, 'boss', 'active', ?)`,
      [BOSS_USERNAME, hashedPassword, BOSS_NAME, bossPermissions]
    );
  } else {
    // Avoid costly re-hashing if password and name are unchanged
    const passwordMatch = await bcrypt.compare(BOSS_PASSWORD, bossUser.password);
    if (!passwordMatch || bossUser.name !== BOSS_NAME || bossUser.permissions !== bossPermissions) {
      const hashedPassword = passwordMatch ? bossUser.password : await bcrypt.hash(BOSS_PASSWORD, 10);
      await dbRun(
        `UPDATE users SET password = ?, name = ?, role = 'boss', permissions = ? WHERE username = ?`,
        [hashedPassword, BOSS_NAME, bossPermissions, BOSS_USERNAME]
      );
    }
  }
}

function getUserPermissions(user) {
  if (user.role === 'boss') return ['report', 'expense', 'stats', 'users'];
  try {
    return user.permissions ? JSON.parse(user.permissions) : ['report'];
  } catch {
    return ['report'];
  }
}

// --- Middlewares ---

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function requireBoss(req, res, next) {
  if (req.user.role !== 'boss') {
    return res.status(403).json({ error: 'Permission denied: Boss access required' });
  }
  next();
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (req.user.role === 'boss') return next();
    const perms = req.user.permissions || [];
    if (perms.includes(perm)) return next();
    return res.status(403).json({ error: `Permission denied: Missing '${perm}' permission` });
  };
}

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// --- Auth Routes ---

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await dbGet(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`, [username.trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account has been disabled. Please contact boss.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const permissions = getUserPermissions(user);
    const tokenPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
        permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password and name required' });
    }

    const cleanUsername = username.trim();
    const cleanName = name.trim();

    if (cleanUsername.length < 2 || cleanName.length < 1) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }

    const existing = await dbGet(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`, [cleanUsername]);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPerms = ['report'];
    const result = await dbRun(
      `INSERT INTO users (username, password, name, role, status, permissions) VALUES (?, ?, ?, 'employee', 'active', ?)`,
      [cleanUsername, hashedPassword, cleanName, JSON.stringify(defaultPerms)]
    );

    const user = {
      id: result.lastID,
      username: cleanUsername,
      name: cleanName,
      role: 'employee',
      status: 'active',
      permissions: defaultPerms,
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile endpoints
const getMeHandler = async (req, res) => {
  try {
    const user = await dbGet(`SELECT id, username, name, role, status, permissions FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.permissions = getUserPermissions(user);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.get('/api/me', authenticateToken, getMeHandler);
app.get('/api/auth/me', authenticateToken, getMeHandler);

app.post('/api/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// --- Employee Management Routes (Boss Only) ---

app.get('/api/users', authenticateToken, requireBoss, async (req, res) => {
  try {
    const users = await dbAll(`SELECT id, username, name, role, status, permissions, created_at FROM users WHERE role = 'employee' ORDER BY id DESC`);
    const formatted = users.map(u => ({
      ...u,
      permissions: getUserPermissions(u),
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, requireBoss, async (req, res) => {
  try {
    const { username, password, name, permissions } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password and name required' });
    }

    const cleanUsername = username.trim();
    const cleanName = name.trim();

    const existing = await dbGet(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`, [cleanUsername]);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const userPerms = Array.isArray(permissions) && permissions.length ? permissions : ['report'];
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      `INSERT INTO users (username, password, name, role, status, permissions) VALUES (?, ?, ?, 'employee', 'active', ?)`,
      [cleanUsername, hashedPassword, cleanName, JSON.stringify(userPerms)]
    );

    res.json({
      id: result.lastID,
      username: cleanUsername,
      name: cleanName,
      role: 'employee',
      status: 'active',
      permissions: userPerms,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireBoss, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, password, permissions, status } = req.body;
    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role === 'boss') {
      return res.status(400).json({ error: 'Cannot modify boss account via this endpoint' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push(`name = ?`);
      params.push(name.trim());
    }
    if (status && ['active', 'disabled'].includes(status)) {
      updates.push(`status = ?`);
      params.push(status);
    }
    if (Array.isArray(permissions)) {
      updates.push(`permissions = ?`);
      params.push(JSON.stringify(permissions));
    }
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password = ?`);
      params.push(hashedPassword);
    }

    if (updates.length > 0) {
      params.push(userId);
      await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedUser = await dbGet(`SELECT id, username, name, role, status, permissions, created_at FROM users WHERE id = ?`, [userId]);
    res.json({
      ...updatedUser,
      permissions: getUserPermissions(updatedUser),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireBoss, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role === 'boss') {
      return res.status(400).json({ error: 'Cannot disable boss account' });
    }

    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    await dbRun(`UPDATE users SET status = ? WHERE id = ?`, [newStatus, userId]);
    res.json({ success: true, message: `User status changed to ${newStatus}`, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Income Report Routes ---

app.post('/api/reports', authenticateToken, requirePermission('report'), async (req, res) => {
  try {
    const { report_date, room_number, amount, channel } = req.body;
    const numAmount = parseFloat(amount);

    if (!report_date || !room_number || isNaN(numAmount) || numAmount < 0 || !channel) {
      return res.status(400).json({ error: 'Valid report date, room number, positive amount and payment channel required' });
    }

    const result = await dbRun(
      `INSERT INTO reports (user_id, user_name, report_date, room_number, amount, channel) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.name, report_date, String(room_number).trim(), numAmount, channel.trim()]
    );

    res.json({
      id: result.lastID,
      user_id: req.user.id,
      user_name: req.user.name,
      report_date,
      room_number: String(room_number).trim(),
      amount: numAmount,
      channel: channel.trim(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports', authenticateToken, requirePermission('report'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let sql = `SELECT * FROM reports`;
    const params = [];
    const conditions = [];

    if (req.user.role !== 'boss') {
      conditions.push(`user_id = ?`);
      params.push(req.user.id);
    }

    if (start_date) {
      conditions.push(`report_date >= ?`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`report_date <= ?`);
      params.push(end_date);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY report_date DESC, id DESC`;

    const reports = await dbAll(sql, params);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reports/:id', authenticateToken, requirePermission('report'), async (req, res) => {
  try {
    const reportId = req.params.id;
    const report = await dbGet(`SELECT * FROM reports WHERE id = ?`, [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (req.user.role !== 'boss' && report.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied: Cannot delete reports created by other users' });
    }

    await dbRun(`DELETE FROM reports WHERE id = ?`, [reportId]);
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Expense Routes ---

app.post('/api/expenses', authenticateToken, requirePermission('expense'), async (req, res) => {
  try {
    const { expense_date, category, amount, description } = req.body;
    const numAmount = parseFloat(amount);

    if (!expense_date || !category || isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Valid expense date, category, and positive amount required' });
    }

    const result = await dbRun(
      `INSERT INTO expenses (expense_date, category, amount, description) VALUES (?, ?, ?, ?)`,
      [expense_date, category.trim(), numAmount, description ? String(description).trim() : '']
    );

    res.json({
      id: result.lastID,
      expense_date,
      category: category.trim(),
      amount: numAmount,
      description: description ? String(description).trim() : '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/expenses', authenticateToken, requirePermission('expense'), async (req, res) => {
  try {
    const { month, start_date, end_date } = req.query;
    let sql = `SELECT * FROM expenses`;
    const params = [];
    const conditions = [];

    if (month) {
      conditions.push(`expense_date LIKE ?`);
      params.push(`${month}%`);
    } else {
      if (start_date) {
        conditions.push(`expense_date >= ?`);
        params.push(start_date);
      }
      if (end_date) {
        conditions.push(`expense_date <= ?`);
        params.push(end_date);
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY expense_date DESC, id DESC`;

    const expenses = await dbAll(sql, params);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', authenticateToken, requirePermission('expense'), async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expense = await dbGet(`SELECT * FROM expenses WHERE id = ?`, [expenseId]);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await dbRun(`DELETE FROM expenses WHERE id = ?`, [expenseId]);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Monthly Analytics & Stats Route ---

app.get('/api/stats/monthly', authenticateToken, requirePermission('stats'), async (req, res) => {
  try {
    let { month } = req.query; // YYYY-MM
    const dateRegex = /^\d{4}-\d{2}$/;
    if (!month || !dateRegex.test(month)) {
      const now = new Date();
      const year = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      month = `${year}-${m}`;
    }

    const reports = await dbAll(
      `SELECT * FROM reports WHERE report_date LIKE ? ORDER BY report_date ASC`,
      [`${month}%`]
    );

    const expenses = await dbAll(
      `SELECT * FROM expenses WHERE expense_date LIKE ? ORDER BY expense_date ASC`,
      [`${month}%`]
    );

    // 1. KPI Calculation
    const totalIncome = reports.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const reportCount = reports.length;

    // 2. Daily Income Trend
    const [yrStr, moStr] = month.split('-');
    const year = parseInt(yrStr, 10);
    const mo = parseInt(moStr, 10);
    const daysInMonth = new Date(year, mo, 0).getDate();

    const dailyIncomeMap = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${month}-${String(day).padStart(2, '0')}`;
      dailyIncomeMap[dayStr] = 0;
    }
    reports.forEach(r => {
      if (dailyIncomeMap[r.report_date] !== undefined) {
        dailyIncomeMap[r.report_date] += Number(r.amount) || 0;
      }
    });

    const dailyIncomeTrend = Object.keys(dailyIncomeMap).sort().map(date => ({
      date,
      amount: dailyIncomeMap[date],
    }));

    // 3. Payment Channel Breakdown (CASH, ABA, CRYPTO, WECHAT, OTHER)
    const channelMap = { CASH: 0, ABA: 0, CRYPTO: 0, WECHAT: 0, OTHER: 0 };
    reports.forEach(r => {
      const ch = (r.channel || 'OTHER').toUpperCase();
      if (channelMap[ch] !== undefined) {
        channelMap[ch] += Number(r.amount) || 0;
      } else {
        channelMap.OTHER += Number(r.amount) || 0;
      }
    });

    const channelBreakdown = Object.keys(channelMap).map(channel => ({
      channel,
      amount: channelMap[channel],
    }));

    // 4. Room Income Comparison
    const roomMap = {};
    reports.forEach(r => {
      const rm = r.room_number || 'Unknown';
      roomMap[rm] = (roomMap[rm] || 0) + (Number(r.amount) || 0);
    });

    const roomIncome = Object.keys(roomMap)
      .map(room => ({ room_number: room, amount: roomMap[room] }))
      .sort((a, b) => b.amount - a.amount);

    // 5. Expense Category Breakdown
    const categoryMap = {
      UTILITIES: 0,
      RENT: 0,
      INTERNET: 0,
      LAUNDRY: 0,
      SALARY: 0,
      OTHER: 0,
    };
    expenses.forEach(e => {
      const cat = (e.category || 'OTHER').toUpperCase();
      if (categoryMap[cat] !== undefined) {
        categoryMap[cat] += Number(e.amount) || 0;
      } else {
        categoryMap.OTHER += Number(e.amount) || 0;
      }
    });

    const expenseCategoryBreakdown = Object.keys(categoryMap).map(category => ({
      category,
      amount: categoryMap[category],
    }));

    res.json({
      month,
      kpi: {
        totalIncome,
        totalExpense,
        netProfit,
        reportCount,
      },
      dailyIncomeTrend,
      channelBreakdown,
      roomIncome,
      expenseCategoryBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend in production / preview
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Start server after database initialization
let serverInstance = null;

async function start() {
  try {
    await initDb();
    serverInstance = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🏨 云宿管家 (CloudInn) Backend running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal database initialization error:', err);
    process.exit(1);
  }
}

start();

// Graceful termination handling
const shutdown = () => {
  console.log('Shutting down server gracefully...');
  if (serverInstance) {
    serverInstance.close(() => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
