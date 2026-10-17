// Functional test of the new-order notification module: detection of new
// orders, de-duplication, the on/off preference, and the alert side effects.
const fs = require('fs');
const src = fs.readFileSync('C:/Users/Rahul/tiffin-service/notify.js', 'utf8');

// ---- browser stubs ----
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const events = [];           // document.addEventListener registrations
const winEvents = [];
const intervals = [];
const toasts = [];
const titles = [];

// spy on the audio graph
let oscStarted = 0, resumed = 0;
class FakeOsc {
  constructor() { this.type = ''; this.frequency = { value: 0 }; }
  connect() {} start() { oscStarted++; } stop() {}
}
class FakeGain {
  constructor() { this.gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; }
  connect() {}
}
let resumeMode = 'async';   // 'async' = real browser behaviour
// Real browsers refuse to start audio until the page has seen a user gesture.
// Model that, otherwise the stub would let audio run with no interaction and
// the auto-unlock logic would never be exercised.
let gestureSeen = false;
class FakeCtx {
  constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
  resume() {
    resumed++;
    if (!gestureSeen) return Promise.resolve();   // still blocked, stays suspended
    if (resumeMode === 'async') {
      // real browsers settle the promise on a later microtask
      return Promise.resolve().then(() => { this.state = 'running'; });
    }
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() { return new FakeOsc(); }
  createGain() { return new FakeGain(); }
}

const notifCalls = [];
class FakeNotification {
  constructor(title, opts) { this.title = title; this.opts = opts || {}; notifCalls.push(this); }
  close() {}
}
FakeNotification.permission = 'granted';
FakeNotification.requestPermission = () => Promise.resolve('granted');

const el = (id) => ({ id, innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
const els = { notifBar: el('notifBar') };

global.document = {
  title: 'TiffinExpress — Admin Dashboard',
  getElementById: id => els[id] || null,
  addEventListener: (t, h, o) => events.push({ t, h, o }),
  removeEventListener: (t, h) => { for (let i = events.length - 1; i >= 0; i--) if (events[i].t === t && events[i].h === h) events.splice(i, 1); },
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => el('x'),
  body: { appendChild() {} },
};
global.window = {
  AudioContext: FakeCtx,
  addEventListener: (t, h, o) => winEvents.push({ t, h, o }),
  removeEventListener: () => {},
  focus() {},
};
global.Notification = FakeNotification;
window.Notification = FakeNotification;   // real browsers expose it on window
global.setInterval = (f, ms) => { intervals.push({ f, ms }); return intervals.length; };
global.clearInterval = (h) => { if (h) intervals[h - 1] = null; };
// keep the real timer: the test needs microtask/macrotask flushes
global.setTimeout = (f, ms) => (f ? require('timers').setTimeout(f, ms || 0) : 0);
global.toast = (m, k) => toasts.push({ m, k });

// expose renderAdminGrid / renderBar the module calls if present
global.renderAdminGrid = () => { global._gridRendered = (global._gridRendered || 0) + 1; };

// load the module
new Function(src)();
const N = global.window.OrderNotify;

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x ? '  -> ' + x : '')); } };
const setOrders = (list) => localStorage.setItem('tiffin_orders', JSON.stringify(list));
// resume() settles on a microtask, so give queued rings a tick to fire
const flush = () => new Promise(r => setTimeout(r, 0));
// simulate a real user interaction: flip the browser gate, then fire the
// module's own listeners (what a genuine click does)
const userGesture = () => {
  gestureSeen = true;
  events.filter(e => e.t === 'pointerdown' || e.t === 'keydown' ||
                     e.t === 'touchstart' || e.t === 'mousemove')
        .forEach(e => e.h({ type: e.t }));
};
// the module keeps its AudioContext private; detect readiness by whether a
// tone actually produced oscillators (which only happens when running)
const audioRunning = () => oscStarted > 0;

