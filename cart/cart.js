const BASE = document.body.getAttribute('data-base') || '';

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

    if (!profileLink || !userMenu || !userChip || !userDropdown) return;

    userChip.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = BASE + 'user/index.html';
    });

    profileLink.addEventListener('click', function (e) {
        if (window.LGSession && window.LGSession.isLoggedIn()) {
            e.preventDefault();
            window.location.href = BASE + 'user/index.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.stopPropagation();
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
        } else {
            profileLink.style.display = 'inline-flex';
            userMenu.style.display = 'none';
            userDropdown.classList.remove('open');
        }
    }

    applySessionToNavbar(window.LGSession.getCached());

    window.LGSession.onChange(function (session) {
        applySessionToNavbar(session);
    });
}

let currentCartUid = null;
let cartItems = [];
let cartView = 'cart';
let selectedPayment = 'cash';
let checkoutDraft = { name: '', phone: '', address: '' };
let placing = false;

function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function priceToNumber(priceStr) {
    if (!priceStr) return 0;
    const digits = String(priceStr).replace(/[^0-9.]/g, '');
    const n = parseFloat(digits);
    return isNaN(n) ? 0 : n;
}

function formatMoney(n) {
    return 'Rs. ' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function cartSubtotal(items) {
    return items.reduce(function (sum, item) {
        return sum + priceToNumber(item.price) * (Number(item.qty) || 1);
    }, 0);
}

function cartTotalQty(items) {
    return items.reduce(function (sum, item) {
        return sum + (Number(item.qty) || 1);
    }, 0);
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

    const itemsHtml = items.map(function (item) {
        return `
            <div class="cart-item" data-key="${escapeHtml(item.key)}">
                <img src="${escapeHtml(item.image) || 'https://via.placeholder.com/100x100?text=No+Image'}" alt="${escapeHtml(item.name)}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
                <div class="cart-item-info">
                    <div class="cart-item-category">${escapeHtml(item.category)}</div>
                    <div class="cart-item-name">${escapeHtml(item.name || 'Unnamed product')}</div>
                    <div class="cart-item-price">${escapeHtml(item.price)} <span class="cart-item-unit">${escapeHtml(item.unit)}</span></div>
                    <div class="qty-controls">
                        <button class="qty-btn" data-action="dec" data-key="${escapeHtml(item.key)}">−</button>
                        <span class="qty-value" data-qty-for="${escapeHtml(item.key)}">${item.qty || 1}</span>
                        <button class="qty-btn" data-action="inc" data-key="${escapeHtml(item.key)}">+</button>
                    </div>
                </div>
                <button class="remove-btn" data-action="remove" data-key="${escapeHtml(item.key)}" aria-label="Remove item">
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
                    <span>${cartTotalQty(items)}</span>
                </div>
                <div class="summary-row total">
                    <span>Estimated Total</span>
                    <span>${formatMoney(cartSubtotal(items))}</span>
                </div>
                <p class="summary-note">Final pricing, delivery charges, and business/bulk discounts are confirmed at checkout.</p>
                <button class="checkout-btn" id="checkoutBtn">
                    Proceed to Checkout <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;

    wireCartItemControls();

    document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
}

function openCheckout() {
    if (!cartItems.length || !currentCartUid) return;
    const root = document.getElementById('cartRoot');
    cartView = 'checkout';
    root.innerHTML = `
        <div class="state-panel">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Preparing checkout…</h3>
        </div>
    `;

    const session = window.LGSession ? window.LGSession.getCached() : null;
    const profilePromise = window.LGChem && window.LGChem.getUserProfile
        ? window.LGChem.getUserProfile(currentCartUid).catch(function () { return null; })
        : Promise.resolve(null);

    profilePromise.then(function (profile) {
        if (cartView !== 'checkout') return;
        if (!checkoutDraft.name && !checkoutDraft.phone && !checkoutDraft.address) {
            checkoutDraft = {
                name: (profile && profile.name) || (session && session.name) || '',
                phone: (profile && profile.phone) || '',
                address: (profile && profile.address) || ''
            };
        }
        renderCheckout();
    });
}

function readDraftFromForm() {
    const nameEl = document.getElementById('coName');
    const phoneEl = document.getElementById('coPhone');
    const addressEl = document.getElementById('coAddress');
    if (nameEl) checkoutDraft.name = nameEl.value.trim();
    if (phoneEl) checkoutDraft.phone = phoneEl.value.trim();
    if (addressEl) checkoutDraft.address = addressEl.value.trim();
}

function renderCheckout() {
    const root = document.getElementById('cartRoot');
    if (!root) return;

    if (!cartItems.length) {
        cartView = 'cart';
        renderCartEmptyState();
        return;
    }

    const itemsHtml = cartItems.map(function (item) {
        const qty = Number(item.qty) || 1;
        const line = priceToNumber(item.price) * qty;
        return `
            <div class="co-item">
                <img src="${escapeHtml(item.image) || 'https://via.placeholder.com/100x100?text=No+Image'}" alt="" class="co-item-image" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
                <div class="co-item-info">
                    <div class="co-item-name">${escapeHtml(item.name || 'Unnamed product')}</div>
                    <div class="co-item-meta">${escapeHtml(item.price)} ${escapeHtml(item.unit)} × ${qty}</div>
                </div>
                <div class="co-item-total">${formatMoney(line)}</div>
            </div>
        `;
    }).join('');

    root.innerHTML = `
        <div class="cart-layout">
            <div class="checkout-main">
                <div class="co-card">
                    <h3><i class="fas fa-location-dot"></i> Delivery Details</h3>
                    <div class="co-field">
                        <label for="coName">Full Name</label>
                        <input type="text" id="coName" value="${escapeHtml(checkoutDraft.name)}" placeholder="Your full name" autocomplete="name">
                    </div>
                    <div class="co-field">
                        <label for="coPhone">Phone Number</label>
                        <input type="tel" id="coPhone" value="${escapeHtml(checkoutDraft.phone)}" placeholder="Your phone number" autocomplete="tel">
                    </div>
                    <div class="co-field">
                        <label for="coAddress">Delivery Address</label>
                        <textarea id="coAddress" rows="3" placeholder="Your full delivery address">${escapeHtml(checkoutDraft.address)}</textarea>
                    </div>
                </div>

                <div class="co-card">
                    <h3><i class="fas fa-wallet"></i> Payment Method</h3>
                    <label class="pay-option ${selectedPayment === 'cash' ? 'selected' : ''}">
                        <input type="radio" name="payment" value="cash" ${selectedPayment === 'cash' ? 'checked' : ''}>
                        <i class="fas fa-money-bill-wave"></i>
                        <span><strong>Cash</strong><small>Pay when your order is delivered</small></span>
                    </label>
                    <label class="pay-option ${selectedPayment === 'online' ? 'selected' : ''}">
                        <input type="radio" name="payment" value="online" ${selectedPayment === 'online' ? 'checked' : ''}>
                        <i class="fas fa-credit-card"></i>
                        <span><strong>Online</strong><small>Pay online</small></span>
                    </label>
                </div>

                <div class="co-card">
                    <h3><i class="fas fa-box"></i> Your Items</h3>
                    ${itemsHtml}
                </div>
            </div>

            <div class="summary-card">
                <h3>Confirm Order</h3>
                <div class="summary-row">
                    <span>Items</span>
                    <span>${cartTotalQty(cartItems)}</span>
                </div>
                <div class="summary-row total">
                    <span>Total</span>
                    <span>${formatMoney(cartSubtotal(cartItems))}</span>
                </div>
                <div class="co-error" id="coError"></div>
                <button class="checkout-btn" id="confirmOrderBtn">
                    <i class="fas fa-circle-check"></i> Confirm Order
                </button>
                <button class="back-btn" id="backToCartBtn">
                    <i class="fas fa-arrow-left"></i> Back to Cart
                </button>
            </div>
        </div>
    `;

    document.querySelectorAll('input[name="payment"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            selectedPayment = radio.value;
            document.querySelectorAll('.pay-option').forEach(function (opt) {
                const input = opt.querySelector('input');
                opt.classList.toggle('selected', input.checked);
            });
        });
    });

    document.getElementById('backToCartBtn').addEventListener('click', function () {
        readDraftFromForm();
        cartView = 'cart';
        renderCart(cartItems);
    });

    document.getElementById('confirmOrderBtn').addEventListener('click', placeOrder);
}

function showCheckoutError(message) {
    const el = document.getElementById('coError');
    if (el) el.textContent = message;
}

function placeOrder() {
    if (placing) return;
    readDraftFromForm();

    if (!checkoutDraft.name) { showCheckoutError('Please enter your full name.'); return; }
    if (!checkoutDraft.phone) { showCheckoutError('Please enter your phone number.'); return; }
    if (!checkoutDraft.address) { showCheckoutError('Please enter your delivery address.'); return; }
    if (!cartItems.length || !currentCartUid) { showCheckoutError('Your cart is empty.'); return; }
    if (!window.LGChem || !window.LGChem.rtdb) { showCheckoutError('Could not connect to the database.'); return; }

    placing = true;
    showCheckoutError('');
    const btn = document.getElementById('confirmOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing order…';

    const db = window.LGChem.rtdb;
    const uid = currentCartUid;
    const orderId = db.ref('orders').push().key;

    const items = {};
    cartItems.forEach(function (item) {
        items[item.key] = {
            productId: item.key,
            name: item.name || 'Unnamed product',
            price: item.price || '',
            unit: item.unit || '',
            qty: Number(item.qty) || 1
        };
    });

    const order = {
        orderId: orderId,
        uid: uid,
        items: items,
        status: 'pending',
        payment: selectedPayment,
        total: cartSubtotal(cartItems),
        customerName: checkoutDraft.name,
        phone: checkoutDraft.phone,
        address: checkoutDraft.address,
        createdAt: new Date().toISOString()
    };

    const updates = {};
    updates['orders/' + orderId] = order;
    updates['carts/' + uid] = null;

    db.ref().update(updates)
        .then(function () {
            cartView = 'placed';
            placing = false;
            renderOrderPending(order);
        })
        .catch(function (err) {
            console.error('Failed to place order:', err);
            placing = false;
            const b = document.getElementById('confirmOrderBtn');
            if (b) {
                b.disabled = false;
                b.innerHTML = '<i class="fas fa-circle-check"></i> Confirm Order';
            }
            showCheckoutError('Could not place your order. Please try again.');
        });
}

function renderOrderPending(order) {
    const root = document.getElementById('cartRoot');
    if (!root) return;

    const itemsHtml = Object.keys(order.items).map(function (key) {
        const i = order.items[key];
        return `
            <div class="pending-item">
                <span>${escapeHtml(i.name)}</span>
                <span>× ${i.qty}</span>
            </div>
        `;
    }).join('');

    root.innerHTML = `
        <div class="pending-card">
            <div class="pending-icon"><i class="fas fa-hourglass-half"></i></div>
            <h3>Order Placed</h3>
            <span class="status-pill">Pending</span>
            <p class="pending-note">Thank you, ${escapeHtml(order.customerName)}. We've received your order and it is waiting for confirmation.</p>

            <div class="pending-details">
                <div class="summary-row"><span>Order ID</span><span class="mono">${escapeHtml(order.orderId)}</span></div>
                <div class="summary-row"><span>Status</span><span>Pending</span></div>
                <div class="summary-row"><span>Payment</span><span>${order.payment === 'cash' ? 'Cash' : 'Online'}</span></div>
                <div class="summary-row"><span>Phone</span><span>${escapeHtml(order.phone)}</span></div>
                <div class="summary-row"><span>Address</span><span class="right">${escapeHtml(order.address)}</span></div>
                <div class="pending-items">${itemsHtml}</div>
                <div class="summary-row total"><span>Total</span><span>${formatMoney(order.total)}</span></div>
            </div>

            <a href="${BASE}index.html#products" class="shop-link"><i class="fas fa-bag-shopping"></i> Continue Shopping</a>
        </div>
    `;
}

function wireCartItemControls() {
    document.querySelectorAll('.qty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            const key = btn.getAttribute('data-key');
            const action = btn.getAttribute('data-action');
            const qtyEl = document.querySelector('.qty-value[data-qty-for="' + key + '"]');

            btn.disabled = true;
            const otherBtn = btn.parentElement.querySelector(
                '.qty-btn[data-action="' + (action === 'inc' ? 'dec' : 'inc') + '"]'
            );
            if (otherBtn) otherBtn.disabled = true;

            changeCartQty(key, action === 'inc' ? 1 : -1)
                .then(function (newQty) {
                    if (qtyEl && newQty && newQty > 0) qtyEl.textContent = newQty;
                })
                .finally(function () {
                    btn.disabled = false;
                    if (otherBtn) otherBtn.disabled = false;
                });
        });
    });

    document.querySelectorAll('.remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            btn.disabled = true;
            const key = btn.getAttribute('data-key');
            removeCartItem(key).catch(function () { btn.disabled = false; });
        });
    });
}

function changeCartQty(key, delta) {
    if (!window.LGCart || !currentCartUid) return Promise.resolve(null);
    return window.LGCart.changeQty(currentCartUid, key, delta)
        .catch(function (err) { console.error('Failed to update quantity:', err); return null; });
}

function removeCartItem(key) {
    if (!window.LGCart || !currentCartUid) return Promise.resolve();
    return window.LGCart.removeItem(currentCartUid, key)
        .catch(function (err) { console.error('Failed to remove item:', err); });
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
        cartItems = val
            ? Object.keys(val).map(function (key) { return Object.assign({ key: key }, val[key]); })
            : [];

        if (cartView === 'cart') {
            renderCart(cartItems);
        } else if (cartView === 'checkout' && !placing) {
            if (cartItems.length === 0) {
                cartView = 'cart';
                renderCartEmptyState();
            }
        }
    }, function (err) {
        console.error('Failed to load cart:', err);
        renderCartErrorState();
    });
}

function wireCartPage() {
    const root = document.getElementById('cartRoot');
    if (!root) return;

    if (!window.LGSession) return;

    window.LGSession.onChange(function (session) {
        if (session) {
            if (currentCartUid !== session.uid) {
                currentCartUid = session.uid;
                cartView = 'cart';
                loadCart(currentCartUid);
            }
        } else {
            if (currentCartUid && window.LGChem) {
                window.LGChem.rtdb.ref('carts/' + currentCartUid).off();
            }
            currentCartUid = null;
            cartItems = [];
            cartView = 'cart';
            renderCartLoggedOutState();
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    wireUserMenu();
    wireCartPage();
});