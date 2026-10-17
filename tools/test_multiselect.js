// Tests for multi-select + flat once-per-order delivery.
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
// a fake DOM element that understands classList + a parent-child tree
function makeEl(id) {
  const el = {
    id, _h: '', style: {}, dataset: {}, _cls: new Set(), onclick: null, value: '',
    children: [],
    get innerHTML() { return this._h; },
    set innerHTML(v) { this._h = v; registerIds(v, this); },
    classList: {
      add: c => el._cls.add(c),
      remove: c => el._cls.delete(c),
      toggle: (c, on) => { if (on === undefined) el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); else on ? el._cls.add(c) : el._cls.delete(c); },
      contains: c => el._cls.has(c),
    },
    setAttribute(k, v) { this['_' + k] = v; },
    getAttribute(k) { return this['_' + k]; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, remove() {},
    replaceWith() {},
    scrollIntoView() {},
  };
  return el;
}
const allEls = [];
function registerIds(h, parent) {
  const re = /id="([A-Za-z0-9_-]+)"/g; let m;
  while ((m = re.exec(h))) {
    if (!global.document._els[m[1]]) {
      const el = makeEl(m[1]);
      global.document._els[m[1]] = el;
      allEls.push(el);
    }
  }
}
// querySelectorAll must answer the class lookups the module makes
function matchClass(sel) {
  const cls = sel.replace(/^\./, '').split('.').filter(Boolean);
  return allEls.filter(e => cls.every(c => e._cls.has(c)));
}
global.document = {
  _els: {},
  getElementById: id => global.document._els[id] || null,
  querySelector: sel => matchClass(sel)[0] || null,
  querySelectorAll: sel => matchClass(sel),
  createElement: () => makeEl('tmp'),
  addEventListener: () => {},
  body: { appendChild: n => { nodes.push(n); } },
  readyState: 'complete',
};
global.window = { addEventListener: () => {}, matchMedia: () => ({ matches: false }), innerWidth: 1400, innerHeight: 900, scrollTo: () => {} };
global.location = { hash: '', set href(v) {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.setTimeout = (f, ms) => require('timers').setTimeout(f, ms || 0);
global.confirm = () => true;
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 0;
global.FOOD_ART = {}; global.TAG_CLASS = {};
global.DISH_PHOTOS = {}; global.PKG_PHOTOS = {};
global.toast = () => {};
global.renderAdminGrid = () => {};

const appEl = makeEl('app');
global.document._els.app = appEl;
allEls.push(appEl);

const wrapped = inline + `
;module.exports = { MENU, cart: () => cart, setCart: v => { cart = v; }, orders: () => orders,
  picked: () => picked, setPicked: v => { picked = v; },
  deliveryFor, isSingleBuy, isPackageLine, cartDelivery, cartTotal,
  togglePick, clearPicks, pickedItems, addPickedToCart, buyPicked, selectAllVisible,
  addToCart, buyNow, showCheckout, placeOrder, pkgToItem, PACKAGES, SINGLE_DELIVERY };
`;
const mod = { exports: {} };
new Function('module', 'exports', wrapped)(mod, mod.exports);
const api = mod.exports;

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x ? '  -> ' + x : '')); } };
const pkgLine = (id) => api.pkgToItem(api.PACKAGES.find(p => p.id === id), 'week');

console.log('\n--- flat delivery rule ---');
t('1 dish -> Rs 49', api.deliveryFor([{ id:'l1', price:75, qty:1 }]) === 49);
t('2 dishes -> still Rs 49', api.deliveryFor([{ id:'l1', price:75, qty:1 }, { id:'d1', price:65, qty:1 }]) === 49);
t('5 dishes -> still Rs 49', api.deliveryFor([1,2,3,4,5].map(i => ({ id:'x'+i, price:50, qty:1 }))) === 49);
t('1 dish qty 3 -> Rs 49 once', api.deliveryFor([{ id:'l1', price:75, qty:3 }]) === 49);
t('package only -> FREE', api.deliveryFor([pkgLine('full')]) === 0);
t('two packages -> FREE', api.deliveryFor([pkgLine('full'), pkgLine('bf')]) === 0);
t('package + dish -> Rs 49', api.deliveryFor([pkgLine('full'), { id:'l1', price:75, qty:1 }]) === 49);
t('empty -> 0', api.deliveryFor([]) === 0);

console.log('\n--- multi-select state ---');
api.setCart([]);
api.clearPicks();
api.togglePick('l1');
t('one id picked', api.picked().length === 1);
api.togglePick('d1'); api.togglePick('b1');
t('three ids picked', api.picked().length === 3, 'n=' + api.picked().length);
api.togglePick('d1');
t('toggling again deselects', api.picked().length === 2 && !api.picked().includes('d1'));

