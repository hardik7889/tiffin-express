// Tests for the WhatsApp order hand-off: message building, the wa.me link,
// the shop-number setting, and the order card wiring.
const fs = require('fs');
const src = fs.readFileSync('C:/Users/Rahul/tiffin-service/whatsapp.js', 'utf8');

// ---- browser stubs ----
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
let opened = [];
let clipboard = '';
global.window = {
  open: (u, t, f) => { opened.push(u); return {}; },
};
// Node 21+ exposes `navigator` as a read-only global, so a plain assignment
// is silently ignored — define it instead.
const navStub = {
  clipboard: { writeText: t => { clipboard = t; return Promise.resolve(); } },
};
Object.defineProperty(global, 'navigator', {
  value: navStub, writable: true, configurable: true,
});
global.navStub = navStub;
global.location = {};
global.document = {
  createElement: () => ({ style: {}, select() {}, remove() {} }),
  body: { appendChild() {} },
  execCommand: () => true,
};

new Function(src)();
const WA = global.window.WA;

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x ? '  -> ' + x : '')); } };

const ORDER = {
  id: 'TF123ABC',
  total: 314,
  delivery: 49,
  subtotal: 265,
  singleBuy: false,
  date: new Date().toISOString(),
  customer: {
    name: 'Rahul Sharma', phone: '9876543210',
    address: 'Scheme 54, Vijay Nagar, Indore', payment: 'cod',
    lat: 22.7196, lon: 75.8577,
  },
  items: [
    { name: 'Rajma Chawal', price: 75, qty: 1 },
    { name: 'Veg Biryani', price: 100, qty: 1 },
    { name: 'Paneer Tikka Masala + 4 Roti + Rice', price: 90, qty: 1 },
  ],
};

(async () => {
  console.log('\n--- message building ---');
  const msg = WA.buildMessage(ORDER);
  t('has a header', /NAYA ORDER/.test(msg) && /TiffinExpress/.test(msg));
  t('includes the order id', msg.includes('TF123ABC'));
  t('includes the customer name', msg.includes('Rahul Sharma'));
  t('includes the phone', msg.includes('9876543210'));
  t('includes the address', msg.includes('Vijay Nagar, Indore'));
  t('includes every item', ORDER.items.every(i => msg.includes(i.name)));
  t('includes the total', /\*Total: ₹314\*/.test(msg), msg.split('\n').filter(l=>/Total/.test(l)).join('|'));
  t('shows the delivery charge', /Delivery: ₹49/.test(msg));
  t('includes a map link when coords exist', /google\.com\/maps\?q=22\.7196,75\.8577/.test(msg));
  t('uses WhatsApp bold markers', msg.includes('*'));
  t('is multi-line', msg.split('\n').length > 8);

  console.log('\n--- free-delivery order ---');
  const freeOrder = { ...ORDER, delivery: 0, total: 265, customer: { ...ORDER.customer, lat: null, lon: null } };
  const msg2 = WA.buildMessage(freeOrder);
  t('says FREE when there is no charge', /Delivery: FREE/.test(msg2));
  t('omits the map link without coords', !/google\.com\/maps/.test(msg2));

  console.log('\n--- payment labels ---');
  t('cod label', /Cash on Delivery/.test(WA.buildMessage(ORDER)));
  t('upi label', /UPI/.test(WA.buildMessage({ ...ORDER, customer: { ...ORDER.customer, payment: 'upi' } })));
  t('card label', /Card/.test(WA.buildMessage({ ...ORDER, customer: { ...ORDER.customer, payment: 'card' } })));

  console.log('\n--- wa.me link ---');
  const link = WA.waLink('hello world', '919876543210');
  t('points at wa.me', link.indexOf('https://wa.me/') === 0);
  t('carries the number', link.includes('919876543210'));
  t('url-encodes the text', link.includes('hello%20world'), link);

  console.log('\n--- shop number setting ---');
  t('default number is the configured one', WA.shopNumber() === WA.SHOP_DEFAULT);
  t('setShopNumber accepts a valid number', WA.setShopNumber('919812345678') === true);
  t('the new number is used', WA.shopNumber() === '919812345678');
  t('strips spaces and dashes', WA.setShopNumber('+91 98123-45678') === true && WA.shopNumber() === '919812345678');
  t('rejects a too-short number', WA.setShopNumber('123') === false);
  t('rejects a non-numeric number', WA.setShopNumber('abcdefghij') === false);
  t('keeps the last good value after a bad set', WA.shopNumber() === '919812345678');

  console.log('\n--- sending ---');
  opened = [];
  const url = WA.sendOrder(ORDER);
  t('sendOrder opens a tab', opened.length === 1, 'opened=' + opened.length);
  t('opens WhatsApp', opened[0].indexOf('https://wa.me/') === 0);
  t('uses the configured shop number', opened[0].includes('919812345678'));
  t('returns the url', url === opened[0]);
  t('the typed message rides in the link',
    decodeURIComponent(opened[0]).includes('Rahul Sharma') &&
    decodeURIComponent(opened[0]).includes('TF123ABC'));

  console.log('\n--- sending to a specific number (shop -> customer) ---');
  opened = [];
  const cmsg = WA.customerMessage(ORDER);
  t('customer message greets by name', /Namaste Rahul Sharma ji/.test(cmsg));
  t('customer message has the order id', cmsg.includes('TF123ABC'));
  t('customer message has the total', /Total: ₹314/.test(cmsg));
  t('customer message lists items', cmsg.includes('Rajma Chawal'));
  t('customer message does not leak the address', !/Vijay Nagar/.test(cmsg));

  console.log('\n--- share sheet ---');
  let shared = null;
  global.navStub.share = (d) => { shared = d; return Promise.resolve(); };
  const okShare = await WA.shareOrder(ORDER);
  t('shareOrder uses the native share sheet', okShare === true && shared !== null);
  t('share payload carries the order text', /NAYA ORDER/.test(shared.text));
  t('share payload has a title', /TF123ABC/.test(shared.title));

  console.log('\n--- share fallback when there is no share sheet ---');
  delete global.navStub.share;
  clipboard = '';
  const okCopy = await WA.shareOrder(ORDER);
  t('falls back to copying', okCopy === 'copied');
  t('the clipboard got the order', /NAYA ORDER/.test(clipboard) && clipboard.includes('TF123ABC'));

  console.log('\n--- copy helper ---');
  clipboard = '';
  const ok = await WA.copyText('test text');
  t('copyText resolves', ok === 'copied');
  t('clipboard holds the text', clipboard === 'test text');

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH:', e.message); console.log(e.stack.split('\n').slice(0, 4).join('\n')); process.exit(1); });
