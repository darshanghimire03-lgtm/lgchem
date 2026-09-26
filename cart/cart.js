const BASE = document.body.getAttribute('data-base') || '';

function initials(name) {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
}

function refreshCartBadge(uid) {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
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

function wireUserMenu() {
    const profileLink = document.getElementById('profileLink');
    const userMenu = document.getElementById('userMenu');
    const userChip = document.getElementById('userChip');
    const userDropdown = document.getElementById('userDropdown');
    const userAvatar = document.getElementById('userAvatar');
    const userNameLabel = document.getElementById('userNameLabel');
    const userTypeBadge = document.getElementById('userTypeBadge');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!profileLink || !userMenu || !userChip || !userDropdown) return;

    userChip.addEventListener('click', function () {
        userDropdown.classList.toggle('open');
    });

    profileLink.addEventListener('click', function (e) {
        if (window.LGSession && window.LGSession.isLoggedIn()) {
            e.preventDefault();
            window.location.href = BASE + 'user/index.html';
        }
    });

    document.addEventListener('click', function (e) {
        if (!userMenu.contains(e.target)) {
            userDropdown.classList.remove('open');
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            window.LGChem.signOut().then(function () {
                window.LGSession.clear();
                window.location.href = BASE + 'index.html';
            });
        });
    }

    if (!window.LGSession) return;

    function applySessionToNavbar(session) {
        if (session) {
            profileLink.style.display = 'none';
            userMenu.style.display = 'flex';
            if (userAvatar) userAvatar.textContent = initials(session.name);
            if (userNameLabel) userNameLabel.textContent = session.name;
            if (userTypeBadge) userTypeBadge.textContent = (session.accountType || 'customer').toUpperCase();
            refreshCartBadge(session.uid);
        } else {
            profileLink.style.display = 'inline-flex';
            userMenu.style.display = 'none';
            userDropdown.classList.remove('open');
            refreshCartBadge(null);
        }
    }

    applySessionToNavbar(window.LGSession.getCached());

    window.LGSession.onChange(function (session) {
        applySessionToNavbar(session);
    });
}

let currentCartUid = null;

function priceToNumber(priceStr) {
    if (!priceStr) return 0;
    const digits = String(priceStr).replace(/[^0-9.]/g, '');
    const n = parseFloat(digits);
    return isNaN(n) ? 0 : n;
}

