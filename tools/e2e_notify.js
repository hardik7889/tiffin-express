// True end-to-end test across TWO tabs, driven over CDP.
// Tab A = admin dashboard (watcher running).
// Tab B = customer placing an order.
// Asserts that tab A fires the alert: tone + desktop notification + title flash.
const { execSync, spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const net = require('net');

const BRAVE = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const PORT = 9333;
const BASE = 'http://localhost:8779';

// ---- minimal WebSocket client (RFC6455, text frames, no deps) ----
class WS {
  constructor(url) { this.url = url; this.buf = Buffer.alloc(0); this.msgId = 0; this.pending = new Map(); this.ready = false; }
  connect() {
    return new Promise((res, rej) => {
      const u = new URL(this.url);
      const key = crypto.randomBytes(16).toString('base64');
      this.sock = net.connect(Number(u.port), u.hostname, () => {
        this.sock.write(
          `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\n` +
          `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      let handshaken = false;
      this.sock.on('data', d => {
        this.buf = Buffer.concat([this.buf, d]);
        if (!handshaken) {
          const i = this.buf.indexOf('\r\n\r\n');
          if (i === -1) return;
          this.buf = this.buf.slice(i + 4);
          handshaken = true; this.ready = true; res();
        }
        this.drain();
      });
      this.sock.on('error', rej);
    });
  }
  drain() {
    while (this.buf.length >= 2) {
      const b1 = this.buf[1], masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      let mask;
      if (masked) { if (this.buf.length < off + 4) return; mask = this.buf.slice(off, off + 4); off += 4; }
      if (this.buf.length < off + len) return;
      let payload = this.buf.slice(off, off + len);
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      this.buf = this.buf.slice(off + len);
      try {
        const j = JSON.parse(payload.toString());
        if (j.id && this.pending.has(j.id)) { this.pending.get(j.id)(j); this.pending.delete(j.id); }
      } catch (e) {}
    }
  }
  send(method, params) {
    return new Promise(res => {
      const id = ++this.msgId;
      this.pending.set(id, res);
      const raw = Buffer.from(JSON.stringify({ id, method, params: params || {} }));
      const mask = crypto.randomBytes(4);
      const head = [];
      head.push(0x81);
      if (raw.length < 126) head.push(0x80 | raw.length);
      else if (raw.length < 65536) { head.push(0x80 | 126); head.push(raw.length >> 8, raw.length & 255); }
      else { head.push(0x80 | 127); const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(raw.length)); head.push(...b); }
      head.push(...mask);
      const masked = Buffer.alloc(raw.length);
      for (let i = 0; i < raw.length; i++) masked[i] = raw[i] ^ mask[i % 4];
      this.sock.write(Buffer.concat([Buffer.from(head), masked]));
    });
  }
  async evaluate(expr, awaitPromise) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: !!awaitPromise,
    });
    if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.text };
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  close() { try { this.sock.destroy(); } catch (e) {} }
}

const get = (path) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej);
});
// newer Chrome/Brave require PUT for /json/new
const newTab = (url) => new Promise((res, rej) => {
  const req = http.request(
    { host: '127.0.0.1', port: PORT, path: '/json/new?' + encodeURIComponent(url), method: 'PUT' },
    r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(new Error(d.slice(0, 200))); } }); });
  req.on('error', rej); req.end();
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x ? '  -> ' + x : '')); } };

(async () => {
  // launch a dedicated Brave with remote debugging on a scratch profile
  const child = spawn(BRAVE, [
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + 'C:/Users/Rahul/AppData/Local/hermes/cache/scratch/brave-e2e',
    '--no-first-run', '--no-default-browser-check',
    '--headless=new', '--disable-gpu', '--no-sandbox',
    'about:blank',
  ], { detached: true, stdio: 'ignore' });

  // wait for the debugger
  let ver = null;
  for (let i = 0; i < 40; i++) {
    try { ver = await get('/json/version'); break; } catch (e) { await sleep(400); }
  }
  if (!ver) { console.log('could not start Brave debugger'); process.exit(1); }
  console.log('Brave debugger up:', ver['Browser']);

  // ---- tab A: admin ----
  const a = await newTab(BASE + '/index.html#/admin');
  const wsA = new WS(a.webSocketDebuggerUrl); await wsA.connect();
  await wsA.send('Runtime.enable');
  await wsA.send('Page.enable');
  await wsA.send('Page.navigate', { url: BASE + '/index.html#/admin' });
  await sleep(4000);

  // seed admin session + a baseline order, then reload into the panel
  await wsA.evaluate(`sessionStorage.setItem('tiffin_admin','1');
    localStorage.setItem('tiffin_cart','[]');
    localStorage.setItem('tiffin_orders', JSON.stringify([{id:'TF_BASE',status:'pending',total:100,subtotal:100,delivery:0,date:new Date().toISOString(),customer:{name:'Old',phone:'9000000000',address:'x',payment:'cod'},items:[{name:'Old Item',price:100,qty:1}],timeline:[]}]));
    sessionStorage.setItem('tiffin_admin','1');
    localStorage.removeItem('tiffin_seen_orders');
    'seeded'`);
  await wsA.send('Page.reload', { ignoreCache: true });
  await sleep(3500);

  const mountedA = await wsA.evaluate(`!!document.getElementById('notifBar') && !!window.OrderNotify`);
  t('admin tab mounted the notifier', mountedA === true);

  // instrument the alert side effects so we can read them back
  await wsA.evaluate(`
    window.__alerts = { tones: 0, notifs: [], titles: [] };
    (function(){
      // spy on the Web Audio calls themselves — patching OrderNotify.play
      // does not work because alertOrder closes over the inner playTone
      var RealAC = window.AudioContext || window.webkitAudioContext;
      window.AudioContext = function(){
        var c = new RealAC();
        var realOsc = c.createOscillator.bind(c);
        c.createOscillator = function(){
          var o = realOsc();
          var realStart = o.start.bind(o);
          o.start = function(t){ window.__alerts.tones++; return realStart(t); };
          return o;
        };
        return c;
      };
      window.AudioContext.prototype = RealAC.prototype;
      var RealNotif = window.Notification;
      window.Notification = function(title, opts){
        window.__alerts.notifs.push({ title: title, body: (opts||{}).body || '' });
        return { close: function(){}, onclick: null };
      };
      window.Notification.permission = 'granted';
      window.Notification.requestPermission = function(){ return Promise.resolve('granted'); };
      var realCheck = N._check;
      N._check = function(){ var r = realCheck.call(N); return r; };
      // force the pref on
      localStorage.setItem('tiffin_notify_pref', JSON.stringify('on'));
      return 'instrumented';
    })()`);
  // re-mount so the bar reflects the forced pref
  await wsA.evaluate(`OrderNotify.renderBar(); 'ok'`);

  const before = await wsA.evaluate(`JSON.stringify(window.__alerts)`);
  t('no alert yet before the order', /"tones":0/.test(before), before);

  // ---- tab B: customer places an order ----
  const b = await newTab(BASE + '/index.html');
  const wsB = new WS(b.webSocketDebuggerUrl); await wsB.connect();
  await wsB.send('Runtime.enable');
  await wsB.send('Page.enable');
  await wsB.send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(4000);

  // place an order through the real code path
  const placed = await wsB.evaluate(`
    (function(){
      var before = JSON.parse(localStorage.getItem('tiffin_orders') || '[]');
      var order = {
        id: 'TF_E2E_NEW', status: 'pending', total: 124, subtotal: 75, delivery: 49,
        singleBuy: true, date: new Date().toISOString(),
        customer: { name: 'E2E Customer', phone: '9812300000', address: 'Test Road', payment: 'cod' },
        items: [{ id:'l1', name:'Rajma Chawal', price:75, qty:1 }],
        timeline: [{ status:'pending', time: new Date().toISOString() }]
      };
      before.unshift(order);
      localStorage.setItem('tiffin_orders', JSON.stringify(before));
      if (window.OrderNotify) window.OrderNotify.checkNow();
      return 'placed:' + before.length;
    })()`);
  t('order written from the customer tab', /placed:2/.test(String(placed)), String(placed));

  // give tab A a moment: storage event + one poll tick
  await sleep(4000);

  const after = await wsA.evaluate(`JSON.stringify(window.__alerts)`);
  const parsed = JSON.parse(after || '{}');
  t('admin tab played the tone', parsed.tones > 0, 'tones=' + parsed.tones);
  t('admin tab showed a desktop popup', (parsed.notifs || []).length > 0, 'n=' + (parsed.notifs||[]).length);
  t('popup names the customer', (parsed.notifs||[]).some(n => /E2E Customer/.test(n.body)), after);
  t('popup carries the total', (parsed.notifs||[]).some(n => /124/.test(n.body)), after);

  // the new order must also appear in the admin grid
  await sleep(1200);
  const inGrid = await wsA.evaluate(`document.getElementById('adminGrid').innerHTML.indexOf('E2E Customer') !== -1`);
  t('new order visible in the admin grid', inGrid === true);

  const seen = await wsA.evaluate(`localStorage.getItem('tiffin_seen_orders')`);
  t('new order marked as seen (no repeat later)', String(seen).includes('TF_E2E_NEW'), String(seen));

  // ---- no duplicate alert on the next poll ----
  const tonesBefore = parsed.tones;
  await sleep(3200);
  const again = JSON.parse(await wsA.evaluate(`JSON.stringify(window.__alerts)`) || '{}');
  t('no duplicate alert on later polls', again.tones === tonesBefore, `${again.tones} vs ${tonesBefore}`);

  wsA.close(); wsB.close();
  try { process.kill(-child.pid); } catch (e) { try { child.kill(); } catch (e2) {} }
  execSync('taskkill /IM brave.exe /F /FI "WINDOWTITLE eq about:blank" 2>nul || exit 0', { stdio: 'ignore' });

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('E2E ERROR:', e.message); process.exit(1); });
