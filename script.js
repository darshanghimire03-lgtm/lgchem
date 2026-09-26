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

document.addEventListener('DOMContentLoaded', function () {
    wireUserMenu();
    loadProductsFromFirebase();
});