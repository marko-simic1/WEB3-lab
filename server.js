const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const DB_FILE = path.join(__dirname, 'db.sqlite3');
const SQL_FILE = path.join(__dirname, 'db.sql');
const app = express();
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

let flags = {
  sqlinjOn: true,
  brokenAuthOn: true
};

if (!fs.existsSync(SQL_FILE)) process.exit(1);
const sql = fs.readFileSync(SQL_FILE, 'utf8');
const db = new sqlite3.Database(DB_FILE, err => {
  if (err) process.exit(1);
  db.exec(sql, execErr => {
    if (execErr) process.exit(1);
  });
});

app.get('/', (req, res) => res.render('index', { flags }));

app.get('/flags', (req, res) => res.json({ flags }));

app.post('/toggle', (req, res) => {
  const { name, value } = req.body;
  if (!(name in flags)) 
    return res.status(400).json({ ok: false });
  const parsed = value === true || value === 1 || value === '1' || value === 'true';

  flags[name] = parsed;
  
  res.json({ ok: true, flags });
});

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;

  if (flags.sqlinjOn) {
    const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}';`;
    db.all(sql, (err, rows) => {
      if (err) return res.json({ success: false });

      if (!rows || rows.length === 0) 
        return res.json({ success: false, message: 'Neispravni podaci' });
      
      return loginSucc(rows[0], rows, res);
    });
  } else {
    db.get('SELECT * FROM users WHERE username = ?;', [username], (err, row) => {
      if (err) return res.json({ success: false });
      if (!row) return res.json({ success: false, message: 'Neispravni podaci' });

      if (flags.brokenAuthOn) {
        if (row.password === password) return loginSucc(row, [row], res);
        return res.json({ success: false, message: 'Neispravni podaci' });
      } else {
        const hash = bcrypt.hashSync(row.password, 10);
        const same = bcrypt.compareSync(password, hash);
        if (same) return loginSucc(row, [row], res);
        return res.json({ success: false, message: 'Neispravni podaci' });
      }
    });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

function loginSucc(user, rows, res) {
  if (flags.brokenAuthOn) {
    const token = `${user.username}-token`;
    res.cookie('session', token, { httpOnly: false });
    res.json({
      success: true,
      message: `Uspješno prijavljen: ${user.username} (broken auth on)`,
      cookie: token,
      exposedRows: rows
    });
  } else {
    const token = crypto.randomBytes(24).toString('hex');
    db.run('INSERT INTO sessions (username, token) VALUES (?, ?)', [user.username, token], () => {
      res.cookie('session', token, { httpOnly: true });
      res.json({
        success: true,
        message: `Uspješno prijavljen: ${user.username} (broken auth off)`
      });
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT);
