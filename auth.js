(function () {
  const STORAGE_KEY = 'lgchem_session';

  function readStoredSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('auth.js: could not read stored session', err);
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
      console.warn('auth.js: could not write stored session', err);
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
        console.error('auth.js listener error:', err);
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
      console.warn('auth.js: window.LGChem not found. Load firebase-config.js before auth.js.');
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

function switchTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const formTitle = document.getElementById('formTitle');
    const formSubtitle = document.getElementById('formSubtitle');

    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        formTitle.innerText = 'Welcome Back';
        formSubtitle.innerText = 'Please login to your account';
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
        formTitle.innerText = 'Create an Account';
        formSubtitle.innerText = 'Join us to start ordering';
        resetSignupWizard();
    }
}

/* ---------------- Signup wizard ---------------- */

const STEP_IDS = [
    'step-type',
    'step-customer-2', 'step-customer-3',
    'step-seller-2', 'step-seller-3', 'step-seller-4', 'step-seller-5'
];

function goToStep(stepId) {
    STEP_IDS.forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === stepId) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    updateStepIndicator(stepId);
}

function updateStepIndicator(stepId) {
    const indicator = document.getElementById('stepIndicator');
    if (!indicator) return;

    const accountType = document.getElementById('accountType').value;
    let steps = [];

    if (accountType === 'seller') {
        steps = ['step-type', 'step-seller-2', 'step-seller-3', 'step-seller-4', 'step-seller-5'];
    } else if (accountType === 'customer') {
        steps = ['step-type', 'step-customer-2', 'step-customer-3'];
    } else {
        steps = ['step-type'];
    }

    const currentIndex = steps.indexOf(stepId);

    indicator.innerHTML = steps.map(function (id, i) {
        let cls = 'step-dot';
        if (i < currentIndex) cls += ' done';
        if (i === currentIndex) cls += ' current';
        return '<span class="' + cls + '"></span>';
    }).join('');
}

function resetSignupWizard() {
    document.getElementById('accountType').value = '';
    document.getElementById('customerOption').classList.remove('active');
    document.getElementById('sellerOption').classList.remove('active');
    goToStep('step-type');
}

function selectAccountType(type) {
    const accountTypeInput = document.getElementById('accountType');
    const customerOption = document.getElementById('customerOption');
    const sellerOption = document.getElementById('sellerOption');

    accountTypeInput.value = type;

    if (type === 'customer') {
        customerOption.classList.add('active');
        sellerOption.classList.remove('active');
        goToStep('step-customer-2');
    } else {
        sellerOption.classList.add('active');
        customerOption.classList.remove('active');
        goToStep('step-seller-2');
    }
}

function goFromCustomerStep2() {
    clearMsg('signupMsg');
    const name = document.getElementById('custNameInput').value.trim();
    const email = document.getElementById('custEmailInput').value.trim();

    if (!name) {
        showMsg('signupMsg', 'Please enter your full name.', 'error');
        return;
    }
    if (!email) {
        showMsg('signupMsg', 'Please enter your email address.', 'error');
        return;
    }
    clearMsg('signupMsg');
    goToStep('step-customer-3');
}

function goFromSellerStep2() {
    clearMsg('signupMsg');
    const shopName = document.getElementById('shopNameInput').value.trim();
    const ownerName = document.getElementById('ownerNameInput').value.trim();

    if (!shopName) {
        showMsg('signupMsg', 'Please enter your shop name.', 'error');
        return;
    }
    if (!ownerName) {
        showMsg('signupMsg', 'Please enter the shop owner\'s name.', 'error');
        return;
    }
    clearMsg('signupMsg');
    goToStep('step-seller-3');
}

function goFromSellerStep3() {
    clearMsg('signupMsg');
    const email = document.getElementById('sellerEmailInput').value.trim();
    const address = document.getElementById('sellerAddressInput').value.trim();

    if (!email) {
        showMsg('signupMsg', 'Please enter your email address.', 'error');
        return;
    }
    if (!address) {
        showMsg('signupMsg', 'Please enter your shop address.', 'error');
        return;
    }
    clearMsg('signupMsg');
    goToStep('step-seller-4');
}

