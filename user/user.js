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
    diags.push({ label: 'auth.js loaded (window.LGSession exists)', ok: !!window.LGSession });
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

    let detailsHtml = `
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-phone"></i> Phone</span>
            <span class="detail-value">${profile && profile.phone ? escapeHtml(profile.phone) : '<span class="detail-value muted">Not set</span>'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-map-marker-alt"></i> Address</span>
            <span class="detail-value">${profile && profile.address ? escapeHtml(profile.address) : '<span class="detail-value muted">Not set</span>'}</span>
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

    root.innerHTML = `
        <div class="account-header">
            <div class="account-avatar-lg"><i class="fas fa-user"></i></div>
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
        </div>
    `;
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
        renderErrorState({ message: 'auth.js did not load. Check the script tag path auth.js and that the file was uploaded.' }, runDiagnostics());
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

document.addEventListener('DOMContentLoaded', function () {
    wireUserMenu();
    wireUserPage();
});