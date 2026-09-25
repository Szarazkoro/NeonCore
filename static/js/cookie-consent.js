(() => {
    const storageKey = 'bodorGameCookieConsent';
    const banner = document.getElementById('cookieConsent');
    const acceptButton = document.getElementById('cookieAccept');
    const declineButton = document.getElementById('cookieDecline');
    const settingsButton = document.getElementById('cookieSettingsButton');

    if (!banner) return;

    function readConsent() {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || 'null');
        } catch (error) {
            return null;
        }
    }

    function setConsent(optionalCookies) {
        const consent = {
            necessary: true,
            optional: optionalCookies,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(consent));
        window.gtag('consent', 'update', {
            ad_storage: optionalCookies ? 'granted' : 'denied',
            analytics_storage: optionalCookies ? 'granted' : 'denied',
            ad_user_data: optionalCookies ? 'granted' : 'denied',
            ad_personalization: optionalCookies ? 'granted' : 'denied'
        });
        if (optionalCookies) loadGoogleAdsense();
        banner.hidden = true;
        window.dispatchEvent(new CustomEvent('bodor:cookie-consent', { detail: consent }));
    }

    function loadGoogleAdsense() {
        const clientId = window.BODOR_GOOGLE_ADSENSE_CLIENT_ID;
        if (!clientId || document.querySelector('script[data-bodor-adsense]')) return;

        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.bodorAdsense = 'true';
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
        document.head.appendChild(script);
    }

    acceptButton.addEventListener('click', () => setConsent(true));
    declineButton.addEventListener('click', () => setConsent(false));
    settingsButton.addEventListener('click', () => {
        banner.hidden = false;
        banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    const existingConsent = readConsent();
    if (existingConsent && existingConsent.optional === true) {
        window.gtag('consent', 'update', {
            ad_storage: 'granted',
            analytics_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted'
        });
        loadGoogleAdsense();
    } else if (!existingConsent) {
        banner.hidden = false;
    }
})();