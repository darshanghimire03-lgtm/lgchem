// firebase-config.js
(function () {
  console.log('📦 [firebase-config.js] starting…');

  

  // 1. Check Firebase SDK
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK not loaded. The <script src="https://www.gstatic.com/firebasejs/..."> tags failed. Check internet / adblocker.');
    window.LGChemInitError = 'Firebase SDK failed to load';
    return;
  }

  // 2. Check required SDK parts
  const missing = [];
  if (typeof firebase.auth !== 'function') missing.push('firebase-auth-compat.js');
  if (typeof firebase.database !== 'function') missing.push('firebase-database-compat.js');
  if (missing.length) {
    console.error('❌ Missing SDK components:', missing.join(', '));
    console.error('   Add these <script> tags BEFORE firebase-config.js');
    window.LGChemInitError = 'Missing SDK: ' + missing.join(', ');
    return;
  }

  // 3. Initialize app
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('   firebase.initializeApp() OK');
    } else {
      console.log('   firebase already initialized');
    }
  } catch (err) {
    console.error('❌ firebase.initializeApp() failed:', err);
    window.LGChemInitError = 'initializeApp failed: ' + (err.message || err);
    return;
  }

  // 4. Get auth instance
  let authInstance;
  try {
    authInstance = firebase.auth();
    console.log('   firebase.auth() OK');
  } catch (err) {
    console.error('❌ firebase.auth() failed. Is Email/Password enabled?', err);
    window.LGChemInitError = 'auth() failed: ' + (err.message || err);
    return;
  }

  // 5. Get database instance (fails if databaseURL is wrong!)
  let rtdbInstance;
  try {
    rtdbInstance = firebase.database();
    console.log('   firebase.database() OK');
  } catch (err) {
    console.error('❌ firebase.database() failed. Your databaseURL is probably WRONG.');
    console.error('   Current value:', firebaseConfig.databaseURL);
    console.error('   Get the correct URL from Firebase Console → Realtime Database');
    console.error('   Error:', err);
    window.LGChemInitError = 'database() failed — bad databaseURL. Check console.';
    return;
  }

  // 6. Expose
  window.LGChem = {
    firebase: firebase,
    auth: authInstance,
    rtdb: rtdbInstance
  };

  console.log('✅ [firebase-config.js] Firebase initialized');
  console.log('   Project:', firebaseConfig.projectId);
  console.log('   Database URL:', firebaseConfig.databaseURL);
  console.log('   auth is a:', typeof authInstance, authInstance ? '(ok)' : '(MISSING!)');
})();