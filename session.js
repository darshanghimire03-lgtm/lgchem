(function () {
  const STORAGE_KEY = 'lgchem_session';

  function readStoredSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('session.js: could not read stored session', err);
      return null;
    }
  }

  function writeStoredSession(session) {
    try {
      if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('session.js: could not write stored session', err);
    }
  }

  const listeners = [];
  let lastKnownSession = readStoredSession();
  let firebaseConfirmed = false;

  function notifyListeners(session) {
    listeners.forEach(function (cb) {
      try {
        cb(session, firebaseConfirmed);
      } catch (err) {
        console.error('session.js listener error:', err);
      }
    });
  }

  window.LGSession = {
    getCached: function () {
      return readStoredSession();
    },
    getUserId: function () {
      const s = readStoredSession();
      return s ? s.uid : null;
    },
    isLoggedIn: function () {
      return !!readStoredSession();
    },
    isConfirmed: function () {
      return firebaseConfirmed;
    },
    onChange: function (callback) {
      listeners.push(callback);
      callback(lastKnownSession, firebaseConfirmed);
      return function unsubscribe() {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
      };
    },
    set: function (session) {
      lastKnownSession = session;
      writeStoredSession(session);
      notifyListeners(session);
    },
    clear: function () {
      lastKnownSession = null;
      writeStoredSession(null);
      notifyListeners(null);
    }
  };

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    lastKnownSession = readStoredSession();
    notifyListeners(lastKnownSession);
  });

  function sessionFromAuth(user, profile) {
    return {
      uid: user.uid,
      email: user.email,
      name: (profile && profile.name) || user.displayName || user.email,
      accountType: (profile && profile.accountType) || 'customer'
    };
  }

  function bindToFirebase() {
    if (!window.LGChem || typeof window.LGChem.onAuthChange !== 'function') {
      console.warn('session.js: window.LGChem not found. Load firebase-config.js before session.js.');
      firebaseConfirmed = true;
      notifyListeners(lastKnownSession);
      return;
    }

    window.LGChem.onAuthChange(function (user, profile) {
      firebaseConfirmed = true;

      if (!user) {
        lastKnownSession = null;
        writeStoredSession(null);
        notifyListeners(null);
        return;
      }

      const session = sessionFromAuth(user, profile);
      lastKnownSession = session;
      writeStoredSession(session);
      notifyListeners(session);
    });
  }

  bindToFirebase();
})();