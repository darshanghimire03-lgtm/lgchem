(function () {
    const BASE = document.body.getAttribute('data-base') || '';
    const ACTIVE = document.body.getAttribute('data-active') || '';
    const PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100%25' height='100%25' fill='%23eef3f8'/><text x='50%25' y='54%25' fill='%238a97a6' font-family='sans-serif' font-size='11' text-anchor='middle'>No image</text></svg>";

    let currentCartUid = null;
    let cartRef = null;
    let cartHandler = null;
    let cartItems = [];
    let cartView = 'cart';
    let selectedPayment = 'cash';
    let checkoutDraft = { name: '', phone: '', address: '' };
    let placing = false;
    let lastFocus = null;

    function getRoot() {
        return document.getElementById('cartRoot');
    }

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
        const match = String(priceStr).replace(/,/g, '').match(/\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : 0;
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

    function imgSrc(item) {
        return escapeHtml(item.image) || PLACEHOLDER;
    }

    function renderCartLoadingState() {
        const root = getRoot();
        if (!root) return;
        root.innerHTML = `
            <div class="state-panel">
                <i class="fas fa-spinner fa-spin"></i>
                <h3>Loading your cart…</h3>
            </div>
        `;
    }

    function renderCartLoggedOutState() {
        const root = getRoot();
        if (!root) return;
        root.innerHTML = `
            <div class="state-panel">
                <i class="fas fa-user-lock"></i>
                <h3>Please log in to view your cart</h3>
                <p>Your cart is tied to your account so it's there whenever you come back.</p>
                <a href="${BASE}auth.html" class="shop-link"><i class="fas fa-right-to-bracket"></i> Log In</a>
            </div>
        `;
    }

    function renderCartEmptyState() {
        const root = getRoot();
        if (!root) return;
        root.innerHTML = `
            <div class="state-panel">
                <i class="fas fa-cart-shopping"></i>
                <h3>No cart products found</h3>
                <p>You haven't added anything to your cart yet. Start exploring our products.</p>
                <a href="${BASE}index.html#products" class="shop-link" data-cart-shop><i class="fas fa-bag-shopping"></i> Shop Now</a>
            </div>
        `;
    }

    function renderCartErrorState() {
        const root = getRoot();
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
        const root = getRoot();
        if (!root) return;

        if (!items || items.length === 0) {
            renderCartEmptyState();
            return;
        }

        const itemsHtml = items.map(function (item) {
            return `
                <div class="cart-item" data-key="${escapeHtml(item.key)}">
                    <img src="${imgSrc(item)}" alt="${escapeHtml(item.name)}" class="cart-item-image" data-fallback>
                    <div class="cart-item-info">
                        <div class="cart-item-category">${escapeHtml(item.category)}</div>
                        <div class="cart-item-name">${escapeHtml(item.name || 'Unnamed product')}</div>
                        <div class="cart-item-price">${escapeHtml(item.price)} <span class="cart-item-unit">${escapeHtml(item.unit)}</span></div>
                        <div class="qty-controls">
                            <button type="button" class="qty-btn" data-action="dec" data-key="${escapeHtml(item.key)}" aria-label="Decrease quantity">−</button>
                            <span class="qty-value" data-qty-for="${escapeHtml(item.key)}">${item.qty || 1}</span>
                            <button type="button" class="qty-btn" data-action="inc" data-key="${escapeHtml(item.key)}" aria-label="Increase quantity">+</button>
                        </div>
                    </div>
                    <button type="button" class="remove-btn" data-action="remove" data-key="${escapeHtml(item.key)}" aria-label="Remove item">
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
                    <button type="button" class="checkout-btn" id="checkoutBtn">
                        Proceed to Checkout <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;

        bindImageFallbacks(root);
        wireCartItemControls();
        document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
    }

    function bindImageFallbacks(scope) {
        scope.querySelectorAll('img[data-fallback]').forEach(function (img) {
            img.addEventListener('error', function () {
                if (img.src !== PLACEHOLDER) img.src = PLACEHOLDER;
            });
        });
    }

    function openCheckout() {
        if (!cartItems.length || !currentCartUid) return;
        cartView = 'checkout';
        renderCartLoadingState();

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
        const root = getRoot();
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
                    <img src="${imgSrc(item)}" alt="" class="co-item-image" data-fallback>
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
                    <button type="button" class="checkout-btn" id="confirmOrderBtn">
                        <i class="fas fa-circle-check"></i> Confirm Order
                    </button>
                    <button type="button" class="back-btn" id="backToCartBtn">
                        <i class="fas fa-arrow-left"></i> Back to Cart
                    </button>
                </div>
            </div>
        `;

        bindImageFallbacks(root);

        root.querySelectorAll('input[name="payment"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                selectedPayment = radio.value;
                root.querySelectorAll('.pay-option').forEach(function (opt) {
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
        const root = getRoot();
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

                <a href="${BASE}index.html#products" class="shop-link" data-cart-shop><i class="fas fa-bag-shopping"></i> Continue Shopping</a>
            </div>
        `;
    }

    function wireCartItemControls() {
        const root = getRoot();
        if (!root) return;

        root.querySelectorAll('.qty-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.disabled) return;
                const key = btn.getAttribute('data-key');
                const action = btn.getAttribute('data-action');
                const qtyEl = root.querySelector('.qty-value[data-qty-for="' + key + '"]');

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

        root.querySelectorAll('.remove-btn').forEach(function (btn) {
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

    function detachCart() {
        if (cartRef && cartHandler) cartRef.off('value', cartHandler);
        cartRef = null;
        cartHandler = null;
    }

    function loadCart(uid) {
        detachCart();

        if (!window.LGChem || !window.LGChem.rtdb) {
            renderCartErrorState();
            return;
        }

        cartRef = window.LGChem.rtdb.ref('carts/' + uid);
        cartHandler = function (snapshot) {
            const val = snapshot.val();
            cartItems = val
                ? Object.keys(val).map(function (key) { return Object.assign({ key: key }, val[key]); })
                : [];

            if (cartView === 'cart') {
                renderCart(cartItems);
            } else if (cartView === 'checkout' && !placing && cartItems.length === 0) {
                cartView = 'cart';
                renderCartEmptyState();
            }
        };
        cartRef.on('value', cartHandler, function (err) {
            console.error('Failed to load cart:', err);
            renderCartErrorState();
        });
    }

    function onSession(session, confirmed) {
        if (session) {
            if (currentCartUid !== session.uid) {
                currentCartUid = session.uid;
                cartView = 'cart';
                renderCartLoadingState();
                loadCart(currentCartUid);
            }
            return;
        }

        if (!confirmed && !currentCartUid) {
            renderCartLoadingState();
            return;
        }

        detachCart();
        currentCartUid = null;
        cartItems = [];
        cartView = 'cart';
        renderCartLoggedOutState();
    }

    function bindSession(tries) {
        if (window.LGSession) {
            window.LGSession.onChange(onSession);
            return;
        }
        if (tries > 100) {
            renderCartLoggedOutState();
            return;
        }
        setTimeout(function () { bindSession(tries + 1); }, 50);
    }

    function openCart() {
        const drawer = document.getElementById('cartDrawer');
        const overlay = document.getElementById('cartOverlay');
        if (!drawer || !overlay) return false;

        if (cartView === 'placed') {
            cartView = 'cart';
            renderCart(cartItems);
        }

        lastFocus = document.activeElement;
        drawer.classList.add('open');
        overlay.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('cart-open');

        const closeBtn = document.getElementById('cartClose');
        if (closeBtn) closeBtn.focus();
        return true;
    }

    function closeCart() {
        const drawer = document.getElementById('cartDrawer');
        const overlay = document.getElementById('cartOverlay');
        if (!drawer || !overlay) return;

        drawer.classList.remove('open');
        overlay.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('cart-open');

        if (lastFocus && typeof lastFocus.focus === 'function') {
            try { lastFocus.focus({ preventScroll: true }); } catch (err) { }
        }
        lastFocus = null;
    }

    function isOpen() {
        const drawer = document.getElementById('cartDrawer');
        return !!(drawer && drawer.classList.contains('open'));
    }

    function wireGlobalEvents() {
        document.addEventListener('click', function (e) {
            const opener = e.target.closest('#cartLink, [data-open-cart]');
            if (opener) {
                if (openCart()) e.preventDefault();
                return;
            }

            if (e.target.closest('#cartClose') || e.target.closest('#cartOverlay')) {
                closeCart();
                return;
            }

            const shop = e.target.closest('[data-cart-shop]');
            if (shop && ACTIVE === 'home') {
                e.preventDefault();
                closeCart();
                const products = document.getElementById('products');
                if (products) products.scrollIntoView({ behavior: 'smooth' });
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) closeCart();
        });
    }

    function openFromUrl() {
        let wants = false;
        try {
            wants = new URLSearchParams(window.location.search).get('cart') === '1';
        } catch (err) {
            wants = false;
        }
        if (!wants) return;
        openCart();
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('cart');
            window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
        } catch (err) { }
    }

    function init() {
        renderCartLoadingState();
        wireGlobalEvents();
        bindSession(0);
        openFromUrl();
    }

    init();
})();