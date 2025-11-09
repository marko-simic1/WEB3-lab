document.addEventListener('DOMContentLoaded', () => {
  const sqlion = document.getElementById('sqli-flag');
  const authon = document.getElementById('auth-flag');
  const showCookieBtn = document.getElementById('show-cookie-info');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  function checkinput() {
    fetch('/flags').then(r => r.json()).then(data => {
      if (data && data.flags) {
        if (sqlion) sqlion.checked = !!data.flags.sqlInjectionEnabled;
        if (authon) authon.checked = !!data.flags.brokenAuthEnabled;
      }
    }).catch(() => {});
  }

  function setFlag(name, value) {
    return fetch('/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value })
    }).then(r => r.json());
  }

  if (sqlion) {
    sqlion.addEventListener('change', () => {
      setFlag('sqlInjectionEnabled', sqlion.checked).catch(() => {});
    });
  }

  if (authon) {
    authon.addEventListener('change', () => {
      setFlag('brokenAuthEnabled', authon.checked).catch(() => {});
    });
  }

  if (showCookieBtn) {
    showCookieBtn.addEventListener('click', () => {
      alert('document.cookie = ' + document.cookie );
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const username = (usernameInput && usernameInput.value) || '';
      const password = (passwordInput && passwordInput.value) || '';
      fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }).then(r => r.json()).then(data => {
        if (!data) return alert('Nema odgovora od servera');
        if (data.success) {
          let msg = data.message || 'Uspjeh';
          if (data.exposedRows && Array.isArray(data.exposedRows) && data.exposedRows.length > 0) {
            msg += `\nExposed rows: ${data.exposedRows.length}\nPrvi red: ${JSON.stringify(data.exposedRows[0])}`;
          } else if (data.cookie) {
            msg += `\nCookie: ${data.cookie}`;
          }
          alert(msg);
          checkinput();
        } else {
          alert('Neuspjela prijava: ' + (data.message || 'nepoznata greška'));
        }
      }).catch(err => {
        alert('Greška pri prijavi: ' + err);
      });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      fetch('/logout', { method: 'POST' }).then(() => {
        alert('Odjavljen (cookie obrisan)');
      }).catch(err => alert('Greška pri odjavi: ' + err));
    });
  }

  checkinput();
});