function goFromSellerStep4() {
    clearMsg('signupMsg');
    const phone = document.getElementById('sellerPhoneInput').value.trim();

    if (!phone) {
        showMsg('signupMsg', 'Please enter your phone number.', 'error');
        return;
    }
    clearMsg('signupMsg');
    goToStep('step-seller-5');
}

function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showMsg(id, text, type) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'form-msg ' + type;
}

function clearMsg(id) {
    const el = document.getElementById(id);
    el.textContent = '';
    el.className = 'form-msg';
}

function friendlyAuthError(err) {
    const code = err && err.code;
    switch (code) {
        case 'auth/email-already-in-use': return 'An account with this email already exists. Try logging in instead.';
        case 'auth/invalid-email': return 'Please enter a valid email address.';
        case 'auth/weak-password': return 'Password should be at least 6 characters.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'Incorrect email or password.';
        case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
        default: return (err && err.message) || 'Something went wrong. Please try again.';
    }
}

function handleLogin(event) {
    event.preventDefault();
    clearMsg('loginMsg');

    if (!window.LGChem) {
        showMsg('loginMsg', 'Could not connect to the authentication service.', 'error');
        return;
    }

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginSubmitBtn');

    btn.disabled = true;
    btn.innerHTML = 'Logging in… <i class="fas fa-spinner fa-spin"></i>';

    window.LGChem.auth.signInWithEmailAndPassword(email, password)
        .then(function () {
            showMsg('loginMsg', 'Login successful! Redirecting…', 'success');
            setTimeout(function () {
                window.location.href = '../user/index.html';
            }, 700);
        })
        .catch(function (err) {
            showMsg('loginMsg', friendlyAuthError(err), 'error');
            btn.disabled = false;
            btn.innerHTML = 'Login <i class="fas fa-arrow-right"></i>';
        });
}

function handleSignup(event) {
    event.preventDefault();
    clearMsg('signupMsg');

    if (!window.LGChem) {
        showMsg('signupMsg', 'Could not connect to the authentication service.', 'error');
        return;
    }

    const accountType = document.getElementById('accountType').value;
    let name, email, address, phone, password, profile, btn;

    if (accountType === 'seller') {
        const shopName = document.getElementById('shopNameInput').value.trim();
        const ownerName = document.getElementById('ownerNameInput').value.trim();
        email = document.getElementById('sellerEmailInput').value.trim();
        address = document.getElementById('sellerAddressInput').value.trim();
        phone = document.getElementById('sellerPhoneInput').value.trim();
        const vatNo = document.getElementById('vatInput').value.trim();
        password = document.getElementById('sellerPasswordInput').value;
        btn = document.getElementById('sellerSubmitBtn');
        name = shopName;

        if (!password) {
            showMsg('signupMsg', 'Please create a password.', 'error');
            return;
        }

        profile = {
            accountType: 'seller',
            name: shopName,
            ownerName: ownerName,
            vatNo: vatNo || null,
            address: address,
            phone: phone
        };
    } else {
        name = document.getElementById('custNameInput').value.trim();
        email = document.getElementById('custEmailInput').value.trim();
        address = document.getElementById('custAddressInput').value.trim();
        phone = document.getElementById('custPhoneInput').value.trim();
        password = document.getElementById('custPasswordInput').value;
        btn = document.getElementById('customerSubmitBtn');

        if (!password) {
            showMsg('signupMsg', 'Please create a password.', 'error');
            return;
        }

        profile = {
            accountType: 'customer',
            name: name,
            address: address,
            phone: phone
        };
    }

    btn.disabled = true;
    btn.innerHTML = 'Creating account… <i class="fas fa-spinner fa-spin"></i>';

    window.LGChem.createAccount(email, password, profile)
        .then(function (result) {
            const session = {
                uid: result.uid,
                email: email,
                name: (result.profile && result.profile.name) || email,
                accountType: (result.profile && result.profile.accountType) || 'customer'
            };
            window.LGSession.set(session);

            showMsg('signupMsg', 'Account created successfully! Redirecting…', 'success');
            setTimeout(function () {
                window.location.href = '../user/index.html';
            }, 900);
        })
        .catch(function (err) {
            showMsg('signupMsg', friendlyAuthError(err), 'error');
            btn.disabled = false;
            btn.innerHTML = 'Create Account <i class="fas fa-user-plus"></i>';
        });
}

