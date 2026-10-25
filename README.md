# TiffinExpress — Holographic Tiffin Ordering Website

A complete, production-ready tiffin (home-meal) ordering website. Customers browse a
7-day menu, pick meals, add them to a cart, share their live location, and order —
the owner sees orders in an admin panel and can accept / cancel / deliver them, with
WhatsApp notifications on both sides.

Built as plain HTML/CSS/JS with no build step, so it can be hosted anywhere for free.

---

## Live demo

https://hardik7889.github.io/tiffin-express/

---

## What's included

| Part | Files | What it does |
|------|-------|--------------|
| Frontend | `index.html`, `holo.css`, `holo.js`, `food-art.js`, `dish-photos.js` | The whole customer-facing site: home, packages, menu, cart, checkout, order history |
| 3D food photos | `img/*.webp` | 21 dish photos + 5 package hero photos + thumbnails, with LQIP placeholders |
| WhatsApp helper | `whatsapp.js` | Builds order messages, opens WhatsApp, share/copy fallback |
| Notifications | `notify.js` | Order chime + desktop notification + title flash for the owner |
| Location picker | `location.js` | Uber-style "use my current location" with reverse geocoding and a draggable map pin |
| WhatsApp backend | `backend/`, `netlify/functions/notify-order.js` | Automatic WhatsApp Business API order messages |
| Admin panel | `index.html` (inside My Orders) | Stats, filters, live order grid with maps, accept/cancel/deliver, WhatsApp number setting |
| Tests | `tools/*.js` | 250+ checks across the ordering flows |
| Demo shots | `m-menu.png`, `m-cart.png`, `m-admin.png` | Screenshots for a listing page |

---

## Features

- **7-day menu** — 21 pure-veg dishes (breakfast / lunch / dinner), one per day
- **5 packages** — Full Day Combo, Lunch+Dinner, Breakfast, Lunch, Dinner, each with an expandable weekly menu
- **3D holographic design** — dark theme, neon cyan/magenta palette, Orbitron + Rajdhani fonts
- **Multi-select buying** — tick multiple dishes or packages, add them all at once, or buy instantly
- **Flat delivery charge** — ₹49 per order no matter how many items; package-only orders are free
- **Live location** — customer shares GPS; owner sees it on a map in the admin panel
- **Order history** — customer sees every order, can share/copy it, or delete it
- **Admin panel** — stats, revenue, filters, search, per-order maps, accept → deliver workflow
- **WhatsApp integration** — click-to-chat out of the box; fully automatic with the backend
- **Mobile friendly** — responsive layout, 44px+ tap targets, hamburger nav

---

## Quick start (no backend)

1. Open `index.html` in a browser, or serve the folder:
   ```bash
   python -m http.server 8000
   ```
2. Browse the menu, add items, and place an order.
3. Orders are stored in the browser's `localStorage`.
4. The admin panel is inside **My Orders** — password `admin123` (change it before selling).
5. WhatsApp works out of the box as click-to-chat: WhatsApp opens with the message typed.

---

## Deploy for free (GitHub Pages)

1. Push this repo to GitHub.
2. Repo → **Settings** → **Pages** → Source: *Deploy from a branch* → `main` / `(root)`.
3. Your site is live at `https://<username>.github.io/tiffin-express/`.

No build step, no server, no cost.

---

## Deploy with automatic WhatsApp (Netlify)

The `backend/` folder and `netlify/functions/notify-order.js` send order messages
through Meta's WhatsApp Business API — no Send button needed.

1. Create a Meta developer app and add the WhatsApp product.
2. Get a permanent access token and a phone-number ID.
3. Deploy to Netlify, then set these environment variables:
   | Variable | Meaning |
   |----------|---------|
   | `WA_TOKEN` | Permanent access token from Meta |
   | `WA_PHONE_ID` | WhatsApp Business phone number ID |
   | `WA_TO` | Your WhatsApp number, digits only with country code |
   | `WA_TEMPLATE` | *(optional)* Approved template name |
   | `WA_TEMPLATE_LANG` | *(optional)* Template language code, default `en` |
4. Configure the webhook in the Meta dashboard (see `backend/README.md`).

Without the variables the site falls back to click-to-chat automatically.

---

## Admin panel

The admin panel lives inside **My Orders**:

1. Go to `/#/orders`.
2. Scroll down to the **Admin Login** card.
3. Enter the password (default `admin123`) → the full panel appears.

From there: stats, revenue, filters, search, order grid with live maps, and the
Accept / Cancel / Deliver workflow.

> **Security note:** the password is a client-side check only. For a real business
> it must move to a server-side login with a hashed password.

---

## Folder structure

```
tiffin-express/
├── index.html              # the site (routes + all pages + admin panel)
├── holo.css                # holographic theme + responsive rules
├── holo.js                 # 3D background, extruded text, tilt
├── food-art.js             # procedural dish art
├── dish-photos.js          # photo map for dishes
├── whatsapp.js             # WhatsApp message builder + senders
├── notify.js               # order chime / desktop notifications
├── location.js             # GPS picker + map
├── config.js               # backend URL switch
├── netlify.toml            # Netlify deploy config
├── netlify/functions/      # serverless WhatsApp sender
├── backend/                # standalone Node backend (Render/Railway)
├── img/                    # 3D food photos
├── tools/                  # test suites
└── m-*.png                 # demo screenshots
```

---

## Customising

| Want to change | Edit |
|----------------|------|
| Dishes, prices, days | `index.html` → the `MENU` array |
| Packages | `index.html` → the `PACKAGES` array |
| Delivery charge | `index.html` → `SINGLE_DELIVERY` |
| Admin password | `index.html` → `ADMIN_PASSWORD` |
| WhatsApp number | Admin panel → WhatsApp number box, or `whatsapp.js` |
| Colours / fonts | `holo.css` → the `:root` variables |

---

## Tests

```bash
node tools/test_multiselect.js
node tools/test_buy.js
node tools/test_admin.js
node tools/test_notify.js
node tools/test_location.js
node tools/test_whatsapp.js
```

Each prints `===== N passed, 0 failed =====`.

---

## Tech

Plain HTML, CSS and JavaScript. No frameworks, no bundler, no database.
Data lives in `localStorage`. Maps use Leaflet + OpenStreetMap tiles.
3D background uses Three.js (CDN).
