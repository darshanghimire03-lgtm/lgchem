// auth-helpers.js
(function () {
  console.log('📦 [auth-helpers.js] starting…');

  if (!window.LGChem) {
    console.error('❌ window.LGChem is undefined. firebase-config.js failed.');
    console.error('   Reason:', window.LGChemInitError || 'unknown');
    console.error('   Check that you included these in order:');
    console.error('     1. firebase-app-compat.js');
    console.error('     2. firebase-auth-compat.js');
    console.error('     3. firebase-database-compat.js');
    console.error('     4. firebase-config.js');
    console.error('     5. auth-helpers.js');
    // Provide safe stubs so page scripts don't crash with "reading of undefined"
    window.LGChemAuth = {
      auth: null,
      rtdb: null,
      getCurrentUser: () => null,
      waitForAuth: async () => null,
      requireAuth: async (r) => { window.location.href = r || '../auth/index.html'; return null; },
      redirectIfAuthed: async () => null,
      onAuthChange: () => {},
      friendlyAuthError: (_c, m) => m || 'App failed to initialize. Check browser console.',
      saveUserProfile: async () => { throw new Error('Firebase not initialized'); },
      getUserProfile: async () => null,
      fetchCartCount: async () => 0,
      addProductToCart: async () => { throw new Error('Firebase not initialized'); },
      getCartItems: async () => [],
      removeFromCart: async () => ({ items: [], count: 0 }),
      errInfo: (e) => ({ code: 'unknown', message: e && e.message ? e.message : String(e || 'unknown') })
    };
    return;
  }

  const auth = window.LGChem.auth;
  const rtdb = window.LGChem.rtdb;

  // Double-check
  if (!auth) {
    console.error('❌ LGChem.auth is missing.');
    window.LGChemInitError = 'auth instance missing';
    return;
  }
  if (!rtdb) {
    console.error('❌ LGChem.rtdb is missing. Check databaseURL.');
    window.LGChemInitError = 'rtdb instance missing';
    return;
  }

  console.log('   auth:', auth ? 'ok' : 'MISSING');
  console.log('   rtdb:', rtdb ? 'ok' : 'MISSING');

  // ---------- errInfo: always returns usable info ----------
  function errInfo(err) {
    if (!err) return { code: 'unknown', message: 'Unknown error (empty)' };
    if (typeof err === 'string') return { code: 'unknown', message: err };
    return {
      code: err.code || err.name || 'unknown',
      message: err.message || err.reason || err.error || String(err)
    };
  }

  // ---------- AUTH ----------
  function getCurrentUser() { return auth.currentUser; }

  function waitForAuth() {
    return new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged(
        (user) => { unsub(); resolve(user); },
        (err) => { console.error('onAuthStateChanged error:', errInfo(err)); unsub(); resolve(null); }
      );
    });
  }

  async function requireAuth(redirectTo = '../auth/index.html') {
    const user = await waitForAuth();
    if (!user) { window.location.href = redirectTo; return null; }
    return user;
  }

  async function redirectIfAuthed(redirectTo = '../user/index.html') {
    const user = await waitForAuth();
    if (user) { window.location.href = redirectTo; return user; }
    return null;
  }

  function onAuthChange(cb) { return auth.onAuthStateChanged(cb); }

  function friendlyAuthError(code, message) {
    const map = {
      'auth/invalid-email': 'That email address looks invalid.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with that email. Try signing up.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password. Please try again.',
      'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
      'auth/email-already-in-use': 'That email is already registered. Try signing in.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your internet connection.',
      'auth/operation-not-allowed': 'Email/Password sign-in is NOT enabled. Firebase Console → Authentication → Sign-in method → Enable Email/Password.',
      'auth/missing-password': 'Please enter your password.',
      'auth/missing-email': 'Please enter your email.',
      'auth/internal-error': 'Firebase server error. Try again.',
      'auth/configuration-not-found': 'Firebase Authentication is not set up. Enable it in Firebase Console.',
      'auth/unauthorized-domain': 'This domain is not authorized. Add "localhost" in Firebase Console → Authentication → Settings → Authorized domains.'
    };
    return map[code] || message || ('Unknown error (' + code + ')');
  }

  // ---------- PROFILE (RTDB) ----------
  async function saveUserProfile(uid, profile) {
    try {
      await rtdb.ref('users/' + uid).set({
        fullName: profile.fullName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        accountType: profile.accountType || 'personal',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      return true;
    } catch (e) {
      const info = errInfo(e);
      console.error('saveUserProfile error:', info);
      const err = new Error(info.message);
      err.code = info.code;
      throw err;
    }
  }

  async function getUserProfile(uid) {
    try {
      const snap = await rtdb.ref('users/' + uid).once('value');
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      console.warn('getUserProfile error:', errInfo(e));
      return null;
    }
  }

  // ---------- CART (RTDB) ----------
  function normalizeItems(raw) {
    if (!raw) return [];
    let arr;
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'object') arr = Object.values(raw);
    else return [];
    return arr.filter(i => i && i.id);
  }

  async function fetchCartCount(userId) {
    if (!userId) return 0;
    try {
      const snap = await rtdb.ref('carts/' + userId + '/items').once('value');
      const items = normalizeItems(snap.val());
      return items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    } catch (e) {
      console.warn('fetchCartCount error:', errInfo(e));
      return 0;
    }
  }

  async function addProductToCart(userId, product) {
    if (!userId) { const e = new Error('Not authenticated'); e.code = 'auth/required'; throw e; }
    try {
      const itemsRef = rtdb.ref('carts/' + userId + '/items');
      const snap = await itemsRef.once('value');
      let items = normalizeItems(snap.val());
      const idx = items.findIndex(i => i.id === product.id);
      if (idx !== -1) items[idx].quantity = (Number(items[idx].quantity) || 1) + 1;
      else items.push({ id: product.id, name: product.name, price: Number(product.price) || 0, quantity: 1 });
      await itemsRef.set(items);
      await rtdb.ref('carts/' + userId + '/updatedAt').set(firebase.database.ServerValue.TIMESTAMP);
      return { items, count: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0) };
    } catch (e) {
      const info = errInfo(e);
      console.error('addProductToCart error:', info);
      const err = new Error(info.message);
      err.code = info.code;
      throw err;
    }
  }

  async function getCartItems(userId) {
    if (!userId) return [];
    try {
      const snap = await rtdb.ref('carts/' + userId + '/items').once('value');
      return normalizeItems(snap.val());
    } catch (e) {
      console.warn('getCartItems error:', errInfo(e));
      return [];
    }
  }

  async function removeFromCart(userId, productId) {
    if (!userId) { const e = new Error('Not authenticated'); e.code = 'auth/required'; throw e; }
    try {
      const itemsRef = rtdb.ref('carts/' + userId + '/items');
      const snap = await itemsRef.once('value');
      let items = normalizeItems(snap.val()).filter(i => i.id !== productId);
      await itemsRef.set(items);
      await rtdb.ref('carts/' + userId + '/updatedAt').set(firebase.database.ServerValue.TIMESTAMP);
      return { items, count: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0) };
    } catch (e) {
      const info = errInfo(e);
      console.error('removeFromCart error:', info);
      const err = new Error(info.message);
      err.code = info.code;
      throw err;
    }
  }

  window.LGChemAuth = {
    auth: auth,
    rtdb: rtdb,
    getCurrentUser,
    waitForAuth,
    requireAuth,
    redirectIfAuthed,
    onAuthChange,
    friendlyAuthError,
    saveUserProfile,
    getUserProfile,
    fetchCartCount,
    addProductToCart,
    getCartItems,
    removeFromCart,
    errInfo
  };

  console.log('✅ [auth-helpers.js] helpers ready');
})();