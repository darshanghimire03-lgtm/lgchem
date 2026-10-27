(function () {
    const body = document.body;
    const base = body.getAttribute('data-base') || '';
    const active = body.getAttribute('data-active') || '';
    const scripts = (body.getAttribute('data-scripts') || '')
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);

    function fetchPart(name) {
        return fetch(base + 'layout/' + name + '.html')
            .then(function (res) {
                if (!res.ok) throw new Error('Could not load layout/' + name + '.html');
                return res.text();
            })
            .then(function (html) {
                return html.split('{{base}}').join(base);
            });
    }

    function injectParts() {
        const slots = Array.prototype.slice.call(document.querySelectorAll('[data-include]'));
        return Promise.all(slots.map(function (slot) {
            return fetchPart(slot.getAttribute('data-include')).then(function (html) {
                slot.outerHTML = html;
            });
        }));
    }

    function applyState() {
        const links = document.getElementById('navLinks');
        if (links && active !== 'home') links.remove();

        const cartLink = document.getElementById('cartLink');
        if (cartLink && active === 'cart') cartLink.classList.add('active-page');

        const chip = document.getElementById('userChip');
        if (chip && active === 'user') chip.classList.add('active-page');

        const profile = document.getElementById('profileLink');
        if (profile && active === 'auth') profile.setAttribute('href', '#');
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = function () { reject(new Error('Failed to load ' + src)); };
            document.body.appendChild(el);
        });
    }

    function loadScripts() {
        return scripts.reduce(function (chain, name) {
            return chain.then(function () { return loadScript(base + 'js/' + name + '.js'); });
        }, Promise.resolve());
    }

    function start() {
        injectParts()
            .then(applyState)
            .then(loadScripts)
            .then(function () {
                document.dispatchEvent(new Event('DOMContentLoaded'));
            })
            .catch(function (err) {
                console.error(err);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();