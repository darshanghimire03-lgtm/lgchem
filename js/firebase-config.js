(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCpz_uWtq7U7x7FklxB5VTTqSuqTaB00LU",
    authDomain: "lg-chem-9fc35.firebaseapp.com",
    projectId: "lg-chem-9fc35",
    storageBucket: "lg-chem-9fc35.firebasestorage.app",
    messagingSenderId: "137893448433",
    appId: "1:137893448433:web:6622da8886a7c696d0b750",
    databaseURL: "https://lg-chem-9fc35-default-rtdb.firebaseio.com"
  };

  if (typeof firebase === 'undefined') {
    window.LGChemInitError = 'Firebase SDK failed to load. Check your internet connection or an ad blocker may be blocking gstatic.com.';
    return;
  }

  const missing = [];
  if (typeof firebase.auth !== 'function') missing.push('firebase-auth-compat.js');
  if (typeof firebase.database !== 'function') missing.push('firebase-database-compat.js');
  if (missing.length) {
    window.LGChemInitError = 'Missing SDK: ' + missing.join(', ');
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (err) {
    window.LGChemInitError = 'initializeApp failed: ' + (err.message || err);
    return;
  }

  let authInstance;
  try {
    authInstance = firebase.auth();
  } catch (err) {
    window.LGChemInitError = 'auth() failed: ' + (err.message || err);
    return;
  }

  let rtdbInstance;
  try {
    rtdbInstance = firebase.database();
  } catch (err) {
    window.LGChemInitError = 'database() failed — bad databaseURL: ' + (err.message || err);
    return;
  }

  window.LGChem = {
    firebase: firebase,
    auth: authInstance,
    rtdb: rtdbInstance,

    createAccount: function (email, password, profileWithoutUid) {
      return authInstance.createUserWithEmailAndPassword(email, password)
        .then(function (cred) {
          const uid = cred.user.uid;
          const profile = Object.assign({}, profileWithoutUid, {
            uid: uid,
            email: email,
            createdAt: new Date().toISOString()
          });
          delete profile.password;
          delete profile.confirmPassword;

          return cred.user.updateProfile({ displayName: profile.name || email })
            .then(function () {
              return rtdbInstance.ref('users/' + uid).set(profile);
            })
            .then(function () {
              return { uid: uid, profile: profile };
            });
        });
    },

    saveUserProfile: function (uid, profile) {
      const safeProfile = Object.assign({}, profile, { uid: uid });
      delete safeProfile.password;
      delete safeProfile.confirmPassword;
      return rtdbInstance.ref('users/' + uid).set(safeProfile);
    },

    getUserProfile: function (uid) {
      return rtdbInstance.ref('users/' + uid).once('value').then(function (snap) {
        return snap.val();
      });
    },

    onAuthChange: function (callback) {
      return authInstance.onAuthStateChanged(function (user) {
        if (!user) {
          callback(null, null);
          return;
        }
        rtdbInstance.ref('users/' + user.uid).once('value')
          .then(function (snap) {
            callback(user, snap.val());
          })
          .catch(function (err) {
            console.error('Failed to load user profile:', err);
            window.LGChemLastProfileError = err;
            callback(user, null);
          });
      });
    },

    signOut: function () {
      return authInstance.signOut();
    }
  };
})();