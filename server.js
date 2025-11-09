const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const DB_FILE = path.join(__dirname, 'db.sqlite3');
const SQL_INIT_FILE = path.join(__dirname, 'db.sql');
const app = express();
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cookieParser());

let flags = {
  sqlInjectionEnabled: true,
  brokenAuthEnabled: true
};

function response(res, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(obj));
}

function initdb(callback) {
  if (!fs.existsSync(SQL_INIT_FILE)) {
    process.exit(1);
  }

  const sql = fs.readFileSync(SQL_INIT_FILE, 'utf8');
  const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
      process.exit(1);
    }

    db.exec(sql, (execErr) => {
      if (execErr) {
        process.exit(1);
      }

      callback(db);
    });
  });
}

initdb((db) => {
  app.get('/', (req, res) => {
    res.render('index', { flags });
  });

  app.get('/flags', (req, res) => {
    response(res, { flags });
  });

  app.post('/toggle', (req, res) => {
    const { name, value } = req.body;
    if (!(name in flags)) {
      return res.status(400).json({ ok: false, error: 'Unknown flag' });
    }

    const parsed =
      value === true || value === 1 || value === '1' || value === 'true';

    flags[name] = parsed;
    response(res, { ok: true, flags });
  });

  app.post('/login', (req, res) => {
    const { username = '', password = '' } = req.body;

    if (flags.sqlInjectionEnabled) {
      const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}';`;
      db.all(sql, [], (err, rows) => {
        if (err) {
          return response(res, { success: false, error: 'DB error' });
        }
        if (!rows || rows.length === 0) {
          return response(res, { success: false, message: 'Neispravni podaci' });
        }
        return handleLogin(rows[0], rows, res, db);
      });
    } else {
      const sql = `SELECT * FROM users WHERE username = ?;`;
      db.get(sql, [username], (err, row) => {
        if (err) {
          return response(res, { success: false, error: 'DB error' });
        }
        if (!row) {
          return response(res, { success: false, message: 'Neispravni podaci' });
        }

        if (flags.brokenAuthEnabled) {
          if (row.password === password) {
            return handleLogin(row, [row], res, db);
          } else {
            return response(res, { success: false, message: 'Neispravni podaci' });
          }
        } else {
          try {
            const storedPlain = row.password;
            const storedHash = bcrypt.hashSync(storedPlain, 10);
            const same = bcrypt.compareSync(password, storedHash);
            if (same) {
              return handleLogin(row, [row], res, db);
            } else {
              return response(res, { success: false, message: 'Neispravni podaci' });
            }
          } catch (e) {
            return response(res, { success: false, error: 'Server error' });
          }
        }
      });
    }
  });

  app.post('/logout', (req, res) => {
    res.clearCookie('session');
    response(res, { ok: true });
  });

  function handleLogin(userRow, rows, res, dbRef) {
    if (flags.brokenAuthEnabled) {
      const token = `${userRow.username}-token`;
      res.cookie('session', token, { httpOnly: false });
      response(res, {
        success: true,
        message: `Uspješno prijavljen: ${userRow.username} (broken auth on)`,
        cookie: token,
        exposedRows: rows
      });
    } else {
      const token = crypto.randomBytes(24).toString('hex');
      dbRef.run(
        'INSERT INTO sessions (username, token) VALUES (?, ?)',
        [userRow.username, token],
        () => {
          res.cookie('session', token, { httpOnly: true });
          response(res, {
            success: true,
            message: `Uspješno prijavljen: ${userRow.username} (broken auth off)`
          });
        }
      );
    }
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`App listening on http://localhost:${PORT}`);
  });
});
