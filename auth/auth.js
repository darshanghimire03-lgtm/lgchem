// auth/auth.js
(function () {
  console.log('📦 [auth/auth.js] starting…');

  // ---------- Guard: ensure Firebase + helpers are ready ----------
  if (!window.LGChemAuth) {
    const reason = window.LGChemInitError || 'auth-helpers.js failed to initialize.';
    console.error('❌ Cannot start auth page:', reason);
    const msg = document.getElementById('msgBox');
    const txt = document.getElementById('msgText');
    if (msg && txt) {
      txt.textContent = 'App failed to initialize: ' + reason + ' — open browser console (F12) for details.';
      msg.className = 'msg error';
      msg.classList.remove('hidden');
    }
    return;
  }

  const auth = window.LGChemAuth.auth;
  const redirectIfAuthed = window.LGChemAuth.redirectIfAuthed;
  const friendlyAuthError = window.LGChemAuth.friendlyAuthError;
  const saveUserProfile = window.LGChemAuth.saveUserProfile;
  const errInfo = window.LGChemAuth.errInfo;

  if (!auth || typeof auth.signInWithEmailAndPassword !== 'function') {
    console.error('❌ auth instance is missing or incomplete.');
    return;
  }

  // If user is already signed in, send them to profile
  redirectIfAuthed('../user/index.html');

  // ---------- DOM ----------
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const formTitle = document.getElementById('formTitle');
  const formSub = document.getElementById('formSub');
  const authForm = document.getElementById('authForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitText');
  const submitIcon = document.getElementById('submitIcon');
  const msgBox = document.getElementById('msgBox');
  const msgText = document.getElementById('msgText');
  const switchHintText = document.getElementById('switchHintText');
  const switchBtn = document.getElementById('switchBtn');

  const signupOnlyEls = document.querySelectorAll('.signup-only');
  const fullNameInput = document.getElementById('fullName');
  const phoneInput = document.getElementById('phone');
  const locationInput = document.getElementById('location');
  const termsCheck = document.getElementById('termsCheck');
  const nameLabel = document.getElementById('nameLabel');
  const nameIcon = document.getElementById('nameIcon');

  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');

  let mode = 'signin';

  // ---------- UI helpers ----------
  function showMessage(text, type) {
    if (!msgBox || !msgText) { alert(text); return; }
    msgText.textContent = text;
    msgBox.className = 'msg ' + type;
    msgBox.classList.remove('hidden');
  }
  function hideMessage() { if (msgBox) msgBox.classList.add('hidden'); }

  function showLoading(text) {
    if (loadingText) loadingText.textContent = text || 'Please wait…';
    if (loadingOverlay) loadingOverlay.classList.add('show');
  }
  function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('show');
  }

  function updateNameFieldForAccountType() {
    const checked = document.querySelector('input[name="accountType"]:checked');
    if (!checked || !nameLabel || !fullNameInput || !nameIcon) return;
    if (checked.value === 'shopkeeper') {
      nameLabel.textContent = 'Shop name';
      fullNameInput.placeholder = 'My Shop Name';
      nameIcon.className = 'fas fa-store field-icon';
    } else {
      nameLabel.textContent = 'Full name';
      fullNameInput.placeholder = 'John Doe';
      nameIcon.className = 'fas fa-user field-icon';
    }
  }

  function setMode(newMode) {
    mode = newMode;
    hideMessage();
    authForm.reset();

    const personalRadio = document.querySelector('input[name="accountType"][value="personal"]');
    if (personalRadio) personalRadio.checked = true;
    updateNameFieldForAccountType();

    if (mode === 'signin') {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      formTitle.textContent = 'Welcome back';
      formSub.textContent = 'Sign in to your LG Chem account';
      submitText.textContent = 'Sign In';
      submitIcon.className = 'fas fa-sign-in-alt';
      passwordInput.setAttribute('autocomplete', 'current-password');
      switchHintText.textContent = "Don't have an account?";
      switchBtn.textContent = 'Sign up';
      signupOnlyEls.forEach((el) => el.classList.remove('show'));
    } else {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      formTitle.textContent = 'Create your account';
      formSub.textContent = 'Join LG Chem to start shopping';
      submitText.textContent = 'Sign Up';
      submitIcon.className = 'fas fa-user-plus';
      passwordInput.setAttribute('autocomplete', 'new-password');
      switchHintText.textContent = 'Already have an account?';
      switchBtn.textContent = 'Sign in';
      signupOnlyEls.forEach((el) => el.classList.add('show'));
    }
  }

  // ---------- Event bindings ----------
  tabSignIn.addEventListener('click', () => setMode('signin'));
  tabSignUp.addEventListener('click', () => setMode('signup'));
  switchBtn.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));

  document.querySelectorAll('input[name="accountType"]').forEach((radio) => {
    radio.addEventListener('change', updateNameFieldForAccountType);
  });

  // ---------- Submit handler ----------
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) { showMessage('Please enter your email address.', 'error'); return; }
    if (!password) { showMessage('Please enter your password.', 'error'); return; }
    if (password.length < 6) { showMessage('Password must be at least 6 characters.', 'error'); return; }

    let fullName = '', phone = '', location = '', accountType = 'personal';
    if (mode === 'signup') {
      const checkedType = document.querySelector('input[name="accountType"]:checked');
      accountType = checkedType ? checkedType.value : 'personal';
      fullName = fullNameInput.value.trim();
      phone = phoneInput.value.trim();
      location = locationInput.value.trim();

      if (!fullName) {
        showMessage(accountType === 'shopkeeper' ? 'Please enter your shop name.' : 'Please enter your full name.', 'error');
        return;
      }
      if (!phone) { showMessage('Please enter your phone number.', 'error'); return; }
      if (!location) { showMessage('Please enter your location.', 'error'); return; }
      if (!termsCheck.checked) { showMessage('Please accept the Terms & Privacy Policy.', 'error'); return; }
    }

    submitBtn.disabled = true;
    const originalText = submitText.textContent;
    submitText.textContent = mode === 'signin' ? 'Signing in…' : 'Creating account…';
    showLoading(mode === 'signin' ? 'Signing you in…' : 'Creating your account…');

    try {
      if (mode === 'signin') {
        console.log('🔐 Sign in:', email);
        const cred = await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Sign in success:', cred.user.uid);
        // Redirect via auth state — safer than navigating immediately
        setTimeout(() => { window.location.href = '../user/index.html'; }, 300);
        return;
      }

      // ---------- SIGNUP ----------
      console.log('📝 Sign up:', email);
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const user = cred.user;
      console.log('✅ Sign up success:', user.uid);

      // Save profile to RTDB (no password)
      try {
        await saveUserProfile(user.uid, { fullName, email, phone, location, accountType });
        console.log('✅ Profile saved to RTDB');
      } catch (rtdbErr) {
        const info = errInfo(rtdbErr);
        console.error('⚠️ RTDB save failed:', info);
        showMessage('Account created but profile save failed: ' + info.message, 'error');
        hideLoading();
        submitBtn.disabled = false;
        submitText.textContent = originalText;
        setTimeout(() => { window.location.href = '../user/index.html'; }, 2500);
        return;
      }

      // Redirect to profile
      setTimeout(() => { window.location.href = '../user/index.html'; }, 300);

    } catch (err) {
      const info = errInfo(err);
      console.error('❌ Auth error:', info);
      showMessage(friendlyAuthError(info.code, info.message), 'error');
      hideLoading();
      submitBtn.disabled = false;
      submitText.textContent = originalText;
    }
  });

  // ---------- Init ----------
  setMode('signin');
  updateNameFieldForAccountType();
  console.log('✅ [auth/auth.js] ready');
})();