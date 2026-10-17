# TiffinExpress Backend — WhatsApp Business API

Fully automatic WhatsApp messages for orders. Customer order karta hai → WhatsApp message **khud** shop owner ke number par chala jata hai. Koi Send button nahi.

## Kaise kaam karta hai

```
Customer order karta hai
        ↓
Frontend → POST /api/order (backend)
        ↓
Backend → WhatsApp Business API → Shop owner ko message
        ↓
Shop owner WhatsApp par order dekhta hai
        ↓
Admin panel se status update → Customer ko WhatsApp message
        ↓
Customer WhatsApp par "accept" / "cancel" / "deliver" type karta hai
        ↓
Webhook → Backend → Status update → Dono ko WhatsApp notification
```

## Setup Steps

### 1. Meta Developer Account

1. https://developers.facebook.com/ par jao
2. **Create App** → Type: **Business**
3. App dashboard mein **WhatsApp** product add karo
4. **API Setup** section mein milega:
   - **Phone Number ID** (10-digit number)
   - **Access Token** (temporary — 24 hours; permanent ke liye step 5)

### 2. WhatsApp Business Phone Number

1. https://business.facebook.com/ → **Business Settings**
2. **Accounts** → **Phone Numbers** → **Add**
3. Ek naya number register karo (existing number use kar sakte ho)
4. **WhatsApp Business App** mein us number par account banao
5. **Permanent token** banao: Business Settings → **System Users** → **Add** → Admin → Token generate karo (permissions: `whatsapp_business_messaging`, `whatsapp_business_management`)

### 3. Backend Deploy (Free — Render)

1. https://render.com/ par jao (GitHub se login)
2. **New** → **Web Service** → GitHub repo connect karo
3. Settings:
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && node server.js`
   - **Environment Variables** (upar `.env.example` se copy):
     - `WHATSAPP_TOKEN` — permanent access token
     - `PHONE_NUMBER_ID` — WhatsApp phone number ID
     - `WEBHOOK_VERIFY_TOKEN` — koi bhi random string (jaise `tiffin_verify_2024`)
     - `SHOP_PHONE` — aapka WhatsApp number (digits only, country code ke saath)
     - `ADMIN_API_TOKEN` — koi bhi long random string
4. Deploy complete hone ka wait karo (2-3 min)
5. **URL** milega: `https://tiffin-express-xxxx.onrender.com`

### 4. Webhook Configure (Meta Dashboard)

1. Meta Developer Dashboard → **WhatsApp** → **Configuration**
2. **Callback URL:** `https://tiffin-express-xxxx.onrender.com/api/webhook`
3. **Verify Token:** wahi jo `WEBHOOK_VERIFY_TOKEN` mein daala
4. **Subscribe** to `messages` field
5. **Verify and Save** — Meta GET request bhejega, backend verify karega

### 5. Frontend Config

`config.js` mein backend URL daalo:

```js
window.BACKEND_URL = 'https://tiffin-express-xxxx.onrender.com';
```

Deploy karo. Ab order place karo — WhatsApp message **khud** jayega!

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/order` | Order place karo → WhatsApp bhejta hai |
| `GET` | `/api/webhook` | Webhook verification (Meta) |
| `POST` | `/api/webhook` | WhatsApp messages receive karta hai |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/orders` | Orders list (admin token required) |
| `POST` | `/api/orders/:id/status` | Status update → customer ko WhatsApp |

## Customer WhatsApp Commands

Customer apne number par yeh type kar sakta hai:

| Message | Action |
|---------|--------|
| `accept` / `haan` / `yes` / `ok` | Order confirm |
| `cancel` / `nahi` / `band` | Order cancel |
| `deliver` / `chalo` / `start` | Delivery start |

## Fallback

Agar backend unreachable hai ya configure nahi hai, frontend automatically **click-to-chat** mode mein switch ho jata hai — WhatsApp khul jata hai message typed, customer/owner ek tap mein bhejta hai.

## File Structure

```
tiffin-service/
├── index.html          # Frontend (GitHub Pages)
├── whatsapp.js         # WhatsApp helper (click-to-chat + auto)
├── config.js           # Backend URL config
├── holo.css            # Styles
├── backend/
│   ├── server.js       # Express server (WhatsApp Business API)
│   ├── .env.example    # Environment variables template
│   └── package.json
└── tools/              # Test scripts
```
