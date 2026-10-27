(function () {
    let activeUid = null;
    let unsubscribeRef = null;
    const listeners = [];

    function totalQty(val) {
        if (!val) return 0;
        return Object.values(val).reduce(function (sum, item) {
            return sum + (Number(item && item.qty) || 1);
        }, 0);
    }

    function notify(count) {
        const badge = document.getElementById('cartBadge');
        if (badge) badge.textContent = count;
        listeners.forEach(function (cb) {
            try { cb(count); } catch (err) { console.error('cart-helper listener error:', err); }
        });
    }

    function stopListening() {
        if (activeUid && window.LGChem && window.LGChem.rtdb) {
            window.LGChem.rtdb.ref('carts/' + activeUid).off('value', unsubscribeRef);
        }
        activeUid = null;
        unsubscribeRef = null;
    }

    function startListening(uid) {
        if (!uid || !window.LGChem || !window.LGChem.rtdb) {
            notify(0);
            return;
        }
        if (activeUid === uid) return;

        stopListening();
        activeUid = uid;

        unsubscribeRef = function (snapshot) {
            notify(totalQty(snapshot.val()));
        };

        window.LGChem.rtdb.ref('carts/' + uid).on('value', unsubscribeRef, function (err) {
            console.error('cart-helper: failed to read cart:', err);
            notify(0);
        });
    }

    function bindToSession() {
        if (!window.LGSession) {
            setTimeout(bindToSession, 50);
            return;
        }
        window.LGSession.onChange(function (session) {
            if (session && session.uid) {
                startListening(session.uid);
            } else {
                stopListening();
                notify(0);
            }
        });
    }

    function addToCart(uid, product) {
        if (!uid) return Promise.reject(new Error('Not authenticated'));
        if (!window.LGChem || !window.LGChem.rtdb) return Promise.reject(new Error('Firebase not initialized'));
        if (!product || !product.key) return Promise.reject(new Error('Product is missing a key'));

        const itemRef = window.LGChem.rtdb.ref('carts/' + uid + '/' + product.key);
        return itemRef.once('value').then(function (snap) {
            const existing = snap.val();
            const newQty = (existing && existing.qty ? Number(existing.qty) : 0) + 1;
            return itemRef.set({
                productKey: product.key,
                name: product.name || 'Unnamed product',
                category: product.category || '',
                price: product.price || '',
                unit: product.unit || '',
                image: product.image || '',
                qty: newQty
            }).then(function () { return newQty; });
        });
    }

    function changeQty(uid, key, delta) {
        if (!uid || !key) return Promise.reject(new Error('Missing uid or key'));
        const ref = window.LGChem.rtdb.ref('carts/' + uid + '/' + key);
        return ref.once('value').then(function (snap) {
            const item = snap.val();
            if (!item) return null;
            const newQty = (Number(item.qty) || 1) + delta;
            if (newQty <= 0) return ref.remove().then(function () { return 0; });
            return ref.update({ qty: newQty }).then(function () { return newQty; });
        });
    }

    function removeItem(uid, key) {
        if (!uid || !key) return Promise.reject(new Error('Missing uid or key'));
        return window.LGChem.rtdb.ref('carts/' + uid + '/' + key).remove();
    }

    window.LGCart = {
        onCountChange: function (cb) {
            listeners.push(cb);
            return function unsubscribe() {
                const idx = listeners.indexOf(cb);
                if (idx > -1) listeners.splice(idx, 1);
            };
        },
        addToCart: addToCart,
        changeQty: changeQty,
        removeItem: removeItem,
        refreshNow: function (uid) {
            if (!uid || !window.LGChem || !window.LGChem.rtdb) {
                notify(0);
                return Promise.resolve(0);
            }
            return window.LGChem.rtdb.ref('carts/' + uid).once('value').then(function (snap) {
                const count = totalQty(snap.val());
                notify(count);
                return count;
            });
        }
    };

    bindToSession();
})();