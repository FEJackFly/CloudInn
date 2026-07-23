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

const PORT = process.env.PORT || 8088;
const JWT_SECRET = process.env.JWT_SECRET || 'hotel_gemini_secret_key_2026';

const BOSS_USERNAME = process.env.BOSS_USERNAME || 'boss';
const BOSS_PASSWORD = process.env.BOSS_PASSWORD || 'boss12345';
const BOSS_NAME = process.env.BOSS_NAME || '老板';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'hotel.db');
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

// Database initialization
async function initDb() {
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

  // Ensure permissions column exists for existing DBs
  try {
    await dbRun(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '["report"]'`);
  } catch (e) {
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

  // Ensure default Boss account exists in DB or is synced
  const bossUser = await dbGet(`SELECT * FROM users WHERE username = ?`, [BOSS_USERNAME]);
  const hashedPassword = await bcrypt.hash(BOSS_PASSWORD, 10);
  const bossPermissions = JSON.stringify(['report', 'expense', 'stats', 'users']);

  if (!bossUser) {
    await dbRun(
      `INSERT INTO users (username, password, name, role, status, permissions) VALUES (?, ?, ?, 'boss', 'active', ?)`,
      [BOSS_USERNAME, hashedPassword, BOSS_NAME, bossPermissions]
    );
  } else {
    // Sync password and name if updated via env
    await dbRun(
      `UPDATE users SET password = ?, name = ?, role = 'boss', permissions = ? WHERE username = ?`,
      [hashedPassword, BOSS_NAME, bossPermissions, BOSS_USERNAME]
    );
  }
}

initDb().catch(err => {
  console.error('Failed to initialize database:', err);
});

function getUserPermissions(user) {
  if (user.role === 'boss') return ['report', 'expense', 'stats', 'users'];
  try {
    return user.permissions ? JSON.parse(user.permissions) : ['report'];
  } catch (e) {
    return ['report'];
  }
}

// JWT Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
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

// --- Auth Routes ---

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await dbGet(`SELECT * FROM users WHERE username = ?`, [username]);
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

// Employee Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password and name required' });
    }

    const existing = await dbGet(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPerms = ['report'];
    const result = await dbRun(
      `INSERT INTO users (username, password, name, role, status, permissions) VALUES (?, ?, ?, 'employee', 'active', ?)`,
      [username, hashedPassword, name, JSON.stringify(defaultPerms)]
    );

    const user = {
      id: result.lastID,
      username,
      name,
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

// Get Current User Info
app.get('/api/me', authenticateToken, async (req, res) => {
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
});

// Logout
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

    const existing = await dbGet(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const userPerms = Array.isArray(permissions) && permissions.length ? permissions : ['report'];
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      `INSERT INTO users (username, password, name, role, status, permissions) VALUES (?, ?, ?, 'employee', 'active', ?)`,
      [username, hashedPassword, name, JSON.stringify(userPerms)]
    );

    res.json({
      id: result.lastID,
      username,
      name,
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
      return res.status(400).json({ error: 'Cannot modify boss account permissions' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push(`name = ?`);
      params.push(name);
    }
    if (status) {
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
      return res.status(400).json({ error: 'Cannot delete boss account' });
    }

    // Toggle status or delete. Setting status = 'disabled' / toggle
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
    if (!report_date || !room_number || amount === undefined || !channel) {
      return res.status(400).json({ error: 'Missing required report fields' });
    }

    const result = await dbRun(
      `INSERT INTO reports (user_id, user_name, report_date, room_number, amount, channel) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.name, report_date, room_number, parseFloat(amount), channel]
    );

    res.json({
      id: result.lastID,
      user_id: req.user.id,
      user_name: req.user.name,
      report_date,
      room_number,
      amount: parseFloat(amount),
      channel,
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
      return res.status(403).json({ error: 'Permission denied: Cannot delete other user report' });
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
    if (!expense_date || !category || amount === undefined) {
      return res.status(400).json({ error: 'Missing required expense fields' });
    }

    const result = await dbRun(
      `INSERT INTO expenses (expense_date, category, amount, description) VALUES (?, ?, ?, ?)`,
      [expense_date, category, parseFloat(amount), description || '']
    );

    res.json({
      id: result.lastID,
      expense_date,
      category,
      amount: parseFloat(amount),
      description: description || '',
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
    if (!month) {
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
    const totalIncome = reports.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
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
        dailyIncomeMap[r.report_date] += r.amount;
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
        channelMap[ch] += r.amount;
      } else {
        channelMap.OTHER += r.amount;
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
      roomMap[rm] = (roomMap[rm] || 0) + r.amount;
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
        categoryMap[cat] += e.amount;
      } else {
        categoryMap.OTHER += e.amount;
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

app.listen(PORT, () => {
  console.log(`🏨 Hotel Gemini Backend running on http://localhost:${PORT}`);
});