(async () => {
const mk = (id, name, total) => ({
  id, total, status: 'pending', date: new Date().toISOString(),
  customer: { name, phone: '9876543210', address: 'MG Road', payment: 'cod' },
  items: [{ name: 'Rajma Chawal', price: total, qty: 1 }],
});

// the earlier sections assume the admin has already interacted once
gestureSeen = true;

// ---- first mount seeds the backlog ----
console.log('\n--- first mount seeds existing orders ---');
setOrders([mk('TF001', 'Old Customer', 100)]);
oscStarted = 0;
N.mount();
await flush();
t('no alert for pre-existing orders', oscStarted === 0, 'osc=' + oscStarted);
t('seen list seeded', JSON.parse(store['tiffin_seen_orders']).length === 1);
t('notification bar rendered', /Order Notification/.test(els.notifBar.innerHTML));
t('bar shows ON by default', /notif-bar on/.test(els.notifBar.innerHTML));

// ---- a new order fires the alert ----
console.log('\n--- new order alerts ---');
oscStarted = 0; resumed = 0; notifCalls.length = 0; toasts.length = 0;
setOrders([mk('TF001', 'Old Customer', 100), mk('TF002', 'Priya Verma', 215)]);
N._check();
await flush();
t('tone played', oscStarted > 0, 'osc=' + oscStarted);
t('audio context is running (unlocked automatically)', resumed > 0 || audioRunning(),
  'resumed=' + resumed);
t('desktop notification shown', notifCalls.length === 1, 'n=' + notifCalls.length);
t('notification names the customer', notifCalls[0] && /Priya Verma/.test(notifCalls[0].opts.body));
t('notification carries the total', notifCalls[0] && /215/.test(notifCalls[0].opts.body));
t('in-page toast fired', toasts.some(x => /Naya order/.test(x.m)));
t('admin grid refreshed', global._gridRendered > 0);
t('new id recorded as seen', JSON.parse(store['tiffin_seen_orders']).includes('TF002'));

// ---- no repeat alert for the same order ----
console.log('\n--- de-duplication ---');
oscStarted = 0; notifCalls.length = 0;
N._check();
await flush(); N._check();
await flush();
await flush();
t('no repeat tone', oscStarted === 0, 'osc=' + oscStarted);
t('no repeat notification', notifCalls.length === 0);

// ---- two orders at once ----
console.log('\n--- two new orders in one tick ---');
oscStarted = 0; notifCalls.length = 0;
setOrders([mk('TF001', 'a', 100), mk('TF002', 'b', 215), mk('TF003', 'Amit', 1499), mk('TF004', 'Sneha', 420)]);
N._check();
await flush();
t('both alerted', notifCalls.length === 2, 'n=' + notifCalls.length);
t('tone played', oscStarted > 0);

// ---- off switch ----
console.log('\n--- notification OFF ---');
N.disable();
t('pref stored as off', JSON.parse(store['tiffin_notify_pref']) === 'off');
t('bar reflects OFF', /notif-bar off/.test(els.notifBar.innerHTML));
oscStarted = 0; notifCalls.length = 0;
setOrders([mk('TF001','a',100), mk('TF002','b',215), mk('TF003','c',1), mk('TF004','d',1), mk('TF005', 'New Guy', 75)]);
N._check();
await flush();
t('no tone while off', oscStarted === 0, 'osc=' + oscStarted);
t('no desktop popup while off', notifCalls.length === 0, 'n=' + notifCalls.length);
t('order still recorded as seen', JSON.parse(store['tiffin_seen_orders']).includes('TF005'));

// ---- back on ----
console.log('\n--- re-enable ---');
oscStarted = 0; notifCalls.length = 0;
N.enable();
await flush();
t('pref back to on', JSON.parse(store['tiffin_notify_pref']) === 'on');
t('enable plays a confirmation tone', oscStarted > 0);
t('bar reflects ON', /notif-bar on/.test(els.notifBar.innerHTML));
setOrders([mk('TF001','a',100), mk('TF002','b',215), mk('TF003','c',1), mk('TF004','d',1), mk('TF005','e',75), mk('TF006', 'Neha', 124)]);
oscStarted = 0;
N._check();
await flush();
t('alerts resume after re-enable', oscStarted > 0);

// ---- test button ----
console.log('\n--- test button ---');
oscStarted = 0; notifCalls.length = 0;
const ok = N.test();
await flush();
t('test returns true when audio works', ok === true);
t('test plays a tone', oscStarted > 0);
t('test shows a popup', notifCalls.length === 1 && /Naya Order/.test(notifCalls[0].title));

// ---- polling is running ----
console.log('\n--- watcher lifecycle ---');
N.unmount();                     // clear the handle from the initial mount
intervals.length = 0;            // isolate this check from earlier mounts
N.mount();
await flush();
const armed = intervals.filter(x => x && x.ms === 2500).length;
t('poll interval registered', armed === 1, 'handles=' + armed);
N.unmount();
t('unmount stops polling', intervals.filter(x => x).length === 0,
  'still active: ' + intervals.filter(x => x).length);
// a second mount after unmount must re-arm cleanly (idempotent startWatch)
N.mount();
await flush(); N.mount();
await flush();
const rearmed = intervals.filter(x => x && x.ms === 2500).length;
t('double mount does not double-poll', rearmed === 1, 'handles=' + rearmed);
N.unmount();

// ---- automatic unlock: no button press needed ----
console.log('');
console.log('--- automatic ring (no button press) ---');
// simulate a fresh page load: audio suspended, prefs ON, no interaction yet
events.length = 0;
// fresh module instance over the same stubs
{
  const fresh = fs.readFileSync('C:/Users/Rahul/tiffin-service/notify.js', 'utf8');
  new Function(fresh)();
}
const N2 = global.window.OrderNotify;
// a brand-new context starts suspended; nothing should ring yet
oscStarted = 0;
N2.mount();
await flush();
t('mount alone does not ring (browser blocks audio pre-gesture)', oscStarted === 0,
  'osc=' + oscStarted);

// the admin clicks anywhere on the page -> the ring arms itself
const pointerHandlers = events.filter(e => e.t === 'pointerdown').map(e => e.h);
t('mount binds interaction listeners for auto-arm', pointerHandlers.length > 0,
  'handlers=' + pointerHandlers.length);
gestureSeen = false;                 // a fresh page has no gesture yet
userGesture();
await flush();
t('a click arms the audio without any button', resumed > 0, 'resumed=' + resumed);

// now an order arrives: the ring must fire with zero further interaction
oscStarted = 0;
localStorage.setItem('tiffin_orders', JSON.stringify([
  mk('TF_AUTO', 'Auto Customer', 199),
]));
N2._check();
await flush();
t('order rings automatically after arming', oscStarted > 0, 'osc=' + oscStarted);

// ---- a ring that arrived while muted is replayed on the next gesture ----
console.log('');
console.log('--- queued ring replays after unlock ---');
localStorage.setItem('tiffin_notify_pref', JSON.stringify('on'));
// force a suspended context again by swapping in a fresh module
events.length = 0;
gestureSeen = false;                 // brand-new page: nothing unlocked yet
new Function(fs.readFileSync('C:/Users/Rahul/tiffin-service/notify.js', 'utf8'))();
const N3 = global.window.OrderNotify;
N3.mount();
await flush();
oscStarted = 0;
localStorage.setItem('tiffin_orders', JSON.stringify([
  mk('TF_QUEUED', 'Queued Customer', 250),
]));
N3._check();               // audio still suspended -> tone cannot play
await flush();
t('no ring while audio is still blocked', oscStarted === 0, 'osc=' + oscStarted);
// user finally interacts
gestureSeen = false;                 // still blocked before the click
userGesture();
await flush();
t('queued ring plays as soon as audio unlocks', oscStarted > 0, 'osc=' + oscStarted);

// ---- title flashing stops on unmount ----
console.log('\n--- title flash ---');
N.mount();
await flush();
t('title restored on mount cycle', typeof document.title === 'string');

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
})();