function formatMoney(n) {
    return 'Rs. ' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function renderCartLoggedOutState() {
    const root = document.getElementById('cartRoot');
    if (!root) return;
    root.innerHTML = `
        <div class="state-panel">
            <i class="fas fa-user-lock"></i>
            <h3>Please log in to view your cart</h3>
            <p>Your cart is tied to your account so it's there whenever you come back.</p>
            <a href="${BASE}auth/index.html" class="shop-link"><i class="fas fa-right-to-bracket"></i> Log In</a>
        </div>
    `;
}

function renderCartEmptyState() {
    const root = document.getElementById('cartRoot');
    if (!root) return;
    root.innerHTML = `
        <div class="state-panel">
            <i class="fas fa-cart-shopping"></i>
            <h3>No cart products found</h3>
            <p>You haven't added anything to your cart yet. Start exploring our products.</p>
            <a href="${BASE}index.html#products" class="shop-link"><i class="fas fa-bag-shopping"></i> Shop Now</a>
        </div>
    `;
}

function renderCartErrorState() {
    const root = document.getElementById('cartRoot');
    if (!root) return;
    root.innerHTML = `
        <div class="state-panel">
            <i class="fas fa-triangle-exclamation"></i>
            <h3>Couldn't load your cart</h3>
            <p>Please refresh the page or try again in a moment.</p>
        </div>
    `;
}

function renderCart(items) {
    const root = document.getElementById('cartRoot');
    if (!root) return;

    if (!items || items.length === 0) {
        renderCartEmptyState();
        return;
    }

    let subtotal = 0;
    const itemsHtml = items.map(function (item) {
        const lineTotal = priceToNumber(item.price) * (item.qty || 1);
        subtotal += lineTotal;
        return `
            <div class="cart-item" data-key="${item.key}">
                <img src="${item.image || 'https://via.placeholder.com/100x100?text=No+Image'}" alt="${item.name}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
                <div class="cart-item-info">
                    <div class="cart-item-category">${item.category || ''}</div>
                    <div class="cart-item-name">${item.name || 'Unnamed product'}</div>
                    <div class="cart-item-price">${item.price || ''} <span class="cart-item-unit">${item.unit || ''}</span></div>
                    <div class="qty-controls">
                        <button class="qty-btn" data-action="dec" data-key="${item.key}">−</button>
                        <span class="qty-value">${item.qty || 1}</span>
                        <button class="qty-btn" data-action="inc" data-key="${item.key}">+</button>
                    </div>
                </div>
                <button class="remove-btn" data-action="remove" data-key="${item.key}" aria-label="Remove item">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');

    root.innerHTML = `
        <div class="cart-layout">
            <div class="cart-items">${itemsHtml}</div>
            <div class="summary-card">
                <h3>Order Summary</h3>
                <div class="summary-row">
                    <span>Items</span>
                    <span>${items.reduce(function (s, i) { return s + (i.qty || 1); }, 0)}</span>
                </div>
                <div class="summary-row total">
                    <span>Estimated Total</span>
                    <span>${formatMoney(subtotal)}</span>
                </div>
                <p class="summary-note">Final pricing, delivery charges, and business/bulk discounts are confirmed at checkout.</p>
                <button class="checkout-btn" id="checkoutBtn">
                    Proceed to Checkout <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;

    wireCartItemControls();

    document.getElementById('checkoutBtn').addEventListener('click', function () {
        alert('Checkout isn\'t connected yet — this is where order placement will go.');
    });
}

function wireCartItemControls() {
    document.querySelectorAll('.qty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const key = btn.getAttribute('data-key');
            const action = btn.getAttribute('data-action');
            changeCartQty(key, action === 'inc' ? 1 : -1);
        });
    });

    document.querySelectorAll('.remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const key = btn.getAttribute('data-key');
            removeCartItem(key);
        });
    });
}

function cartItemRef(key) {
    return window.LGChem.rtdb.ref('carts/' + currentCartUid + '/' + key);
}

function changeCartQty(key, delta) {
    const ref = cartItemRef(key);
    ref.once('value').then(function (snap) {
        const item = snap.val();
        if (!item) return;
        const newQty = (item.qty || 1) + delta;
        if (newQty <= 0) {
            return ref.remove();
        }
        return ref.update({ qty: newQty });
    }).catch(function (err) { console.error('Failed to update quantity:', err); });
}

function removeCartItem(key) {
    cartItemRef(key).remove().catch(function (err) { console.error('Failed to remove item:', err); });
}

function loadCart(uid) {
    const root = document.getElementById('cartRoot');
    if (!root) return;

    if (!window.LGChem || !window.LGChem.rtdb) {
        renderCartErrorState();
        return;
    }

    window.LGChem.rtdb.ref('carts/' + uid).on('value', function (snapshot) {
        const val = snapshot.val();
        const items = val
            ? Object.keys(val).map(function (key) { return Object.assign({ key: key }, val[key]); })
            : [];
        renderCart(items);
        updateCartBadge(items);
    }, function (err) {
        console.error('Failed to load cart:', err);
        renderCartErrorState();
    });
}

function updateCartBadge(items) {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const count = items.reduce(function (sum, item) { return sum + (item.qty || 1); }, 0);
    badge.textContent = count;
}

function wireCartPage() {
    const root = document.getElementById('cartRoot');
    if (!root) return;

    if (!window.LGSession) return;

    window.LGSession.onChange(function (session) {
        if (session) {
            if (currentCartUid !== session.uid) {
                currentCartUid = session.uid;
                loadCart(currentCartUid);
            }
        } else {
            if (currentCartUid && window.LGChem) {
                window.LGChem.rtdb.ref('carts/' + currentCartUid).off();
            }
            currentCartUid = null;
            const badge = document.getElementById('cartBadge');
            if (badge) badge.textContent = '0';
            renderCartLoggedOutState();
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    wireUserMenu();
    wireCartPage();
});