function handleForgotPassword() {
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) {
        showMsg('loginMsg', 'Enter your email above first, then click "Forgot Password?" again.', 'error');
        return;
    }
    if (!window.LGChem) return;

    window.LGChem.auth.sendPasswordResetEmail(email)
        .then(function () { showMsg('loginMsg', 'Password reset email sent. Check your inbox.', 'success'); })
        .catch(function (err) { showMsg('loginMsg', friendlyAuthError(err), 'error'); });
}

function initials(name) {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
}

function wireUserMenu() {
    const profileLink = document.getElementById('profileLink');
    const userMenu = document.getElementById('userMenu');
    const userChip = document.getElementById('userChip');
    const userDropdown = document.getElementById('userDropdown');
    const userAvatar = document.getElementById('userAvatar');
    const userNameLabel = document.getElementById('userNameLabel');
    const userTypeBadge = document.getElementById('userTypeBadge');
    const logoutBtn = document.getElementById('logoutBtn');

    userChip.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '../user/index.html';
    });

    logoutBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.LGChem.signOut().then(function () {
            window.LGSession.clear();
            window.location.reload();
        });
    });

    profileLink.addEventListener('click', function (e) {
        e.preventDefault();
        switchTab('login');
        document.getElementById('authFormsWrapper').scrollIntoView({ behavior: 'smooth' });
    });

    if (!window.LGSession) return;

    window.LGSession.onChange(function (session) {
        if (session) {
            profileLink.style.display = 'none';
            userMenu.style.display = 'flex';
            userAvatar.textContent = initials(session.name);
            userNameLabel.textContent = session.name;
            userTypeBadge.textContent = (session.accountType || 'customer').toUpperCase();
            refreshCartBadge(session.uid);
        } else {
            profileLink.style.display = 'inline-flex';
            userMenu.style.display = 'none';
            userDropdown.classList.remove('open');
            refreshCartBadge(null);
        }
    });
}

function refreshCartBadge(uid) {
    const badge = document.getElementById('cartBadge');
    if (!uid || !window.LGChem) {
        badge.textContent = '0';
        return;
    }
    window.LGChem.rtdb.ref('carts/' + uid).once('value')
        .then(function (snap) {
            const val = snap.val();
            const count = val ? Object.values(val).reduce(function (sum, item) { return sum + (item.qty || 1); }, 0) : 0;
            badge.textContent = count;
        })
        .catch(function (err) { console.error('Failed to load cart count:', err); });
}

function wireExistingSession() {
    if (!window.LGSession) return;

    window.LGSession.onChange(function (session) {
        const loggedInPanel = document.getElementById('loggedInPanel');
        const authFormsWrapper = document.getElementById('authFormsWrapper');

        if (session) {
            document.getElementById('loggedInAvatar').textContent = initials(session.name);
            document.getElementById('loggedInName').textContent = 'Welcome back, ' + session.name + '!';
            document.getElementById('loggedInEmail').textContent = session.email;
            loggedInPanel.style.display = 'block';
            authFormsWrapper.style.display = 'none';
        } else {
            loggedInPanel.style.display = 'none';
            authFormsWrapper.style.display = 'block';
        }
    });

    document.getElementById('loggedInLogoutBtn').addEventListener('click', function () {
        window.LGChem.signOut().then(function () {
            window.LGSession.clear();
            window.location.reload();
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    wireUserMenu();
    wireExistingSession();
});