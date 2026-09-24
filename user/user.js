// user/user.js
(function () {
  if (!window.LGChemAuth) {
    alert('App failed to initialize. Check the browser console.');
    return;
  }

  const { auth, requireAuth, getUserProfile, getCartItems, errInfo } = window.LGChemAuth;

  const loadingState = document.getElementById('loadingState');
  const accountContent = document.getElementById('accountContent');
  const avatarLg = document.getElementById('avatarLg');
  const displayName = document.getElementById('displayName');
  const emailText = document.getElementById('emailText');
  const accountTypeBadge = document.getElementById('accountTypeBadge');
  const accountTypeText = document.getElementById('accountTypeText');
  const nameLabelRow = document.getElementById('nameLabelRow');
  const nameIconRow = document.getElementById('nameIconRow');
  const nameText = document.getElementById('nameText');
  const emailRow = document.getElementById('emailRow');
  const phoneText = document.getElementById('phoneText');
  const locationText = document.getElementById('locationText');
  const uidText = document.getElementById('uidText');
  const createdText = document.getElementById('createdText');
  const signOutBtn = document.getElementById('signOutBtn');
  const cartContent = document.getElementById('cartContent');

  function fmtDate(ts) {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return '—'; }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  async function renderCart(userId) {
    const items = await getCartItems(userId);
    if (!items.length) {
      cartContent.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
      return;
    }
    const rows = items.map(i => `
      <div class="cart-item">
        <div>
          <div class="name">${escapeHtml(i.name)}</div>
          <div class="qty">Qty: ${i.quantity} × $${Number(i.price).toFixed(2)}</div>
        </div>
        <div class="price">$${(i.price * i.quantity).toFixed(2)}</div>
      </div>
    `).join('');
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    cartContent.innerHTML = `
      <div class="cart-list">${rows}</div>
      <div class="cart-total">
        <span>Total</span>
        <span class="total-value">$${total.toFixed(2)}</span>
      </div>
    `;
  }

  (async () => {
    let user;
    try {
      user = await requireAuth('../auth/index.html');
    } catch (e) {
      console.error('Auth check failed:', errInfo(e));
      return;
    }
    if (!user) return;

    const email = user.email || '';
    const profile = await getUserProfile(user.uid);
    const accountType = (profile && profile.accountType) || 'personal';
    const storedName = (profile && profile.fullName) || '';
    const phone = (profile && profile.phone) || '';
    const location = (profile && profile.location) || '';
    const createdAt = (profile && profile.createdAt) || null;

    let display = storedName;
    if (!display) display = email ? email.split('@')[0] : 'LG Chem User';

    const initial = (display || 'U').trim().charAt(0).toUpperCase();
    avatarLg.textContent = initial;
    displayName.textContent = display;
    emailText.textContent = email || 'No email';

    if (accountType === 'shopkeeper') {
      accountTypeBadge.className = 'account-type-badge shopkeeper';
      accountTypeText.textContent = 'Shop Keeper';
      accountTypeBadge.querySelector('i').className = 'fas fa-store';
      nameLabelRow.textContent = 'Shop name';
      nameIconRow.className = 'fas fa-store';
    } else {
      accountTypeBadge.className = 'account-type-badge personal';
      accountTypeText.textContent = 'Personal';
      accountTypeBadge.querySelector('i').className = 'fas fa-user';
      nameLabelRow.textContent = 'Full name';
      nameIconRow.className = 'fas fa-id-card';
    }
    nameText.textContent = storedName || '—';

    emailRow.textContent = email || '—';
    phoneText.textContent = phone || '—';
    locationText.textContent = location || '—';
    uidText.textContent = user.uid;
    createdText.textContent = createdAt
      ? fmtDate(createdAt)
      : fmtDate(user.metadata && user.metadata.creationTime);

    loadingState.style.display = 'none';
    accountContent.style.display = 'block';

    await renderCart(user.uid);

    signOutBtn.addEventListener('click', async () => {
      try {
        await auth.signOut();
        window.location.href = '../index.html';
      } catch (err) {
        console.error('Sign out error:', errInfo(err));
        alert('Could not sign out. Please try again.');
      }
    });
  })();
})();