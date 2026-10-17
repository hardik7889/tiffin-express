// Tests for the Uber-style location picker: GPS flow, reverse geocoding,
// pin drag, place search, and the graceful fallbacks.
const fs = require('fs');
const src = fs.readFileSync('C:/Users/Rahul/tiffin-service/location.js', 'utf8');

// ---- browser stubs ----
const els = {};
function makeEl(id) {
  return {
    id, value: '', _h: '', className: '', style: {}, disabled: false, _cls: new Set(),
    get innerHTML() { return this._h; },
    set innerHTML(v) { this._h = v; register(v); },
    textContent: '',
    classList: {
      add: c => els[id]._cls.add(c), remove: c => els[id]._cls.delete(c),
      contains: c => els[id]._cls.has(c), toggle() {},
    },
    addEventListener(t, h) { this['_on' + t] = h; },
    setAttribute() {}, getAttribute() { return null; },
    querySelector: () => null,
  };
}
function register(h) {
  const re = /id="([A-Za-z0-9_-]+)"/g; let m;
  while ((m = re.exec(h))) if (!els[m[1]]) els[m[1]] = makeEl(m[1]);
}
global.document = {
  getElementById: id => els[id] || null,
  createElement: () => makeEl('tmp'),
  querySelector: () => null, querySelectorAll: () => [],
  body: { appendChild() {} },
};
global.window = {};
global.navigator = {};
global.setTimeout = (f, ms) => require('timers').setTimeout(f, ms || 0);

// fetch spy: Nominatim reverse + search
let fetchCalls = [];
let reverseReply = null, searchReply = null;
global.fetch = (url, opts) => {
  fetchCalls.push(url);
  if (url.indexOf('/reverse') !== -1) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(reverseReply) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(searchReply) });
};

// Leaflet spy
const mapCalls = { setView: 0, invalidate: 0, markerDrag: null };
global.L = {
  map: () => ({
    setView() { mapCalls.setView++; return this; },
    invalidateSize() { mapCalls.invalidate++; },
  }),
  tileLayer: () => ({ addTo() {} }),
  marker: (ll, opts) => {
    // real Leaflet converts the [lat,lon] array into a LatLng object
    const toLL = v => Array.isArray(v) ? { lat: v[0], lng: v[1] } : v;
    const m = {
      _ll: toLL(ll),
      setLatLng(p) { m._ll = toLL(p); },
      getLatLng() { return m._ll; },
      addTo() { return m; },
      on(ev, h) { if (ev === 'dragend') mapCalls.markerDrag = h; },
    };
    return m;
  },
};

// geolocation spy
let geoReply = null;
global.navigator.geolocation = {
  getCurrentPosition(ok, err) {
    if (geoReply && geoReply.error) err(geoReply.error);
    else ok(geoReply);
  },
};

new Function(src)();
const Loc = global.window.Loc;

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x ? '  -> ' + x : '')); } };
const flush = () => new Promise(r => setTimeout(r, 5));

const mountForm = () => {
  const host = els.locField = makeEl('locField');
  Loc.mount();
  return host;
};

