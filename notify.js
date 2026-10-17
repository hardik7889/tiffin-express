/* ============================================================
   notify.js — new-order alerts for the admin dashboard
   ------------------------------------------------------------
   When a customer places an order the admin gets:
     * a two-note chime (Web Audio, no audio file needed)
     * a desktop notification via the Notification API
     * a flashing browser-tab title
     * an in-page toast

   Detection has no backend to lean on, so it watches localStorage:
     * the `storage` event fires in OTHER tabs of the same browser
       (customer orders in tab A -> admin tab B is alerted)
     * a poll catches same-tab orders and anything the event misses

   Browsers block audio and notifications until the user interacts, so
   the admin turns alerts on once with the button in the panel; after
   that a one-shot listener re-arms the audio context on first click.

   This only fires while the admin page is open in some browser. Push
   that reaches a phone with the browser closed needs a server.
   ============================================================ */

(function () {
  'use strict';

  var SEEN_KEY = 'tiffin_seen_orders';   // order ids already alerted on
  var PREF_KEY = 'tiffin_notify_pref';   // 'on' | 'off'
  var POLL_MS = 2500;

  var audioCtx = null;
  var pollTimer = null;
  var titleTimer = null;
  var unlockBound = false;
  var pendingTone = 0;          // orders that arrived while audio was blocked
  var lastAlertIds = [];

  /* ---------- storage helpers ---------- */

  function readJSON(k, dflt) {
    try {
      var v = JSON.parse(localStorage.getItem(k));
      return (v === null || v === undefined) ? dflt : v;
    } catch (e) { return dflt; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function allOrders() { return readJSON('tiffin_orders', []); }
  function seenIds() { return readJSON(SEEN_KEY, null); }
  function pref() { return readJSON(PREF_KEY, 'on'); }
  function isOn() { return pref() === 'on'; }

  /* ---------- audio ---------- */

  // resume() is asynchronous in real browsers: the state stays 'suspended'
  // until the promise settles, so a tone fired in the same tick would be
  // dropped. Remember the pending resume and flush any queued ring when it
  // resolves.
  function unlockAudio() {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') {
        var p = audioCtx.resume();
        if (p && p.then) {
          p.then(function () {
            // Play the queued ring directly — calling unlockAudio again here
            // would re-enter this branch and loop forever.
            if (isOn() && pendingTone > 0 && audioReady()) {
              var n = pendingTone;
              if (rawTone(n)) pendingTone = 0;
            }
            renderBar();
          }).catch(function () {});
        }
      }
      return true;
    } catch (e) { return false; }
  }

  // Plays the chime on an already-running context. No unlocking here, so
  // callers that are themselves inside the unlock path cannot recurse.
  function rawTone(times) {
    if (!audioReady()) return false;
    var reps = times || 1;
    var t0 = audioCtx.currentTime;
    var notes = [[880.00, 0], [1174.66, 0.17], [880.00, 0.40], [1174.66, 0.57]];
    for (var r = 0; r < reps; r++) {
      var off = r * 0.92;
      for (var i = 0; i < notes.length; i++) {
        var f = notes[i][0], at = t0 + off + notes[i][1];
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        // a touch of triangle on top gives the chime a bright, bell-like edge
        var osc2 = audioCtx.createOscillator();
        var gain2 = audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = f * 2;
        gain2.gain.setValueAtTime(0.0001, at);
        gain2.gain.exponentialRampToValueAtTime(0.07, at + 0.015);
        gain2.gain.exponentialRampToValueAtTime(0.0001, at + 0.30);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.62, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        osc.start(at);  osc.stop(at + 0.50);
        osc2.start(at); osc2.stop(at + 0.35);
      }
    }
    return true;
  }

  // Public entry point: make sure the context is awake, then ring.
  function playTone(times) {
    if (!unlockAudio()) return false;
    return rawTone(times);
  }

  // Browsers only allow audio after a real user gesture, and the context is
  // suspended again on every reload. So instead of asking the admin to press
  // a button, keep listening for ANY interaction until the context is truly
  // running — they have to click something to use the page anyway.
  function audioReady() {
    return !!(audioCtx && audioCtx.state === 'running');
  }

  function bindAutoUnlock() {
    if (unlockBound) return;
    unlockBound = true;

    var tryUnlock = function () {
      if (!isOn()) return;
      unlockAudio();
      if (audioReady()) {
        document.removeEventListener('pointerdown', tryUnlock);
        document.removeEventListener('keydown', tryUnlock);
        document.removeEventListener('touchstart', tryUnlock);
        document.removeEventListener('mousemove', tryUnlock);
        // an order came in while we were muted — ring it now, without
        // re-entering the unlock path
        if (pendingTone > 0) {
          var n = pendingTone;
          if (rawTone(n)) pendingTone = 0;
        }
      }
    };

    document.addEventListener('pointerdown', tryUnlock, { passive: true });
    document.addEventListener('keydown', tryUnlock);
    document.addEventListener('touchstart', tryUnlock, { passive: true });
    document.addEventListener('mousemove', tryUnlock, { passive: true });
  }

  /* ---------- notifications ---------- */

  function permission() {
    return ('Notification' in window) ? Notification.permission : 'unsupported';
  }

  function askPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    try { Notification.requestPermission().then(renderBar); } catch (e) {}
  }

  // Ask on load AND on the first gesture — some browsers only honour the
  // prompt when it comes from a user action.
  var permBound = false;
  function bindAutoPermission() {
    if (permBound) return;
    permBound = true;
    var h = function () { if (isOn()) askPermission(); };
    document.addEventListener('pointerdown', h, { passive: true });
    document.addEventListener('keydown', h);
  }

  function showDesktop(o) {
    if (permission() !== 'granted') return;
    var items = (o.items || []).map(function (i) {
      return i.name + (i.qty > 1 ? ' ×' + i.qty : '');
    }).join(', ');
    var body = (o.customer ? o.customer.name : 'Customer') + ' — ₹' + o.total
             + (items ? '\n' + items : '')
             + (o.customer && o.customer.phone ? '\n📞 ' + o.customer.phone : '');
    try {
      var n = new Notification('🔔 Naya Order Aaya!', {
        body: body,
        tag: o.id,                 // replaces instead of stacking per order
        requireInteraction: true,  // stays until dismissed — it's an order
      });
      n.onclick = function () { try { window.focus(); } catch (e) {} n.close(); };
      return n;
    } catch (e) { return null; }
  }

  function flashTitle() {
    if (titleTimer) return;
    var base = document.title;
    var on = false;
    titleTimer = setInterval(function () {
      document.title = on ? base : '🔔 NAYA ORDER — TiffinExpress';
      on = !on;
    }, 850);
    var stop = function () { stopTitleFlash(); };
    window.addEventListener('focus', stop, { once: true });
  }

  function stopTitleFlash() {
    if (titleTimer) { clearInterval(titleTimer); titleTimer = null; }
    document.title = 'TiffinExpress — Admin Dashboard';
  }

  /* ---------- new-order detection ---------- */

  // Returns ids that appeared since the last check, and records them.
  // `markAll` seeds the set on the very first run so the orders that were
  // already sitting in storage don't all fire at once.
  function syncSeen(markAll) {
    var ids = allOrders().map(function (o) { return o.id; });
    var s = seenIds();
    if (s === null || markAll) { writeJSON(SEEN_KEY, ids); return []; }
    var fresh = ids.filter(function (id) { return s.indexOf(id) === -1; });
    if (fresh.length) writeJSON(SEEN_KEY, s.concat(fresh));
    return fresh;
  }

  function alertOrder(o) {
    if (!isOn()) return;          // master switch: off means fully silent
    if (!playTone(2)) pendingTone = 2;   // muted by the browser — ring on next click
    showDesktop(o);
    flashTitle();
    if (typeof toast === 'function') {
      toast('🔔 Naya order: ' + (o.customer ? o.customer.name : o.id) + ' — ₹' + o.total);
    }
  }

  function check() {
    // self-clean when the admin panel is no longer on screen
    if (!document.getElementById('notifBar')) { stopWatch(); return; }

    var fresh = syncSeen(false);
    if (!fresh.length) return;

    // An order placed in another tab lives in localStorage but not in this
    // tab's in-memory array, so pull the latest list before rendering —
    // otherwise the new order stays invisible until a manual reload.
    if (typeof window.reloadOrders === 'function') window.reloadOrders();

    var list = allOrders();
    lastAlertIds = fresh.slice();
    fresh.forEach(function (id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { alertOrder(list[i]); break; }
      }
    });

    // surface the new rows immediately
    if (typeof renderAdminGrid === 'function') renderAdminGrid();
    if (typeof renderBar === 'function') renderBar();
  }

  function onStorage(e) {
    if (e && e.key && e.key !== 'tiffin_orders') return;
    check();
  }

  function startWatch() {
    if (pollTimer) return;
    window.addEventListener('storage', onStorage);
    pollTimer = setInterval(check, POLL_MS);
  }

  function stopWatch() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    window.removeEventListener('storage', onStorage);
  }

  /* ---------- panel UI ---------- */

  function renderBar() {
    var host = document.getElementById('notifBar');
    if (!host) return;
    var on = isOn();
    var p = permission();
    var permTxt = p === 'granted' ? 'Desktop popup: ON'
                : p === 'denied' ? 'Desktop popup: browser ne block kiya — site settings se allow karo'
                : p === 'unsupported' ? 'Desktop popup: is browser mein available nahi'
                : 'Desktop popup: permission pending — button dabao';

    host.innerHTML = ''
      + '<div class="notif-bar ' + (on ? 'on' : 'off') + '">'
      +   '<div class="notif-ico">' + (on ? '🔔' : '🔕') + '</div>'
      +   '<div class="notif-txt">'
      +     '<b>Order Notification ' + (on ? 'ON — Automatic' : 'OFF') + '</b>'
      +     '<span>' + (on
              ? 'Order aate hi ring khud bajegi — kuch dabane ki zarurat nahi'
              : 'Ring aur popup band hai — order ka pata nahi chalega') + '</span>'
      +     '<span class="notif-perm">' + permTxt
      +       (on && !audioReady() ? ' · pehla click par ring arm ho jayegi' : '')
      +     '</span>'
      +   '</div>'
      +   '<div class="notif-actions">'
      +     '<button class="btn btn-sm ' + (on ? 'btn-secondary' : 'btn-green') + '"'
      +       ' onclick="OrderNotify.' + (on ? 'disable' : 'enable') + '()">'
      +       (on ? 'Band karo' : '🔔 Chalu karo') + '</button>'
      +     '<button class="btn btn-sm btn-secondary" onclick="OrderNotify.test()">🔊 Test</button>'
      +   '</div>'
      + '</div>';
  }

  /* ---------- public API ---------- */

  function mount() {
    // first ever visit: treat the existing backlog as already seen
    syncSeen(seenIds() === null);
    renderBar();
    startWatch();
    bindAutoUnlock();
    bindAutoPermission();
    if (isOn()) {
      askPermission();
      unlockAudio();   // works if the page already had a gesture this session
    }
  }

  function enable() {
    writeJSON(PREF_KEY, 'on');
    unlockAudio();
    askPermission();
    var ok = playTone(1);
    renderBar();
    if (typeof toast === 'function') {
      toast(ok ? '🔔 Notification ON — tone ready'
               : '🔔 Notification ON — tone pehle click par bajega',
            ok ? 'success' : 'error');
    }
  }

  function disable() {
    writeJSON(PREF_KEY, 'off');
    stopTitleFlash();
    renderBar();
    if (typeof toast === 'function') toast('🔕 Notification band kar diya');
  }

  function test() {
    var ok = playTone(1);
    showDesktop({
      id: 'TEST', total: 124,
      customer: { name: 'Test Customer', phone: '9876543210' },
      items: [{ name: 'Rajma Chawal', qty: 1 }],
    });
    flashTitle();
    setTimeout(stopTitleFlash, 2600);
    if (typeof toast === 'function') {
      toast(ok ? '🔊 Test ring baj gayi — order par bhi aise hi bajegi'
               : 'Pehle page par ek baar click karo, phir Test dabao',
            ok ? 'success' : 'error');
    }
    return ok;
  }

  // called right after an order is placed in this same tab, so the alert
  // doesn't have to wait for the next poll tick
  function checkNow() { check(); }

  window.OrderNotify = {
    mount: mount,
    unmount: stopWatch,
    enable: enable,
    disable: disable,
    test: test,
    play: playTone,
    checkNow: checkNow,
    renderBar: renderBar,
    isOn: isOn,
    // exposed for tests
    _syncSeen: syncSeen,
    _check: check,
    _permission: permission,
  };
})();
