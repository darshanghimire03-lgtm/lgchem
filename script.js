const BASE = document.body.getAttribute('data-base') || '';

function initials(name) {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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

function renderProducts(products) {
    const gridContainer = document.getElementById('productGrid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    if (!products || products.length === 0) {
        gridContainer.innerHTML = `
            <div class="empty-text">
                <i class="fas fa-flask"></i>
                No products available right now. Please check back soon.
            </div>`;
        return;
    }

    products.forEach(function (product) {
        const card = document.createElement('div');
        card.classList.add('product-card');

        card.innerHTML = `
            <img src="${product.image || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${product.name || ''}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            <div class="product-info">
                <div class="product-category">${product.category || ''}</div>
                <div class="product-name">${product.name || 'Unnamed product'}</div>
                <div class="product-price-row">
                    <div>
                        <div class="product-price">${product.price || ''}</div>
                        <div class="product-unit">${product.unit || ''}</div>
                    </div>
                    <button class="add-to-cart-btn" data-key="${product.key || ''}">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                </div>
            </div>
        `;

        const addBtn = card.querySelector('.add-to-cart-btn');
        addBtn.addEventListener('click', function () { addToCart(product); });

        gridContainer.appendChild(card);
    });
}

function loadProductsFromFirebase() {
    const gridContainer = document.getElementById('productGrid');
    if (!gridContainer) return;

    if (!window.LGChem || !window.LGChem.rtdb) {
        gridContainer.innerHTML =
            '<div class="empty-text"><i class="fas fa-triangle-exclamation"></i>Could not connect to the store database.</div>';
        return;
    }

    window.LGChem.rtdb.ref('products').once('value')
        .then(function (snapshot) {
            const val = snapshot.val();
            const products = val
                ? Object.keys(val).map(function (key) { return Object.assign({ key: key }, val[key]); })
                : [];
            renderProducts(products);
        })
        .catch(function (err) {
            console.error('Failed to load products:', err);
            gridContainer.innerHTML =
                '<div class="empty-text"><i class="fas fa-triangle-exclamation"></i>Failed to load products. Please try again later.</div>';
        });
}

function addToCart(product) {
    const uid = window.LGSession && window.LGSession.getUserId();

    if (!uid) {
        alert('Please log in to add items to your cart.');
        window.location.href = BASE + 'auth/index.html';
        return;
    }

    if (!product.key) {
        console.error('Product is missing a key, cannot add to cart:', product);
        return;
    }

    const cartItemRef = window.LGChem.rtdb.ref('carts/' + uid + '/' + product.key);
    cartItemRef.once('value').then(function (snap) {
        const existing = snap.val();
        const newQty = (existing && existing.qty ? existing.qty : 0) + 1;
        return cartItemRef.set({
            productKey: product.key,
            name: product.name || 'Unnamed product',
            category: product.category || '',
            price: product.price || '',
            unit: product.unit || '',
            image: product.image || '',
            qty: newQty
        });
    }).catch(function (err) { console.error('Failed to add to cart:', err); });
}

function renderSkeletonState() {
    const root = document.getElementById('accountRoot');
    if (!root) return;
    root.innerHTML = `
        <div class="skeleton-header">
            <div class="skeleton skeleton-avatar-lg"></div>
            <div class="skeleton-header-lines">
                <div class="skeleton skeleton-line w-60"></div>
                <div class="skeleton skeleton-line w-40"></div>
                <div class="skeleton skeleton-line w-30"></div>
            </div>
        </div>
        <div class="details-card">
            <div class="skeleton skeleton-line w-40" style="height:20px;"></div>
            <div class="skeleton-detail-row">
                <div class="skeleton skeleton-line label"></div>
                <div class="skeleton skeleton-line value"></div>
            </div>
            <div class="skeleton-detail-row">
                <div class="skeleton skeleton-line label"></div>
                <div class="skeleton skeleton-line value"></div>
            </div>
            <div class="skeleton-detail-row">
                <div class="skeleton skeleton-line label"></div>
                <div class="skeleton skeleton-line value"></div>
            </div>
            <div class="skeleton-detail-row">
                <div class="skeleton skeleton-line label"></div>
                <div class="skeleton skeleton-line value"></div>
            </div>
        </div>
        <div class="details-card">
            <div class="skeleton skeleton-line w-40" style="height:20px;"></div>
            <div class="skeleton-actions">
                <div class="skeleton skeleton-btn"></div>
                <div class="skeleton skeleton-btn"></div>
                <div class="skeleton skeleton-btn"></div>
            </div>
        </div>
    `;
}

function renderLoggedOutState() {
    const root = document.getElementById('accountRoot');
    if (!root) return;
    root.innerHTML = `
        <div class="state-panel">
            <i class="fas fa-user-lock"></i>
            <h3>Please log in to view your account</h3>
            <p>Sign in to see your saved details, orders, and account settings.</p>
            <a href="${BASE}auth/index.html" class="shop-link"><i class="fas fa-right-to-bracket"></i> Log In / Sign Up</a>
        </div>
    `;
}

function runDiagnostics() {
    const diags = [];
    diags.push({ label: 'Firebase SDK loaded (firebase object exists)', ok: typeof firebase !== 'undefined' });
    diags.push({ label: 'firebase-config.js ran without error (window.LGChem exists)', ok: !!window.LGChem });
    diags.push({ label: 'window.LGChem.auth exists', ok: !!(window.LGChem && window.LGChem.auth) });
    diags.push({ label: 'window.LGChem.rtdb exists', ok: !!(window.LGChem && window.LGChem.rtdb) });
    diags.push({ label: 'session.js loaded (window.LGSession exists)', ok: !!window.LGSession });
    if (window.LGChemInitError) {
        diags.push({ label: 'Firebase init error: ' + window.LGChemInitError, ok: false });
    }
    return diags;
}

function renderErrorState(err, diagnostics) {
    const root = document.getElementById('accountRoot');
    if (!root) return;
    const detail = err ? (err.code ? (err.code + ': ' + (err.message || '')) : (err.message || String(err))) : 'Unknown error';
    let diagHtml = '';
    if (diagnostics && diagnostics.length) {
        diagHtml = '<div class="diag-list">' + diagnostics.map(function (d) {
            return '<div class="' + (d.ok ? 'diag-ok' : 'diag-bad') + '"><i class="fas ' + (d.ok ? 'fa-circle-check' : 'fa-circle-xmark') + '"></i> ' + escapeHtml(d.label) + '</div>';
        }).join('') + '</div>';
    }
    root.innerHTML = `
        <div class="state-panel">
            <i class="fas fa-triangle-exclamation"></i>
            <h3>Couldn't load your account</h3>
            <p>Here is exactly what failed:</p>
            ${diagHtml}
            <pre>${escapeHtml(detail)}</pre>
            <a href="#" class="shop-link" onclick="location.reload(); return false;"><i class="fas fa-rotate-right"></i> Retry</a>
        </div>
    `;
}

function renderAccount(uid, email, displayNameFromAuth, profile) {
    const root = document.getElementById('accountRoot');
    if (!root) return;

    const accountType = (profile && profile.accountType) || 'customer';
    const isSeller = accountType === 'seller';
    const displayName = (profile && profile.name) || displayNameFromAuth || email;

    const nameFieldLabel = isSeller ? 'Shop Name' : 'Full Name';
    const nameFieldIcon = isSeller ? 'fa-store' : 'fa-user';

    let detailsHtml = `
        <div class="detail-row">
            <span class="detail-label"><i class="fas ${nameFieldIcon}"></i> ${nameFieldLabel}</span>
            <span class="detail-value">${escapeHtml(displayName) || '<span class=\'muted\'>Not set</span>'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-envelope"></i> Email</span>
            <span class="detail-value">${escapeHtml(email)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-phone"></i> Phone</span>
            <span class="detail-value">${profile && profile.phone ? escapeHtml(profile.phone) : '<span class="detail-value muted">Not set</span>'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-map-marker-alt"></i> Address</span>
            <span class="detail-value">${profile && profile.address ? escapeHtml(profile.address) : '<span class="detail-value muted">Not set</span>'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-fingerprint"></i> User ID</span>
            <span class="detail-value">${escapeHtml(uid)}</span>
        </div>
    `;

    if (isSeller) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-id-badge"></i> Shop Owner Name</span>
                <span class="detail-value">${profile && profile.ownerName ? escapeHtml(profile.ownerName) : '<span class="detail-value muted">Not set</span>'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-file-invoice"></i> VAT No.</span>
                <span class="detail-value">${profile && profile.vatNo ? escapeHtml(profile.vatNo) : '<span class="detail-value muted">Not provided</span>'}</span>
            </div>
        `;
    }

    const createdAt = profile && profile.createdAt ? new Date(profile.createdAt) : null;
    const createdAtLabel = createdAt && !isNaN(createdAt)
        ? createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    root.innerHTML = `
        <div class="account-header">
            <div class="account-avatar-lg">${initials(displayName)}</div>
            <div class="account-header-info">
                <h2>${escapeHtml(displayName)}</h2>
                <p>${escapeHtml(email)}</p>
                <span class="account-type-pill">
                    <i class="fas ${isSeller ? 'fa-store' : 'fa-user'}"></i> ${accountType.toUpperCase()} ACCOUNT
                </span>
            </div>
        </div>

        <div class="details-card">
            <h3><i class="fas fa-address-card"></i> Account Details</h3>
            ${detailsHtml}
            ${createdAtLabel ? `
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-calendar-check"></i> Member Since</span>
                <span class="detail-value">${createdAtLabel}</span>
            </div>` : ''}
        </div>

        <div class="details-card">
            <h3><i class="fas fa-gear"></i> Account Actions</h3>
            <div class="actions-row">
                <a href="${BASE}cart/index.html" class="btn-outline"><i class="fas fa-shopping-cart"></i> View Cart</a>
                <button class="btn-outline" id="resetPasswordBtn" type="button"><i class="fas fa-key"></i> Reset Password</button>
                <button class="btn-danger-outline" id="accountLogoutBtn" type="button"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>
        </div>
    `;

    document.getElementById('resetPasswordBtn').addEventListener('click', function () {
        window.LGChem.auth.sendPasswordResetEmail(email)
            .then(function () { alert('Password reset email sent to ' + email); })
            .catch(function (err) { alert('Could not send reset email: ' + (err.message || err)); });
    });

    document.getElementById('accountLogoutBtn').addEventListener('click', function () {
        window.LGChem.signOut().then(function () {
            window.LGSession.clear();
            window.location.href = BASE + 'index.html';
        });
    });
}

let loadToken = 0;

function loadAccountForSession(session) {
    const root = document.getElementById('accountRoot');
    if (!root) return;

    const myToken = ++loadToken;
    renderSkeletonState();

    const diags = runDiagnostics();
    const hasFailure = diags.some(function (d) { return !d.ok; });
    if (hasFailure) {
        renderErrorState({ message: 'One or more required scripts failed to load or initialize.' }, diags);
        return;
    }

    window.LGChem.rtdb.ref('users/' + session.uid).once('value')
        .then(function (snap) {
            if (myToken !== loadToken) return;
            const profile = snap.val();
            if (!profile) {
                renderErrorState(
                    { message: 'The database read succeeded but returned no data at users/' + session.uid + '. Either the profile was never saved at signup, or your Realtime Database rules are silently blocking this read.' },
                    diags
                );
                return;
            }
            renderAccount(session.uid, session.email, session.name, profile);
        })
        .catch(function (err) {
            if (myToken !== loadToken) return;
            console.error('Failed to load profile from users/' + session.uid, err);
            renderErrorState(err, diags);
        });
}

function wireUserPage() {
    const root = document.getElementById('accountRoot');
    if (!root) return;

    if (!window.LGSession) {
        renderErrorState({ message: 'session.js did not load. Check the script tag path session.js and that the file was uploaded.' }, runDiagnostics());
        return;
    }

    window.LGSession.onChange(function (session, confirmed) {
        if (session) {
            loadAccountForSession(session);
        } else if (confirmed) {
            renderLoggedOutState();
        } else {
            renderSkeletonState();
        }
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
    loadProductsFromFirebase();
    wireUserPage();
    wireCartPage();
});