(async () => {
  console.log('\n--- mount ---');
  const host = mountForm();
  const html = host.innerHTML;
  t('mount renders the location UI', html.length > 200);
  t('has a current-location button', /locBtn/.test(html) && /Current location use karo/.test(html));
  t('has a place search box', /locSearch/.test(html));
  t('has a map container', /id="locMap"/.test(html));
  t('has the address textarea', /id="chkAddress"/.test(html));
  t('has hidden lat/lon fields', /id="chkLat"/.test(html) && /id="chkLon"/.test(html));
  t('has a status line', /locStatus/.test(html));
  t('shows the pin hint', /Pin ko drag karke/.test(html));

  console.log('\n--- current location (happy path) ---');
  fetchCalls = []; mapCalls.setView = 0;
  geoReply = { coords: { latitude: 22.7196, longitude: 75.8577, accuracy: 18 } };
  reverseReply = { display_name: 'Vijay Nagar, Indore, Madhya Pradesh, 452010, India',
                   address: { road: 'Scheme 54', suburb: 'Vijay Nagar', city: 'Indore',
                              state: 'Madhya Pradesh', postcode: '452010' } };
  Loc.useCurrentLocation();
  await flush(); await flush();
  t('map was recentred on the fix', mapCalls.setView > 0, 'setView=' + mapCalls.setView);
  t('reverse geocode was called', fetchCalls.some(u => u.indexOf('/reverse') !== -1));
  t('lat stored in the hidden field', els.chkLat.value === 22.7196, 'lat=' + els.chkLat.value);
  t('lon stored in the hidden field', els.chkLon.value === 75.8577, 'lon=' + els.chkLon.value);
  t('address textarea filled from OSM', /Vijay Nagar/.test(els.chkAddress.value) && /Indore/.test(els.chkAddress.value),
    els.chkAddress.value);
  t('status says success', /Address bhar diya/.test(els.locStatus.textContent), els.locStatus.textContent);
  t('status styled ok', els.locStatus.className.indexOf('ok') !== -1);
  t('location chip is visible', els.locChip.style.display === '');
  t('chip shows the coordinates', /22\.71960/.test(els.locChip.innerHTML), els.locChip.innerHTML);

  console.log('\n--- GPS works but geocoding fails ---');
  els.chkAddress.value = ''; els.chkLat.value = '';
  reverseReply = null;
  Loc.useCurrentLocation();
  await flush(); await flush();
  t('coordinates still saved', els.chkLat.value === 22.7196);
  t('status warns that the address is missing', /address type kar do/i.test(els.locStatus.textContent),
    els.locStatus.textContent);
  t('status styled warn', els.locStatus.className.indexOf('warn') !== -1);

  console.log('\n--- permission denied ---');
  els.chkLat.value = '';
  geoReply = { error: { code: 1 } };
  Loc.useCurrentLocation();
  await flush();
  t('no coordinates written', els.chkLat.value === '');
  t('status explains the block', /permission block/.test(els.locStatus.textContent), els.locStatus.textContent);
  t('status styled err', els.locStatus.className.indexOf('err') !== -1);

  console.log('\n--- GPS timeout ---');
  geoReply = { error: { code: 3 } };
  Loc.useCurrentLocation();
  await flush();
  t('timeout message shown', /time laga/.test(els.locStatus.textContent), els.locStatus.textContent);

  console.log('\n--- no geolocation support at all ---');
  const savedGeo = global.navigator.geolocation;
  global.navigator.geolocation = undefined;
  Loc.useCurrentLocation();
  await flush();
  t('graceful message when unsupported', /support nahi/.test(els.locStatus.textContent), els.locStatus.textContent);
  global.navigator.geolocation = savedGeo;

  console.log('\n--- dragging the pin re-geocodes ---');
  fetchCalls = [];
  reverseReply = { display_name: 'Palasia, Indore, Madhya Pradesh, India',
                   address: { road: 'AB Road', suburb: 'Palasia', city: 'Indore', state: 'Madhya Pradesh' } };
  // the marker was created during the first successful fix
  t('a drag handler was registered', typeof mapCalls.markerDrag === 'function');
  mapCalls.markerDrag();
  await flush(); await flush();
  t('drag triggered a new reverse lookup', fetchCalls.some(u => u.indexOf('/reverse') !== -1));
  t('address updated from the pin', /Palasia/.test(els.chkAddress.value), els.chkAddress.value);
  t('status confirms the pin update', /pin se update/.test(els.locStatus.textContent), els.locStatus.textContent);

  console.log('\n--- place search ---');
  fetchCalls = [];
  els.locSearch = makeEl('locSearch'); els.locSearch.value = 'Bhawarkuan Indore';
  searchReply = [{ lat: '22.6884', lon: '75.8671', display_name: 'Bhawarkuan, Indore, Madhya Pradesh, India' }];
  Loc.searchPlace();
  await flush(); await flush();
  t('search hit Nominatim', fetchCalls.some(u => u.indexOf('/search') !== -1));
  t('coordinates applied from the search', els.chkLat.value === 22.6884, 'lat=' + els.chkLat.value);
  t('address applied from the search', /Bhawarkuan/.test(els.chkAddress.value), els.chkAddress.value);
  t('status confirms the search', /Jagah mil gayi/.test(els.locStatus.textContent), els.locStatus.textContent);

  console.log('\n--- search with no results ---');
  searchReply = [];
  Loc.searchPlace();
  await flush(); await flush();
  t('no-result message shown', /nahi mili/.test(els.locStatus.textContent), els.locStatus.textContent);

  console.log('\n--- search with too-short input ---');
  els.locSearch.value = 'ab';
  Loc.searchPlace();
  await flush();
  t('short query rejected', /3 akshar/.test(els.locStatus.textContent), els.locStatus.textContent);

  console.log('\n--- typing by hand clears a stale fix ---');
  // simulate the input listener the module bound
  t('address field has an input handler', typeof els.chkAddress._oninput === 'function');
  els.chkAddress._oninput();
  t('hand-typed address clears the stored coordinates', els.chkLat.value === '' && els.chkLon.value === '',
    'lat=' + els.chkLat.value);
  t('the chip hides again', els.locChip.style.display === 'none');

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH:', e.message); console.log(e.stack.split('\n').slice(0, 5).join('\n')); process.exit(1); });
