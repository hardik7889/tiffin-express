// Headless functional test of the single-item buy flow.
// Runs against the local static server with jsdom-free plain DOM stubs is
// awkward, so instead we drive the real page in Brave via --dump-dom after
// injecting a script that exercises the flow and prints results.
//
// Simpler approach: evaluate the page's own functions in Node by extracting
// the inline script and stubbing the few browser globals it needs.
const fs = require('fs');
const path = 'C:/Users/Rahul/tiffin-service/index.html';
const html = fs.readFileSync(path, 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- minimal browser stubs ----
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const nodes = [];
// register any id="..." found in an appended node's markup, so the page's
// getElementById lookups resolve the way they would in a real DOM
function registerIds(html) {
  const re = /id="([A-Za-z0-9_-]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (!global.document._els[m[1]]) global.document._els[m[1]] = { value: '', onclick: null, innerHTML: '' };
  }
}
global.document = {
  _els: {},
  getElementById: id => global.document._els[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {},
    set innerHTML(v) { this._h = v; registerIds(v); },
    get innerHTML() { return this._h || ''; },
    remove() {},
  }),
  addEventListener: () => {},
  body: { appendChild: n => { nodes.push(n); if (n._h) registerIds(n._h); } },
  readyState: 'complete',
};
// the page's init route() writes into #app — give it a stub element
const appEl = { innerHTML: '', style: {} };
global.document._els.app = appEl;
global.window = { addEventListener: () => {}, matchMedia: () => ({ matches: false }), innerWidth: 1400, innerHeight: 900, scrollTo: () => {} };
global.location = { hash: '', set href(v) {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.setTimeout = (f) => f && 0;
global.confirm = () => true;
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 0;

// FOOD_ART / TAG_CLASS / DISH_PHOTOS / PKG_PHOTOS come from the other files
global.FOOD_ART = {};
global.TAG_CLASS = {};
global.DISH_PHOTOS = { b1: { lqip: 'data:x', title: 't', src: 's' } };
global.PKG_PHOTOS = { pkg_full: { lqip: 'data:x', title: 't', src: 's' } };

// expose the functions the script defines
const wrapped = inline + `
;module.exports = { MENU, PACKAGES, buyNow, showCheckout, placeOrder, addToCart,
  buyCartItem, orderPackage, buyPackageNow, pkgToItem, cart: () => cart, orders: () => orders,
  setCart: v => { cart = v; }, genOrderId };
`;
const mod = { exports: {} };
new Function('module', 'exports', wrapped)(mod, mod.exports);
const api = mod.exports;

// ---- the test ----
let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};

console.log('\n--- single item buy ---');
api.setCart([]);
api.buyNow('l1');                          // Rajma Chawal, Rs 75
const modal = nodes[nodes.length - 1];
t('buyNow opens a checkout modal', !!modal);
t('modal says Buy Now', /Buy Now/.test(modal.innerHTML));
t('modal shows the item', /Rajma Chawal/.test(modal.innerHTML));
t('modal shows correct total', /₹75/.test(modal.innerHTML));
t('cart untouched by buyNow', api.cart().length === 0, 'cart=' + api.cart().length);

console.log('\n--- placing a single-item order ---');
document._els.chkName = { value: 'Rahul' };
document._els.chkPhone = { value: '9876543210' };
document._els.chkAddress = { value: 'MG Road, Indore' };
document._els.chkPayment = { value: 'cod' };
api.placeOrder([{ id: 'l1', name: 'Rajma Chawal', price: 75, qty: 1 }], true);
t('one order created', api.orders().length === 1, 'n=' + api.orders().length);
t('order total is the single item', api.orders()[0] && api.orders()[0].total === 75);
t('order starts pending', api.orders()[0] && api.orders()[0].status === 'pending');
t('cart still empty after single buy', api.cart().length === 0);

console.log('\n--- cart checkout still works ---');
api.setCart([{ id: 'l1', name: 'Rajma Chawal', price: 75, qty: 2 },
             { id: 'd1', name: 'Mix Veg + Roti', price: 65, qty: 1 }]);
api.showCheckout();                        // no args -> uses cart
const m2 = nodes[nodes.length - 1];
t('cart checkout says Checkout', /Checkout/.test(m2.innerHTML));
t('cart total = 215', /₹215/.test(m2.innerHTML), m2.innerHTML.match(/₹\d+/g));
api.placeOrder(api.cart(), false);
t('second order created', api.orders().length === 2);
t('cart emptied by full checkout', api.cart().length === 0);

console.log('\n--- buy one line out of the cart ---');
api.setCart([{ id: 'l1', name: 'Rajma Chawal', price: 75, qty: 2 },
             { id: 'd1', name: 'Mix Veg + Roti', price: 65, qty: 1 }]);
api.buyCartItem('d1');
const m3 = nodes[nodes.length - 1];
t('single-line modal shows only that line', /Mix Veg/.test(m3.innerHTML) && !/Rajma/.test(m3.innerHTML));
t('cart preserved when buying one line', api.cart().length === 2, 'cart=' + api.cart().length);

console.log('\n--- package buy now ---');
api.setCart([]);
api.buyPackageNow('full', 'week');
const m4 = nodes[nodes.length - 1];
t('package modal shows weekly price', /₹1499/.test(m4.innerHTML));
t('package cart untouched', api.cart().length === 0);

console.log('\n--- orderPackage still adds to cart ---');
api.setCart([]);
api.orderPackage('full', 'week');
t('orderPackage adds a line', api.cart().length === 1);
t('line price is weekly', api.cart()[0].price === 1499);
api.orderPackage('full', 'week');
t('same package increments qty', api.cart()[0].qty === 2, 'qty=' + api.cart()[0].qty);

console.log('\n--- addToCart still works ---');
api.setCart([]);
api.addToCart('b3');
t('addToCart adds Idli Sambar', api.cart().length === 1 && api.cart()[0].id === 'b3');
t('price 55', api.cart()[0].price === 55);

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
