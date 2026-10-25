// Functional test of the admin dashboard: filters, search, status
// transitions, counters, and delete.
const fs = require('fs');
const html = fs.readFileSync('C:/Users/Rahul/tiffin-service/index.html', 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- browser stubs ----
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const nodes = [];
function registerIds(h) {
  const re = /id="([A-Za-z0-9_-]+)"/g; let m;
  while ((m = re.exec(h))) if (!global.document._els[m[1]]) global.document._els[m[1]] = { value: '', onclick: null, innerHTML: '' };
}
// querySelectorAll needs to answer .adm-tab lookups for the active class
let tabEls = [];
global.document = {
  _els: {},
  getElementById: id => global.document._els[id] || null,
  querySelector: () => null,
  querySelectorAll: sel => (sel === '.adm-tab' ? tabEls : []),
  createElement: () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {},
    set innerHTML(v) { this._h = v; registerIds(v); },
    get innerHTML() { return this._h || ''; },
    remove() {},
  }),
  addEventListener: () => {},
  body: { appendChild: n => { nodes.push(n); if (n._h) registerIds(n._h); } },
  readyState: 'complete',
};
const appEl = {
  _h: '', style: {},
  set innerHTML(v) { this._h = v; registerIds(v); },
  get innerHTML() { return this._h; },
};
global.document._els.app = appEl;
global.window = { addEventListener: () => {}, matchMedia: () => ({ matches: false }), innerWidth: 1400, innerHeight: 900, scrollTo: () => {} };
global.location = { hash: '', set href(v) {} };
global.sessionStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
global.setTimeout = f => f && 0;
global.confirm = () => true;
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 0;
global.FOOD_ART = {}; global.TAG_CLASS = {};
global.DISH_PHOTOS = {}; global.PKG_PHOTOS = {};

const wrapped = inline + `
;module.exports = { orders: () => orders, setOrders: v => { orders = v; },
  renderOrders, renderAdminLoginOrPanel, renderAdminSection, renderAdminGrid,
  filterAdmin, updateOrderStatus, deleteOrder, deleteCustomerOrder,
  statusCounts, adminVisible, getStatusShort, doAdminLogin, logoutAdmin,
  isAdminGet: () => isAdmin, appEl: () => document.getElementById('app') };
`;
const mod = { exports: {} };
new Function('module', 'exports', wrapped)(mod, mod.exports);
const api = mod.exports;

// ---- helpers ----
let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x ? '  -> ' + x : '')); } };
const mk = (id, status, name, phone, total, delivery) => ({
  id, status, total, delivery: delivery || 0, subtotal: total - (delivery || 0),
  singleBuy: !!delivery, date: new Date().toISOString(),
  customer: { name, phone, address: 'MG Road Indore', payment: 'cod' },
  items: [{ id: 'l1', name: 'Rajma Chawal', price: total - (delivery || 0), qty: 1 }],
  timeline: [{ status: 'pending', time: new Date().toISOString() }],
});

// ---- login gate ----
console.log('\n--- login gate ---');
api.logoutAdmin();
// when signed out, My Orders renders the login card (not the dashboard)
api.renderOrders(appEl);
t('logged out shows password field', /adminPass/.test(appEl.innerHTML));
t('logged out hides the dashboard', !/adm-stats/.test(appEl.innerHTML));

document._els.adminPass = { value: 'wrong' };
api.doAdminLogin();
t('wrong password keeps you out', api.isAdminGet() === false);
document._els.adminPass = { value: 'admin123' };
api.doAdminLogin();
t('correct password logs in', api.isAdminGet() === true);

