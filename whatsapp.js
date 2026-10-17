/* ============================================================
   whatsapp.js — send the order to WhatsApp
   ------------------------------------------------------------
   A static site cannot send a WhatsApp message on its own: that needs
   the Business API and a server. What it CAN do is open WhatsApp with
   the message already typed, which is one tap for the customer.

   Two paths:
     * click-to-chat (wa.me) — works everywhere, no setup
     * the phone's native share sheet, so the customer can pick any app

   The shop's number is configured in SHOP_WHATSAPP below.
   ============================================================ */

(function () {
  'use strict';

  // Shop number in international format, digits only (91 = India).
  // Change this to the real delivery number.
  var SHOP_WHATSAPP = '919999999999';

  var CONFIG_KEY = 'tiffin_shop_whatsapp';

  function shopNumber() {
    try {
      var saved = localStorage.getItem(CONFIG_KEY);
      if (saved && /^\d{10,15}$/.test(saved)) return saved;
    } catch (e) {}
    return SHOP_WHATSAPP;
  }

  function setShopNumber(n) {
    var digits = String(n || '').replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(digits)) return false;
    try { localStorage.setItem(CONFIG_KEY, digits); } catch (e) {}
    return true;
  }

  /* ---------- message building ---------- */

  function payLabel(p) {
    return p === 'cod' ? 'Cash on Delivery' : p === 'upi' ? 'UPI' : 'Card';
  }

  // Plain-text order summary — readable in any WhatsApp chat.
  function buildMessage(o) {
    var lines = [];
    lines.push('*🍱 NAYA ORDER — TiffinExpress*');
    lines.push('');
    lines.push('*Order ID:* ' + o.id);
    lines.push('*Naam:* ' + o.customer.name);
    lines.push('*Phone:* ' + o.customer.phone);
    lines.push('*Address:* ' + o.customer.address);
    if (o.customer.lat && o.customer.lon) {
      lines.push('*Location:* https://www.google.com/maps?q=' +
                 o.customer.lat + ',' + o.customer.lon);
    }
    lines.push('*Payment:* ' + payLabel(o.customer.payment));
    lines.push('');
    lines.push('*Items:*');
    (o.items || []).forEach(function (i) {
      lines.push('• ' + i.name + (i.qty > 1 ? ' ×' + i.qty : '') +
                 ' — ₹' + (i.price * i.qty));
    });
    lines.push('');
    if (o.delivery) lines.push('Delivery: ₹' + o.delivery);
    else lines.push('Delivery: FREE');
    lines.push('*Total: ₹' + o.total + '*');
    lines.push('');
    lines.push('_TiffinExpress se bheja gaya_');
    return lines.join('\n');
  }

  /* ---------- sending ---------- */

  function waLink(text, number) {
    var num = number || shopNumber();
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
  }

  // Open WhatsApp with the order pre-typed.
  function sendOrder(o, number) {
    if (!o) return null;
    var text = buildMessage(o);
    var url = waLink(text, number);
    try {
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      // popup blocked — fall back to a same-tab navigation
      try { location.href = url; } catch (e2) {}
    }
    return url;
  }

  // Native share sheet (mobile): lets the customer pick WhatsApp, SMS, mail…
  function shareOrder(o) {
    if (!o) return Promise.resolve(false);
    var text = buildMessage(o);
    if (navigator.share) {
      return navigator.share({
        title: 'Order ' + o.id + ' — TiffinExpress',
        text: text,
      }).then(function () { return true; }).catch(function () { return false; });
    }
    // no share sheet: copy instead
    return copyText(text);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(function () { return 'copied'; })
        .catch(function () { return false; });
    }
    // older fallback
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return Promise.resolve('copied');
    } catch (e) { return Promise.resolve(false); }
  }

  // Shop -> customer confirmation, sent from the admin panel.
  function customerMessage(o) {
    var lines = [];
    lines.push('*TiffinExpress* 🍱');
    lines.push('');
    lines.push('Namaste ' + o.customer.name + ' ji,');
    lines.push('Aapka order mil gaya hai ✅');
    lines.push('');
    lines.push('*Order ID:* ' + o.id);
    (o.items || []).forEach(function (i) {
      lines.push('• ' + i.name + (i.qty > 1 ? ' ×' + i.qty : ''));
    });
    lines.push('*Total: ₹' + o.total + '*');
    lines.push('');
    lines.push('Hum jaldi hi confirm karke delivery shuru karenge.');
    lines.push('Koi sawaal ho to isi number par message kar do 🙏');
    return lines.join('\n');
  }

  /* ---------- automatic send (server) ---------- */

  // Try the backend first. It returns {ok:true, whatsapp:'sent'} on success.
  // When the backend is unreachable or not configured, fall back to the
  // one-tap WhatsApp hand-off.
  function sendAuto(o) {
    if (!o) return Promise.resolve({ ok: false, reason: 'no-order' });
    var base = (typeof window.BACKEND_URL === 'string' && window.BACKEND_URL) || '';
    if (!base) return Promise.resolve({ ok: false, reason: 'no-backend', fallback: 'click-to-chat' });
    return fetch(base + '/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(o),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j.ok && j.whatsapp === 'sent') return { ok: true, orderId: j.orderId };
        return { ok: false, status: r.status, reason: j.error || 'send-failed', fallback: 'click-to-chat' };
      });
    }).catch(function (e) {
      return { ok: false, reason: 'network', detail: String(e), fallback: 'click-to-chat' };
    });
  }

  window.WA = {
    buildMessage: buildMessage,
    customerMessage: customerMessage,
    sendOrder: sendOrder,
    sendAuto: sendAuto,
    shareOrder: shareOrder,
    waLink: waLink,
    copyText: copyText,
    shopNumber: shopNumber,
    setShopNumber: setShopNumber,
    SHOP_DEFAULT: SHOP_WHATSAPP,
  };
})();
