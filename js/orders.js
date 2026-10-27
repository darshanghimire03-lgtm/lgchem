(function () {
    const BASE = document.body.getAttribute('data-base') || '';

    const STATUS_META = {
        pending: { label: 'Pending', icon: 'fa-hourglass-half', step: 0 },
        confirmed: { label: 'Confirmed', icon: 'fa-circle-check', step: 1 },
        shipped: { label: 'Shipped', icon: 'fa-truck-fast', step: 2 },
        delivered: { label: 'Delivered', icon: 'fa-box-open', step: 3 },
        cancelled: { label: 'Cancelled', icon: 'fa-ban', step: -1 }
    };

    const TIMELINE = [
        { key: 'pending', label: 'Pending' },
        { key: 'confirmed', label: 'Confirmed' },
        { key: 'shipped', label: 'Shipped' },
        { key: 'delivered', label: 'Delivered' }
    ];

    const FILTERS = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    let allOrders = [];
    let activeFilter = 'all';
    let openIds = {};
    let confirmingId = null;
    let busyIds = {};
    let errorById = {};
    let noticeTimer = null;
    let activeRef = null;
    let activeHandler = null;
    let activeUid = null;
    let loadToken = 0;

    function cleanUrl() {
        if (!window.history || !window.history.replaceState) return;
        let path = window.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '');
        if (!path) path = '/';
        if (path === window.location.pathname) return;
        window.history.replaceState(null, '', path + window.location.search + window.location.hash);
    }

    function escapeHtml(value) {
        if (value === undefined || value === null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatMoney(n) {
        return 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    function formatDate(iso) {
        if (!iso) return 'Date unavailable';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return 'Date unavailable';
        return d.toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function normalizeStatus(value) {
        const key = String(value || 'pending').trim().toLowerCase();
        return STATUS_META[key] ? key : 'unknown';
    }

    function statusLabel(key) {
        return STATUS_META[key] ? STATUS_META[key].label : 'Unknown';
    }

    function statusIcon(key) {
        return STATUS_META[key] ? STATUS_META[key].icon : 'fa-circle-question';
    }

    function shortId(id) {
        return String(id || '').slice(-6).toUpperCase();
    }

    function ordersRoot() { return document.getElementById('ordersRoot'); }
    function tabsRoot() { return document.getElementById('ordersTabs'); }

    function showNotice(text) {
        const root = ordersRoot();
        if (!root) return;
        let el = document.getElementById('ordersNotice');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ordersNotice';
            el.style.cssText = 'background:#e8f3e8;border:1px solid #bfdcbf;color:#0a6b0a;border-radius:10px;padding:10px 14px;font-size:0.85rem;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px;';
            root.parentNode.insertBefore(el, root);
        }
        el.innerHTML = '<i class="fas fa-circle-check"></i> ' + escapeHtml(text);
        el.style.display = 'flex';
        if (noticeTimer) clearTimeout(noticeTimer);
        noticeTimer = setTimeout(function () {
            el.style.display = 'none';
        }, 3500);
    }

    function renderSkeleton() {
        const root = ordersRoot();
        if (!root) return;
        const card = `
            <div class="order-card">
                <div class="skeleton skeleton-line w-40" style="height:18px;"></div>
                <div class="skeleton skeleton-line w-60"></div>
                <div class="skeleton skeleton-line w-30"></div>
            </div>
        `;
        root.innerHTML = card + card;
        tabsRoot().style.display = 'none';
    }

    function renderLoggedOut() {
        const root = ordersRoot();
        if (!root) return;
        tabsRoot().style.display = 'none';
        root.innerHTML = `
            <div class="state-panel">
                <i class="fas fa-user-lock"></i>
                <h3>Please log in to view your orders</h3>
                <p>Sign in to track the status of your orders.</p>
                <a href="${BASE}auth.html" class="shop-link"><i class="fas fa-right-to-bracket"></i> Log In / Sign Up</a>
            </div>
        `;
    }

    function renderEmpty() {
        const root = ordersRoot();
        if (!root) return;
        tabsRoot().style.display = 'none';
        root.innerHTML = `
            <div class="state-panel">
                <i class="fas fa-box-open"></i>
                <h3>No orders yet</h3>
                <p>When you place an order, it will show up here with its status.</p>
                <a href="${BASE || './'}#products" class="shop-link"><i class="fas fa-bag-shopping"></i> Shop Now</a>
            </div>
        `;
    }

    function renderError(err) {
        const root = ordersRoot();
        if (!root) return;
        tabsRoot().style.display = 'none';
        const detail = err ? (err.code ? (err.code + ': ' + (err.message || '')) : (err.message || String(err))) : 'Unknown error';
        root.innerHTML = `
            <div class="state-panel">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Couldn't load your orders</h3>
                <p>Check your Realtime Database rules for the orders path.</p>
                <pre>${escapeHtml(detail)}</pre>
                <a href="#" class="shop-link" onclick="location.reload(); return false;"><i class="fas fa-rotate-right"></i> Retry</a>
            </div>
        `;
    }

    function countByFilter() {
        const counts = { all: allOrders.length };
        allOrders.forEach(function (o) {
            counts[o.statusKey] = (counts[o.statusKey] || 0) + 1;
        });
        return counts;
    }

    function renderTabs() {
        const el = tabsRoot();
        if (!el) return;
        const counts = countByFilter();
        const visible = FILTERS.filter(function (f) {
            return f === 'all' || f === 'pending' || counts[f];
        });
        if (visible.indexOf(activeFilter) === -1) activeFilter = 'all';

        el.style.display = 'flex';
        el.innerHTML = visible.map(function (f) {
            const label = f === 'all' ? 'All' : statusLabel(f);
            return `
                <button type="button" class="orders-tab ${f === activeFilter ? 'active' : ''}" data-filter="${f}">
                    ${label} <span class="count">${counts[f] || 0}</span>
                </button>
            `;
        }).join('');

        el.querySelectorAll('.orders-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeFilter = btn.getAttribute('data-filter');
                renderTabs();
                renderList();
            });
        });
    }

    function timelineHtml(order) {
        if (order.statusKey === 'cancelled') {
            return '<div class="order-cancelled-note"><i class="fas fa-ban"></i> This order was cancelled.</div>';
        }
        const current = STATUS_META[order.statusKey] ? STATUS_META[order.statusKey].step : 0;
        return '<div class="order-timeline">' + TIMELINE.map(function (step, index) {
            const cls = index <= current ? 'done' : '';
            const cur = index === current ? ' current' : '';
            return `
                <div class="timeline-step ${cls}${cur}">
                    <div class="timeline-dot"><i class="fas fa-check"></i></div>
                    ${step.label}
                </div>
            `;
        }).join('') + '</div>';
    }

    function itemsHtml(order) {
        const items = order.items || {};
        const keys = Object.keys(items);
        if (!keys.length) return '<div class="order-item"><span class="order-item-name">No item details</span></div>';
        return keys.map(function (key) {
            const i = items[key] || {};
            const unit = i.unit ? ' / ' + escapeHtml(i.unit) : '';
            const price = i.price ? escapeHtml(i.price) + unit + ' · ' : '';
            return `
                <div class="order-item">
                    <span class="order-item-name">${escapeHtml(i.name || 'Unnamed product')}</span>
                    <span class="order-item-meta">${price}× ${Number(i.qty) || 1}</span>
                </div>
            `;
        }).join('');
    }

    function totalQty(order) {
        const items = order.items || {};
        return Object.keys(items).reduce(function (sum, key) {
            return sum + (Number(items[key] && items[key].qty) || 1);
        }, 0);
    }

    function cancelAreaHtml(order) {
        if (order.statusKey !== 'pending') return '';
        const id = escapeHtml(order.id);

        if (busyIds[order.id]) {
            return '<button type="button" class="cancel-btn" disabled><i class="fas fa-spinner fa-spin"></i> Cancelling…</button>';
        }

        if (confirmingId === order.id) {
            return `
                <div class="cancel-confirm">
                    <span>Cancel and remove this order?</span>
                    <button type="button" class="cancel-yes" data-cancel-yes="${id}">Yes, cancel</button>
                    <button type="button" class="cancel-keep" data-cancel-keep="${id}">Keep</button>
                </div>
            `;
        }

        return '<button type="button" class="cancel-btn" data-cancel="' + id + '"><i class="fas fa-xmark"></i> Cancel order</button>';
    }

    function orderCardHtml(order) {
        const isOpen = !!openIds[order.id];
        const qty = totalQty(order);
        const payment = order.payment === 'cash' ? 'Cash' : (order.payment ? 'Online' : 'Not specified');
        const error = errorById[order.id]
            ? '<div class="order-error">' + escapeHtml(errorById[order.id]) + '</div>'
            : '';

        return `
            <div class="order-card ${isOpen ? 'open' : ''}" data-id="${escapeHtml(order.id)}">
                <div class="order-top">
                    <div>
                        <div class="order-id">Order #${escapeHtml(shortId(order.id))}</div>
                        <div class="order-date">${escapeHtml(formatDate(order.createdAt))}</div>
                    </div>
                    <span class="order-status s-${order.statusKey}">
                        <i class="fas ${statusIcon(order.statusKey)}"></i> ${statusLabel(order.statusKey)}
                    </span>
                </div>

                <div class="order-summary">
                    <span class="order-summary-text">${qty} item${qty === 1 ? '' : 's'}</span>
                    <span class="order-total">${formatMoney(order.total)}</span>
                </div>

                <div class="order-actions">
                    <button type="button" class="order-toggle" data-toggle="${escapeHtml(order.id)}">
                        <span>${isOpen ? 'Hide details' : 'View details'}</span> <i class="fas fa-chevron-down"></i>
                    </button>
                    ${cancelAreaHtml(order)}
                </div>

                ${error}

                <div class="order-details">
                    ${timelineHtml(order)}
                    <div class="order-items">${itemsHtml(order)}</div>
                    <div class="order-info-row"><span>Order ID</span><span>${escapeHtml(order.id)}</span></div>
                    <div class="order-info-row"><span>Payment</span><span>${payment}</span></div>
                    <div class="order-info-row"><span>Name</span><span>${escapeHtml(order.customerName || '-')}</span></div>
                    <div class="order-info-row"><span>Phone</span><span>${escapeHtml(order.phone || '-')}</span></div>
                    <div class="order-info-row"><span>Address</span><span>${escapeHtml(order.address || '-')}</span></div>
                </div>
            </div>
        `;
    }

    function cancelOrder(id) {
        if (!window.LGChem || !window.LGChem.rtdb) {
            errorById[id] = 'Could not connect to the database.';
            confirmingId = null;
            renderList();
            return;
        }

        busyIds[id] = true;
        delete errorById[id];
        renderList();

        window.LGChem.rtdb.ref('orders/' + id).transaction(function (current) {
            if (current === null) return current;
            if (String(current.status || 'pending').toLowerCase() === 'pending') return null;
            return undefined;
        }).then(function (result) {
            delete busyIds[id];
            confirmingId = null;
            if (!result.committed) {
                errorById[id] = 'This order has already been confirmed, so it can no longer be cancelled.';
                renderList();
                return;
            }
            delete openIds[id];
            delete errorById[id];
            showNotice('Order cancelled and removed.');
            if (allOrders.length) renderList();
        }).catch(function (err) {
            console.error('Failed to cancel order:', err);
            delete busyIds[id];
            confirmingId = null;
            errorById[id] = err && err.code === 'PERMISSION_DENIED'
                ? 'This order can no longer be cancelled.'
                : 'Could not cancel the order. Please try again.';
            renderList();
        });
    }

    function renderList() {
        const root = ordersRoot();
        if (!root) return;

        const list = activeFilter === 'all'
            ? allOrders
            : allOrders.filter(function (o) { return o.statusKey === activeFilter; });

        if (!list.length) {
            root.innerHTML = '<div class="orders-empty-filter">No ' + escapeHtml(statusLabel(activeFilter).toLowerCase()) + ' orders.</div>';
            return;
        }

        root.innerHTML = list.map(orderCardHtml).join('');

        root.querySelectorAll('.order-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const id = btn.getAttribute('data-toggle');
                const card = btn.closest('.order-card');
                const nowOpen = !openIds[id];
                openIds[id] = nowOpen;
                card.classList.toggle('open', nowOpen);
                btn.querySelector('span').textContent = nowOpen ? 'Hide details' : 'View details';
            });
        });

        root.querySelectorAll('[data-cancel]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                confirmingId = btn.getAttribute('data-cancel');
                delete errorById[confirmingId];
                renderList();
            });
        });

        root.querySelectorAll('[data-cancel-keep]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                confirmingId = null;
                renderList();
            });
        });

        root.querySelectorAll('[data-cancel-yes]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                cancelOrder(btn.getAttribute('data-cancel-yes'));
            });
        });
    }

    function stopListening() {
        if (activeRef && activeHandler) activeRef.off('value', activeHandler);
        activeRef = null;
        activeHandler = null;
        activeUid = null;
    }

    function startListening(session) {
        if (activeUid === session.uid) return;
        stopListening();

        if (!window.LGChem || !window.LGChem.rtdb) {
            renderError({ message: 'Could not connect to the database.' });
            return;
        }

        const myToken = ++loadToken;
        activeUid = session.uid;
        renderSkeleton();

        activeRef = window.LGChem.rtdb.ref('orders').orderByChild('uid').equalTo(session.uid);

        activeHandler = function (snap) {
            if (myToken !== loadToken) return;
            const val = snap.val() || {};
            allOrders = Object.keys(val).map(function (id) {
                const o = val[id] || {};
                return Object.assign({}, o, { id: id, statusKey: normalizeStatus(o.status) });
            }).sort(function (a, b) {
                return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
            });

            if (confirmingId) {
                const stillPending = allOrders.some(function (o) {
                    return o.id === confirmingId && o.statusKey === 'pending';
                });
                if (!stillPending) confirmingId = null;
            }

            if (!allOrders.length) {
                renderEmpty();
                return;
            }
            renderTabs();
            renderList();
        };

        activeRef.on('value', activeHandler, function (err) {
            if (myToken !== loadToken) return;
            console.error('Failed to load orders:', err);
            renderError(err);
        });
    }

    function init() {
        if (!ordersRoot()) return;

        cleanUrl();

        if (!window.LGSession) {
            renderError({ message: 'auth.js did not load. Check the script tag path js/auth.js.' });
            return;
        }

        window.LGSession.onChange(function (session, confirmed) {
            if (session) {
                startListening(session);
            } else if (confirmed) {
                stopListening();
                loadToken++;
                renderLoggedOut();
            } else {
                renderSkeleton();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();