// ---- dashboard render ----
console.log('\n--- dashboard ---');
api.setOrders([
  mk('TF001', 'pending', 'Rahul Sharma', '9876543210', 124, 49),
  mk('TF002', 'pending', 'Priya Verma', '9812345678', 215),
  mk('TF003', 'accepted', 'Amit Patel', '9800011122', 1500),
  mk('TF004', 'delivering', 'Sneha Rao', '9877700011', 1499),
  mk('TF005', 'delivered', 'Vikram Singh', '9811122233', 420),
  mk('TF006', 'cancelled', 'Neha Gupta', '9822233344', 75),
]);
api.renderOrders(appEl);
api.renderAdminGrid();
const dash = appEl.innerHTML;
t('shows all 6 orders in the tab count', /Saare[\s\S]{0,120}>6</.test(dash), 'count missing');
t('stat block rendered', /adm-stats/.test(dash));
t('shows revenue stat', /Revenue/.test(dash));
t('shows today count', /Today's Orders/.test(dash));
t('search box present', /admSearch/.test(dash));
t('filter tabs present', (dash.match(/adm-tab /g) || []).length === 6, 'tabs=' + (dash.match(/adm-tab /g) || []).length);

// ---- counters ----
console.log('\n--- counters ---');
const c = api.statusCounts();
t('2 pending', c.pending === 2, 'got ' + c.pending);
t('1 accepted', c.accepted === 1);
t('1 delivering', c.delivering === 1);
t('1 delivered', c.delivered === 1);
t('1 cancelled', c.cancelled === 1);

// ---- filter ----
console.log('\n--- filter ---');
api.filterAdmin('pending');
t('pending filter -> 2 rows', (document._els.adminGrid.innerHTML.match(/admin-card/g) || []).length === 2);
api.filterAdmin('delivered');
t('delivered filter -> 1 row', (document._els.adminGrid.innerHTML.match(/admin-card/g) || []).length === 1);
api.filterAdmin('cancelled');
t('cancelled filter -> 1 row', (document._els.adminGrid.innerHTML.match(/admin-card/g) || []).length === 1);
api.filterAdmin('all');
t('all filter -> 6 rows', (document._els.adminGrid.innerHTML.match(/admin-card/g) || []).length === 6);

// ---- search ----
console.log('\n--- search ---');
document._els.admSearch = { value: 'priya' };
api.renderAdminGrid();
t('search by name finds 1', (document._els.adminGrid.innerHTML.match(/admin-card/g) || []).length === 1);
t('the right order', /TF002/.test(document._els.adminGrid.innerHTML));
document._els.admSearch = { value: '9877700011' };
api.renderAdminGrid();
t('search by phone finds 1', /TF004/.test(document._els.adminGrid.innerHTML));
document._els.admSearch = { value: 'tf003' };
api.renderAdminGrid();
t('search by id is case-insensitive', /TF003/.test(document._els.adminGrid.innerHTML));
document._els.admSearch = { value: 'zzzz' };
api.renderAdminGrid();
t('no match shows empty state', /adm-empty/.test(document._els.adminGrid.innerHTML));
document._els.admSearch = { value: '' };

// ---- action buttons per status ----
console.log('\n--- action buttons ---');
api.filterAdmin('all');
const g = () => document._els.adminGrid.innerHTML;
const cardOf = id => {
  const parts = g().split('admin-card');
  return parts.find(p => p.includes(id)) || '';
};
t('pending offers Accept + Cancel', /Accept/.test(cardOf('TF001')) && /Cancel/.test(cardOf('TF001')));
t('accepted offers Deliver + Cancel', /Deliver karne bhejo/.test(cardOf('TF003')) && /Cancel/.test(cardOf('TF003')));
t('delivering offers Delivered + Cancel', /📦 Delivered/.test(cardOf('TF004')) && /Cancel/.test(cardOf('TF004')));
t('delivered offers undo', /Wapas Delivering/.test(cardOf('TF005')));
t('cancelled offers restore', /Restore/.test(cardOf('TF006')));
t('every card has delete', (g().match(/deleteOrder/g) || []).length === 6);
t('delivery charge shown for single buy', /₹49/.test(cardOf('TF001')));
t('FREE delivery shown for cart order', /FREE/.test(cardOf('TF002')));
t('single tag on single buy', /⚡ Single/.test(cardOf('TF001')));
t('timeline chips rendered', /adm-step/.test(cardOf('TF001')));

// ---- status transitions ----
console.log('\n--- status transitions ---');
api.updateOrderStatus('TF001', 'accepted');
t('TF001 -> accepted', api.orders().find(o => o.id === 'TF001').status === 'accepted');
t('timeline appended', api.orders().find(o => o.id === 'TF001').timeline.length === 2);
api.updateOrderStatus('TF001', 'delivering');
api.updateOrderStatus('TF001', 'delivered');
t('TF001 -> delivered', api.orders().find(o => o.id === 'TF001').status === 'delivered');
const c2 = api.statusCounts();
t('counters move with the status', c2.pending === 1 && c2.delivered === 2, JSON.stringify(c2));
t('dashboard re-rendered after change', /adm-stats/.test(appEl.innerHTML));

// cancel a pending order
api.updateOrderStatus('TF002', 'cancelled');
t('TF002 cancelled', api.orders().find(o => o.id === 'TF002').status === 'cancelled');

// ---- delete ----
console.log('\n--- delete ---');
const before = api.orders().length;
api.deleteOrder('TF006');
t('order removed', api.orders().length === before - 1);
t('the right one removed', !api.orders().find(o => o.id === 'TF006'));

// ---- short labels ----
console.log('\n--- labels ---');
t('short label strips emoji', api.getStatusShort('pending') === 'Pending');
t('short label for delivering', api.getStatusShort('delivering') === 'Delivering');

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
