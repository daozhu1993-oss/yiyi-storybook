import {analyticsPage} from './analytics-policy.js';
import {MEASUREMENT_ID} from './analytics-config.js';

let loaded = false;

function startAnalytics() {
  const page = analyticsPage(location.href);
  if (loaded || !page) return;
  loaded = true;
  window[`ga-disable-${MEASUREMENT_ID}`] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  const gtag = window.gtag;
  gtag('consent', 'default', {analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, {
    ...page, send_page_view:false, allow_google_signals:false,
    allow_ad_personalization_signals:false, ignore_referrer:true,
    cookie_expires:86400, cookie_update:false, cookie_flags:'SameSite=Lax;Secure',
  });
  gtag('event', 'page_view', {...page, send_to:MEASUREMENT_ID});
  const script = document.createElement('script');
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(script);
}

// Public visits are measured automatically, without an on-site opt-in step.
startAnalytics();
