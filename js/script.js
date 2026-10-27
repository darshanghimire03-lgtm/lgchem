const BASE = document.body.getAttribute('data-base') || '';
const FALLBACK_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%25' height='100%25' fill='%23eef3f8'/><text x='50%25' y='50%25' fill='%238a97a6' font-family='sans-serif' font-size='18' text-anchor='middle'>No image</text></svg>";

const state = { products: [], category: 'All', query: '', sort: 'featured' };

function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function initials(name) {
    return name ? name.trim().charAt(0).toUpperCase() : '?';
}

function priceNumber(value) {
    const match = String(value == null ? '' : value).replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
}

function wireUserMenu() {
    const el = function (id) { return document.getElementById(id); };
    const profileLink = el('profileLink'), userMenu = el('userMenu'), userChip = el('userChip'),
          userDropdown = el('userDropdown'), logoutBtn = el('logoutBtn');
    if (!profileLink || !userMenu || !userChip || !userDropdown) return;
    if (userMenu.getAttribute('data-wired')) return;
    userMenu.setAttribute('data-wired', '1');

    userChip.addEventListener('click', function (e) {
        e.stopPropagation();
        userDropdown.classList.toggle('open');
    });
    document.addEventListener('click', function () { userDropdown.classList.remove('open'); });

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

    function apply(session) {
        if (session) {
            profileLink.style.display = 'none';
            userMenu.style.display = 'flex';
            el('userAvatar').textContent = initials(session.name);
            el('userNameLabel').textContent = session.name;
            el('userTypeBadge').textContent = (session.accountType || 'customer').toUpperCase();
        } else {
            profileLink.style.display = 'inline-flex';
            userMenu.style.display = 'none';
            userDropdown.classList.remove('open');
        }
    }
    apply(window.LGSession.getCached());
    window.LGSession.onChange(apply);
}

function message(icon, text) {
    return '<div class="empty-text"><i class="fas ' + icon + '"></i>' + esc(text) + '</div>';
}

function renderFilters() {
    const box = document.getElementById('filters');
    if (!box) return;
    const cats = ['All'].concat(Array.from(new Set(
        state.products.map(function (p) { return p.category; }).filter(Boolean)
    )));
    box.innerHTML = cats.map(function (c) {
        return '<button type="button" class="chip' + (c === state.category ? ' active' : '') +
               '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
}

function visibleProducts() {
    const q = state.query.trim().toLowerCase();
    const list = state.products.filter(function (p) {
        const catOk = state.category === 'All' || p.category === state.category;
        const textOk = !q || ((p.name || '') + ' ' + (p.category || '')).toLowerCase().indexOf(q) !== -1;
        return catOk && textOk;
    });

    if (state.sort === 'price-asc') {
        list.sort(function (a, b) { return priceNumber(a.price) - priceNumber(b.price); });
    } else if (state.sort === 'price-desc') {
        list.sort(function (a, b) { return priceNumber(b.price) - priceNumber(a.price); });
    } else if (state.sort === 'name-asc') {
        list.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    }
    return list;
}

function updateResultCount(count) {
    const el = document.getElementById('resultCount');
    if (!el) return;
    el.textContent = count + (count === 1 ? ' product' : ' products') +
        (state.category !== 'All' ? ' in ' + state.category : '');
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    const list = visibleProducts();
    updateResultCount(list.length);

    if (!list.length) {
        grid.innerHTML = message('fa-flask',
            state.products.length ? 'No products match your search.' : 'No products available right now. Please check back soon.');
        return;
    }

    grid.innerHTML = '';
    list.forEach(function (product) {
        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML =
            '<img class="product-image" loading="lazy" alt="' + esc(product.name) + '" src="' + esc(product.image || FALLBACK_IMG) + '">' +
            '<div class="product-info">' +
                '<div class="product-category">' + esc(product.category) + '</div>' +
                '<h3 class="product-name">' + esc(product.name || 'Unnamed product') + '</h3>' +
                '<div class="product-price-row">' +
                    '<div><div class="product-price">' + esc(product.price) + '</div>' +
                    '<div class="product-unit">' + esc(product.unit) + '</div></div>' +
                    '<button type="button" class="add-to-cart-btn"><i class="fas fa-cart-plus"></i> <span class="add-to-cart-label">Add</span></button>' +
                '</div>' +
            '</div>';
        card.querySelector('img').addEventListener('error', function () { this.src = FALLBACK_IMG; });
        const btn = card.querySelector('.add-to-cart-btn');
        btn.addEventListener('click', function () { addToCart(product, btn); });
        grid.appendChild(card);
    });
}

function loadProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    if (!window.LGChem || !window.LGChem.rtdb) {
        grid.innerHTML = message('fa-triangle-exclamation', 'Could not connect to the store. Please try again later.');
        return;
    }

    window.LGChem.rtdb.ref('products').once('value')
        .then(function (snap) {
            const val = snap.val();
            state.products = val ? Object.keys(val).map(function (k) { return Object.assign({ key: k }, val[k]); }) : [];
            renderFilters();
            renderProducts();
        })
        .catch(function (err) {
            console.error('Failed to load products:', err);
            grid.innerHTML = message('fa-triangle-exclamation', 'Products failed to load. Refresh the page to try again.');
        });
}

function wireFilters() {
    const filters = document.getElementById('filters');
    const search = document.getElementById('searchInput');
    const sort = document.getElementById('sortSelect');
    if (sort) {
        sort.addEventListener('change', function () {
            state.sort = sort.value;
            renderProducts();
        });
    }
    if (filters) {
        filters.addEventListener('click', function (e) {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            state.category = chip.getAttribute('data-cat');
            renderFilters();
            renderProducts();
        });
    }
    if (search) {
        search.addEventListener('input', function () {
            state.query = search.value;
            renderProducts();
        });
    }
}

function addToCart(product, btn) {
    const uid = window.LGSession && window.LGSession.getUserId();
    if (!uid) {
        alert('Please log in to add items to your cart.');
        window.location.href = BASE + 'auth.html';
        return;
    }
    if (!product.key || !window.LGCart) {
        console.error('Cannot add to cart: missing product key or cart-helper.js.');
        return;
    }

    const label = btn.querySelector('.add-to-cart-label');
    btn.disabled = true;
    label.textContent = 'Adding…';

    window.LGCart.addToCart(uid, product)
        .then(function () {
            label.textContent = 'Added';
            setTimeout(function () { label.textContent = 'Add'; btn.disabled = false; }, 900);
        })
        .catch(function (err) {
            console.error('Failed to add to cart:', err);
            label.textContent = 'Try again';
            setTimeout(function () { label.textContent = 'Add'; btn.disabled = false; }, 1500);
        });
}

document.addEventListener('DOMContentLoaded', function () {
    wireUserMenu();
    wireFilters();
    loadProducts();
});