const items = api.pickedItems();
t('pickedItems resolves to menu objects', items.length === 2 && items[0].name && items[0].price);
t('resolved the right dishes', items.map(i => i.id).sort().join(',') === 'b1,l1', items.map(i => i.id).join(','));

console.log('\n--- select all ---');
api.selectAllVisible();
t('select all picks every dish', api.picked().length === 21, 'n=' + api.picked().length);
t('select all resolves cleanly', api.pickedItems().length === 21);

console.log('\n--- bulk add to cart ---');
api.clearPicks(); api.setCart([]);
api.togglePick('l1');   // Rajma Chawal 75
api.togglePick('l5');   // Veg Biryani 100
api.togglePick('d3');   // Paneer Tikka Masala 90
api.addPickedToCart();
t('all three landed in the cart', api.cart().length === 3, 'cart=' + api.cart().length);
t('cart holds the right ids', api.cart().map(c => c.id).sort().join(',') === 'd3,l1,l5', api.cart().map(c=>c.id).join(','));
t('subtotal 265', api.cart().reduce((s,i)=>s+i.price*i.qty,0) === 265);
t('delivery charged once (49)', api.cartDelivery() === 49);
t('cart total 314', api.cartTotal() === 314, 'total=' + api.cartTotal());
t('picks cleared after adding', api.picked().length === 0);

console.log('\n--- adding again bumps quantity, not delivery ---');
api.togglePick('l1');
api.addPickedToCart();
t('same dish increments qty', api.cart().find(c => c.id === 'l1').qty === 2);
t('delivery still 49', api.cartDelivery() === 49);
t('cart total 389', api.cartTotal() === 389, 'total=' + api.cartTotal());

console.log('\n--- bulk buy (skips the cart) ---');
api.clearPicks(); api.setCart([]);
api.togglePick('b3');   // Idli Sambar 55
api.togglePick('b6');   // Chole Bhature 70
api.buyPicked();
const m1 = nodes[nodes.length - 1];
t('checkout modal opened', !!m1);
t('modal says Buy Selected Items', /Buy Selected Items/.test(m1.innerHTML));
t('modal lists both dishes', /Idli Sambar/.test(m1.innerHTML) && /Chole Bhature/.test(m1.innerHTML));
t('subtotal 125 shown', /₹125/.test(m1.innerHTML), m1.innerHTML.match(/₹\d+/g));
t('delivery 49 shown once', /₹49/.test(m1.innerHTML));
t('total 174 shown', /₹174/.test(m1.innerHTML), m1.innerHTML.match(/₹\d+/g));
t('cart untouched by bulk buy', api.cart().length === 0);

console.log('\n--- placing the bulk order ---');
document._els.chkName = { value: 'Rahul' };
document._els.chkPhone = { value: '9876543210' };
document._els.chkAddress = { value: 'MG Road' };
document._els.chkPayment = { value: 'cod' };
api.placeOrder(api.pickedItems().map(i => ({ ...i, qty: 1 })), { fromSelection: true });
const ord = api.orders()[0];
t('one order created', api.orders().length === 1);
t('order has both dishes', ord.items.length === 2);
t('order subtotal 125', ord.subtotal === 125, 'sub=' + ord.subtotal);
t('order delivery is 49 once', ord.delivery === 49, 'del=' + ord.delivery);
t('order total 174', ord.total === 174, 'total=' + ord.total);
t('not flagged as single-item', ord.singleBuy === false);

console.log('\n--- package-only order ships free ---');
api.setCart([]);
api.showCheckout([pkgLine('full')], { fromSelection: true });
const m2 = nodes[nodes.length - 1];
t('package modal shows FREE delivery', /FREE/.test(m2.innerHTML));
t('no Rs 49 in a package order', !/₹49/.test(m2.innerHTML), m2.innerHTML.match(/₹\d+/g));
t('package total is just the package', /₹1499/.test(m2.innerHTML));

console.log('\n--- single instant buy still works ---');
api.setCart([]);
api.buyNow('l1');
const m3 = nodes[nodes.length - 1];
t('single buy modal opens', !!m3);
t('single buy charges 49', /₹49/.test(m3.innerHTML));
t('single buy total 124', /₹124/.test(m3.innerHTML), m3.innerHTML.match(/₹\d+/g));
t('cart untouched by single buy', api.cart().length === 0);

console.log('\n--- one dish via bulk buy is still Rs 49 once ---');
api.setCart([]);
api.clearPicks();
api.togglePick('l1');
api.buyPicked();
const m4 = nodes[nodes.length - 1];
t('one picked dish -> 49', /₹49/.test(m4.innerHTML));
t('total 124 not 75', /₹124/.test(m4.innerHTML), m4.innerHTML.match(/₹\d+/g));

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
