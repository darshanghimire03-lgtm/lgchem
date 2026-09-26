// firebase-config.js
// Shared Firebase initialization for LG CHEM (used by index.html and auth/index.html)
(function () {
  console.log('📦 [firebase-config.js] starting…');

  // 1. Your Firebase project configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCpz_uWtq7U7x7FklxB5VTTqSuqTaB00LU",
    authDomain: "lg-chem-9fc35.firebaseapp.com",
    projectId: "lg-chem-9fc35",
    storageBucket: "lg-chem-9fc35.firebasestorage.app",
    messagingSenderId: "137893448433",
    appId: "1:137893448433:web:6622da8886a7c696d0b750",
    databaseURL: "https://lg-chem-9fc35-default-rtdb.firebaseio.com"
  };

  // 2. Check Firebase SDK loaded
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK not loaded. The <script src="https://www.gstatic.com/firebasejs/..."> tags failed. Check internet / adblocker.');
    window.LGChemInitError = 'Firebase SDK failed to load';
    return;
  }

  // 3. Check required SDK parts
  const missing = [];
  if (typeof firebase.auth !== 'function') missing.push('firebase-auth-compat.js');
  if (typeof firebase.database !== 'function') missing.push('firebase-database-compat.js');
  if (missing.length) {
    console.error('❌ Missing SDK components:', missing.join(', '));
    console.error('   Add these <script> tags BEFORE firebase-config.js');
    window.LGChemInitError = 'Missing SDK: ' + missing.join(', ');
    return;
  }

  // 4. Initialize app
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

  // 5. Get auth instance
  let authInstance;
  try {
    authInstance = firebase.auth();
    console.log('   firebase.auth() OK');
  } catch (err) {
    console.error('❌ firebase.auth() failed. Is Email/Password enabled?', err);
    window.LGChemInitError = 'auth() failed: ' + (err.message || err);
    return;
  }

  // 6. Get database instance
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

  // 7. Expose a shared namespace used by both index.html and auth/index.html
  window.LGChem = {
    firebase: firebase,
    auth: authInstance,
    rtdb: rtdbInstance,

    // Save/update a user's profile in Realtime Database under users/{uid}.
    // Defensively strips any password-like field so a password can never be
    // written to the database, even by accident from future edits.
    saveUserProfile: function (uid, profile) {
      const safeProfile = Object.assign({}, profile);
      delete safeProfile.password;
      delete safeProfile.confirmPassword;
      return rtdbInstance.ref('users/' + uid).set(safeProfile);
    },

    // Fetch a user's profile once
    getUserProfile: function (uid) {
      return rtdbInstance.ref('users/' + uid).once('value').then(snap => snap.val());
    },

    // Subscribe to auth state changes app-wide.
    // callback receives (firebaseUser | null, profile | null)
    onAuthChange: function (callback) {
      return authInstance.onAuthStateChanged(function (user) {
        if (!user) {
          callback(null, null);
          return;
        }
        rtdbInstance.ref('users/' + user.uid).once('value')
          .then(snap => callback(user, snap.val()))
          .catch(err => {
            console.error('Failed to load user profile:', err);
            callback(user, null);
          });
      });
    },

    // Sign the current user out
    signOut: function () {
      return authInstance.signOut();
    }
  };

  console.log('✅ [firebase-config.js] Firebase initialized');
  console.log('   Project:', firebaseConfig.projectId);
  console.log('   Database URL:', firebaseConfig.databaseURL);
  console.log('   auth is a:', typeof authInstance, authInstance ? '(ok)' : '(MISSING!)');
})();
