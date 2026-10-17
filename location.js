/* ============================================================
   location.js — Uber-style "use my current location" picker
   ------------------------------------------------------------
   Adds a location field to the checkout form with:
     * 📍 "Current location" — browser GPS, then reverse-geocoded to a
       readable address via OpenStreetMap Nominatim (free, no API key)
     * a small live map preview (Leaflet from CDN, OSM tiles)
     * draggable pin so a slightly-off GPS fix can be corrected
     * a plain manual address box that always works as a fallback

   Everything degrades gracefully: no GPS, no network, or no Leaflet
   still leaves a usable typed address field.
   ============================================================ */

(function () {
  'use strict';

  var NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
  var UA_NOTE = 'TiffinExpress-demo';

  var map = null;
  var marker = null;
  var mapReady = false;
  var lastFix = null;          // { lat, lon, address }
  var geoBusy = false;

  /* ---------- helpers ---------- */

  function el(id) { return document.getElementById(id); }

  function setStatus(msg, kind) {
    var s = el('locStatus');
    if (!s) return;
    s.textContent = msg || '';
    s.className = 'loc-status' + (kind ? ' ' + kind : '');
  }

  // Fill the address textarea + the hidden lat/lon fields the order stores.
  function applyFix(lat, lon, address, source) {
    lastFix = { lat: lat, lon: lon, address: address };
    var addr = el('chkAddress');
    if (addr && address) addr.value = address;
    var la = el('chkLat'), lo = el('chkLon');
    if (la) la.value = lat;
    if (lo) lo.value = lon;
    var chip = el('locChip');
    if (chip) {
      chip.style.display = '';
      chip.innerHTML = '<b>📍</b> ' + (source || 'Location') +
        ' <span>' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '</span>';
    }
    dropPin(lat, lon, false);
  }

  function clearFix() {
    lastFix = null;
    var la = el('chkLat'), lo = el('chkLon');
    if (la) la.value = '';
    if (lo) lo.value = '';
    var chip = el('locChip');
    if (chip) chip.style.display = 'none';
  }

  /* ---------- reverse geocoding (free, no key) ---------- */

  function reverseGeocode(lat, lon) {
    var url = NOMINATIM + '?format=jsonv2&lat=' + lat + '&lon=' + lon +
              '&zoom=18&addressdetails=1&accept-language=en';
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        // prefer the structured parts, fall back to the display name
        var a = j.address || {};
        var bits = [
          a.house_number, a.road || a.pedestrian || a.neighbourhood,
          a.suburb || a.village || a.town, a.city || a.city_district,
          a.state, a.postcode,
        ].filter(Boolean);
        var line = bits.length ? bits.join(', ') : (j.display_name || '');
        return line ? line.replace(/, ([A-Za-z ]+)$/, '') : null;
      })
      .catch(function () { return null; });
  }

  /* ---------- map ---------- */

  function ensureMap() {
    if (mapReady || typeof L === 'undefined') return mapReady;
    var host = el('locMap');
    if (!host) return false;

    map = L.map(host, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    }).setView([22.9734, 78.6569], 4);     // India, until we have a fix

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapReady = true;
    return true;
  }

  function dropPin(lat, lon, recenter) {
    if (!ensureMap()) return;
    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(map);
      marker.on('dragend', function () {
        var p = marker.getLatLng();
        setStatus('Pin hata ke nayi jagah set ki — address update ho raha hai...', 'busy');
        reverseGeocode(p.lat, p.lng).then(function (addr) {
          applyFix(p.lat, p.lng, addr || ('Lat ' + p.lat.toFixed(5) + ', Lon ' + p.lng.toFixed(5)), 'Pin');
          setStatus('Address pin se update ho gaya', 'ok');
        });
      });
    } else {
      marker.setLatLng([lat, lon]);
    }
    if (recenter !== false) map.setView([lat, lon], 16);
    // Leaflet needs a nudge when its container was hidden at init time
    setTimeout(function () { if (map) map.invalidateSize(); }, 60);
  }

  /* ---------- GPS ---------- */

  function useCurrentLocation() {
    if (geoBusy) return;
    if (!navigator.geolocation) {
      setStatus('Is browser mein location support nahi — address type kar do', 'err');
      return;
    }
    geoBusy = true;
    setStatus('📍 Location dhundh rahe hain...', 'busy');
    var btn = el('locBtn');
    if (btn) { btn.disabled = true; btn.classList.add('busy'); }

    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var acc = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
      dropPin(lat, lon, true);
      setStatus('Location mil gayi' + (acc ? ' (±' + acc + 'm)' : '') + ' — address nikal rahe hain...', 'busy');

      reverseGeocode(lat, lon).then(function (addr) {
        if (addr) {
          applyFix(lat, lon, addr, 'Current location');
          setStatus('✅ Address bhar diya — check kar lo, zarurat ho to pin khiska do', 'ok');
        } else {
          // GPS worked but geocoding failed: still usable via coordinates
          applyFix(lat, lon, null, 'Current location');
          setStatus('Address nahi mila, par location save ho gayi — address type kar do', 'warn');
        }
        geoBusy = false;
        if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
      });
    }, function (err) {
      geoBusy = false;
      if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
      var m = 'Location nahi mili';
      if (err.code === 1) m = 'Location ki permission block hai — browser settings se allow karo';
      else if (err.code === 2) m = 'Location available nahi — address type kar do';
      else if (err.code === 3) m = 'Location lene mein time laga — dobara try karo';
      setStatus(m, 'err');
      ensureMap();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  // Optional: let the customer type a place and jump the map there.
  function searchPlace() {
    var q = (el('locSearch') || {}).value;
    if (!q || q.trim().length < 3) { setStatus('Kam se kam 3 akshar likho', 'warn'); return; }
    setStatus('Dhundh rahe hain...', 'busy');
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' +
              encodeURIComponent(q);
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!list || !list.length) { setStatus('Yeh jagah nahi mili — dobara try karo', 'err'); return; }
        var hit = list[0];
        var lat = parseFloat(hit.lat), lon = parseFloat(hit.lon);
        dropPin(lat, lon, true);
        applyFix(lat, lon, hit.display_name, 'Search');
        setStatus('✅ Jagah mil gayi — check kar lo', 'ok');
      })
      .catch(function () { setStatus('Search fail hua — address type kar do', 'err'); });
  }

  /* ---------- form markup ---------- */

  // Replaces the plain address textarea with the full location picker.
  function mount() {
    var host = el('locField');
    if (!host) return;

    host.innerHTML = ''
      + '<div class="loc-head">'
      +   '<label>Delivery Location *</label>'
      +   '<button type="button" class="loc-btn" id="locBtn" onclick="Loc.useCurrentLocation()">'
      +     '<span class="loc-dot"></span> 📍 Current location use karo'
      +   '</button>'
      + '</div>'
      + '<div class="loc-search-row">'
      +   '<input type="text" id="locSearch" placeholder="Ya area / landmark search karo (jaise Vijay Nagar Indore)">'
      +   '<button type="button" class="loc-search-btn" onclick="Loc.searchPlace()">🔍</button>'
      + '</div>'
      + '<div class="loc-map-wrap">'
      +   '<div id="locMap" class="loc-map"></div>'
      +   '<div class="loc-map-hint">Pin ko drag karke exact jagah set karo</div>'
      + '</div>'
      + '<div class="loc-chip" id="locChip" style="display:none"></div>'
      + '<textarea id="chkAddress" rows="3" placeholder="Address yahan dikhega — zarurat ho to khud type kar do"></textarea>'
      + '<input type="hidden" id="chkLat"><input type="hidden" id="chkLon">'
      + '<div class="loc-status" id="locStatus"></div>';

    // if the modal was already filled once, keep the text
    var keep = el('locKeep') && el('locKeep').value;
    if (keep) el('chkAddress').value = keep;

    // typing by hand invalidates a stale GPS fix
    el('chkAddress').addEventListener('input', function () {
      if (lastFix) clearFix();
    });
  }

  window.Loc = {
    mount: mount,
    useCurrentLocation: useCurrentLocation,
    searchPlace: searchPlace,
    applyFix: applyFix,
    _fix: function () { return lastFix; },
    _reverse: reverseGeocode,
  };
})();
