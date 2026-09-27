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
    hideSettingsCard();
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
    hideSettingsCard();
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
    hideSettingsCard();
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

    showSettingsCard();
}

function showSettingsCard() {
    const settingsCard = document.getElementById('settingsCard');
    if (settingsCard) settingsCard.style.display = 'block';
}

function hideSettingsCard() {
    const settingsCard = document.getElementById('settingsCard');
    if (settingsCard) settingsCard.style.display = 'none';
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

/* ---------------- Settings: modal helpers ---------------- */

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

function showModalMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'modal-msg ' + type;
}

function clearModalMsg(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.className = 'modal-msg hidden';
}

/* ---------------- Settings: Change Password ---------------- */

function wireChangePassword() {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const modal = document.getElementById('changePasswordModal');
    const closeBtn = document.getElementById('closeChangePasswordModal');
    const form = document.getElementById('changePasswordForm');
    const submitBtn = document.getElementById('changePasswordSubmitBtn');
    const submitText = document.getElementById('changePasswordSubmitText');

    if (!changePasswordBtn || !modal || !form) return;

    changePasswordBtn.addEventListener('click', function () {
        form.reset();
        clearModalMsg('changePasswordMsg');
        openModal('changePasswordModal');
    });

    closeBtn.addEventListener('click', function () { closeModal('changePasswordModal'); });
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal('changePasswordModal');
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearModalMsg('changePasswordMsg');

        const currentPassword = document.getElementById('currentPasswordInput').value;
        const newPassword = document.getElementById('newPasswordInput').value;
        const confirmNewPassword = document.getElementById('confirmNewPasswordInput').value;

        if (newPassword.length < 6) {
            showModalMsg('changePasswordMsg', 'New password must be at least 6 characters.', 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            showModalMsg('changePasswordMsg', 'New passwords do not match.', 'error');
            return;
        }

        const user = window.LGChem && window.LGChem.auth && window.LGChem.auth.currentUser;
        if (!user || !user.email) {
            showModalMsg('changePasswordMsg', 'Could not verify your session. Please log in again.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitText.textContent = 'Updating…';

        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

        user.reauthenticateWithCredential(credential)
            .then(function () {
                return user.updatePassword(newPassword);
            })
            .then(function () {
                showModalMsg('changePasswordMsg', 'Password updated successfully.', 'success');
                submitBtn.disabled = false;
                submitText.textContent = 'Update Password';
                setTimeout(function () { closeModal('changePasswordModal'); }, 1200);
            })
            .catch(function (err) {
                submitBtn.disabled = false;
                submitText.textContent = 'Update Password';
                showModalMsg('changePasswordMsg', friendlyFirebaseError(err), 'error');
            });
    });
}

/* ---------------- Settings: Delete Account ---------------- */

function wireDeleteAccount() {
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const modal = document.getElementById('deleteAccountModal');
    const closeBtn = document.getElementById('closeDeleteAccountModal');
    const form = document.getElementById('deleteAccountForm');
    const submitBtn = document.getElementById('deleteAccountSubmitBtn');
    const submitText = document.getElementById('deleteAccountSubmitText');

    if (!deleteAccountBtn || !modal || !form) return;

    deleteAccountBtn.addEventListener('click', function () {
        form.reset();
        clearModalMsg('deleteAccountMsg');
        openModal('deleteAccountModal');
    });

    closeBtn.addEventListener('click', function () { closeModal('deleteAccountModal'); });
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal('deleteAccountModal');
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearModalMsg('deleteAccountMsg');

        const password = document.getElementById('deletePasswordInput').value;
        const user = window.LGChem && window.LGChem.auth && window.LGChem.auth.currentUser;

        if (!user || !user.email) {
            showModalMsg('deleteAccountMsg', 'Could not verify your session. Please log in again.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitText.textContent = 'Deleting…';

        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        const uid = user.uid;

        user.reauthenticateWithCredential(credential)
            .then(function () {
                return window.LGChem.rtdb.ref('users/' + uid).remove();
            })
            .then(function () {
                return window.LGChem.rtdb.ref('carts/' + uid).remove();
            })
            .then(function () {
                return user.delete();
            })
            .then(function () {
                window.LGSession.clear();
                window.location.href = BASE + 'index.html';
            })
            .catch(function (err) {
                submitBtn.disabled = false;
                submitText.textContent = 'Delete My Account';
                showModalMsg('deleteAccountMsg', friendlyFirebaseError(err), 'error');
            });
    });
}

/* ---------------- Settings: Help & Support ---------------- */

function wireHelpSupport() {
    const helpBtn = document.getElementById('helpSupportBtn');
    const modal = document.getElementById('helpSupportModal');
    const closeBtn = document.getElementById('closeHelpSupportModal');

    if (!helpBtn || !modal) return;

    helpBtn.addEventListener('click', function () { openModal('helpSupportModal'); });
    closeBtn.addEventListener('click', function () { closeModal('helpSupportModal'); });
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal('helpSupportModal');
    });
}

/* ---------------- Settings: Logout ---------------- */

function wireSettingsLogout() {
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    if (!settingsLogoutBtn) return;

    settingsLogoutBtn.addEventListener('click', function () {
        window.LGChem.signOut().then(function () {
            window.LGSession.clear();
            window.location.href = BASE + 'index.html';
        });
    });
}

function friendlyFirebaseError(err) {
    const code = err && err.code;
    switch (code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'Incorrect password. Please try again.';
        case 'auth/weak-password': return 'Password should be at least 6 characters.';
        case 'auth/requires-recent-login': return 'Please log out and log back in, then try again.';
        case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
        default: return (err && err.message) || 'Something went wrong. Please try again.';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    wireUserMenu();
    wireUserPage();
    wireChangePassword();
    wireDeleteAccount();
    wireHelpSupport();
});