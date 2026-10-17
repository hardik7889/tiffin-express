/**
 * TiffinExpress Backend — WhatsApp Business API integration
 * 
 * Endpoints:
 *   POST /api/order       — frontend calls this when an order is placed
 *   GET  /api/webhook    — Meta webhook verification
 *   POST /api/webhook    — receives WhatsApp messages (customer replies)
 *   GET  /api/health      — health check
 *   GET  /api/orders      — list orders (with admin token)
 * 
 * Setup: see backend/README.md
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Config =====
const {
  WHATSAPP_TOKEN,        // permanent access token from Meta
  PHONE_NUMBER_ID,       // WhatsApp Business phone number ID
  WEBHOOK_VERIFY_TOKEN,  // custom token for webhook verification
  ADMIN_API_TOKEN,       // token for admin endpoints
  SHOP_PHONE,            // shop's WhatsApp number (digits only, with country code)
} = process.env;

const WHATSAPP_API = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

// ===== Middleware =====
app.use(cors()); // GitHub Pages → backend CORS
app.use(express.json());

// ===== In-memory order store (resets on restart; good enough for MVP) =====
const orders = new Map();

// ===== Helpers =====

function sendWhatsApp(to, text) {
  return fetch(WHATSAPP_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: String(to).replace(/\D/g, ''),
      type: 'text',
      text: { body: text },
    }),
  }).then(r => r.json());
}

function orderMessage(o) {
  const lines = [
    `*🍱 NAYA ORDER — TiffinExpress*`,
    ``,
    `*Order ID:* ${o.id}`,
    `*Naam:* ${o.customer.name}`,
    `*Phone:* ${o.customer.phone}`,
    `*Address:* ${o.customer.address}`,
    ...(o.customer.lat && o.customer.lon
      ? [`*Location:* https://www.google.com/maps?q=${o.customer.lat},${o.customer.lon}`]
      : []),
    `*Payment:* ${o.customer.payment === 'upi' ? 'UPI' : o.customer.payment === 'card' ? 'Card' : 'Cash on Delivery'}`,
    ``,
    `*Items:*`,
    ...o.items.map(i => `• ${i.name}${i.qty > 1 ? ' ×' + i.qty : ''} — ₹${i.price * i.qty}`),
    ``,
    ...(o.delivery ? [`Delivery: ₹${o.delivery}`] : ['Delivery: FREE']),
    `*Total: ₹${o.total}*`,
    ``,
    `_TiffinExpress se bheja gaya_`,
  ];
  return lines.join('\n');
}

function customerConfirmMessage(o) {
  return [
    `*TiffinExpress* 🍱`,
    ``,
    `Namaste ${o.customer.name} ji,`,
    `Aapka order mil gaya hai ✅`,
    ``,
    `*Order ID:* ${o.id}`,
    ...o.items.map(i => `• ${i.name}${i.qty > 1 ? ' ×' + i.qty : ''}`),
    `*Total: ₹${o.total}*`,
    ``,
    `Hum jaldi hi confirm karke delivery shuru karenge.`,
    `Koi sawaal ho to isi number par message kar do 🙏`,
  ].join('\n');
}

// ===== Routes =====

// 1. Frontend → place order (auto-send WhatsApp to shop owner)
app.post('/api/order', async (req, res) => {
  try {
    const o = req.body;
    if (!o || !o.id || !o.customer || !Array.isArray(o.items)) {
      return res.status(400).json({ error: 'Invalid order payload' });
    }

    // store it
    o.status = 'pending';
    o.createdAt = new Date().toISOString();
    orders.set(o.id, o);

    // send WhatsApp to the shop owner
    const sent = await sendWhatsApp(SHOP_PHONE, orderMessage(o));

    console.log(`[ORDER] ${o.id} → WhatsApp sent to ${SHOP_PHONE}:`, sent.messages ? 'OK' : JSON.stringify(sent));

    res.json({
      ok: true,
      whatsapp: sent.messages ? 'sent' : 'failed',
      orderId: o.id,
    });
  } catch (e) {
    console.error('[ORDER ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

// 2. Webhook verification (Meta setup)
app.get('/api/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[WEBHOOK] Verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 3. Webhook receiver (customer replies → auto accept/cancel/deliver)
app.post('/api/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        for (const msg of change.value.messages || []) {
          if (msg.type !== 'text') continue;

          const from = msg.from;       // customer phone
          const text = msg.text.body.trim().toLowerCase();

          // find the order for this customer
          const order = [...orders.values()].find(o =>
            String(o.customer.phone).replace(/\D/g, '').endsWith(from.slice(-10))
          );

          if (!order) {
            await sendWhatsApp(from, `Koi order nahi mila aapke number se. Order place karein website par.`);
            continue;
          }

          // keyword matching for status changes
          if (/accept|confirm|haan|yes|ok|theek/.test(text)) {
            order.status = 'accepted';
            order.timeline = [...(order.timeline || []), { status: 'accepted', time: new Date().toISOString() }];
            await sendWhatsApp(from, `✅ Order ${order.id} CONFIRM ho gaya! Delivery jaldi shuru hogi. Dhanyavaad!`);
            // also notify shop
            await sendWhatsApp(SHOP_PHONE, `🔔 Order ${order.id} customer ne WhatsApp par ACCEPT kiya.`);
          } else if (/cancel|band|nahi|cancel karo/.test(text)) {
            order.status = 'cancelled';
            order.timeline = [...(order.timeline || []), { status: 'cancelled', time: new Date().toISOString() }];
            await sendWhatsApp(from, `❌ Order ${order.id} CANCEL ho gaya. Koi baat nahi, agli baar phir try karna!`);
            await sendWhatsApp(SHOP_PHONE, `⚠️ Order ${order.id} customer ne WhatsApp par CANCEL kiya.`);
          } else if (/deliver|deliver ho|chalo|start/.test(text)) {
            order.status = 'delivering';
            order.timeline = [...(order.timeline || []), { status: 'delivering', time: new Date().toISOString() }];
            await sendWhatsApp(from, `🚚 Order ${order.id} DELIVERY mein hai! 15-20 min mein pahunch jayega.`);
            await sendWhatsApp(SHOP_PHONE, `🚚 Order ${order.id} customer ne DELIVERY start ki.`);
          } else {
            await sendWhatsApp(from, `Aapka order ${order.id} ka status: *${order.status}*\n\nStatus change ke liye message karein:\n• "accept" — order confirm\n• "cancel" — order cancel\n• "deliver" — delivery start`);
          }

          orders.set(order.id, order);
        }
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error('[WEBHOOK ERROR]', e);
    res.sendStatus(200); // always return 200 so Meta doesn't retry
  }
});

// 4. Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), orders: orders.size });
});

// 5. List orders (admin)
app.get('/api/orders', (req, res) => {
  if (req.headers['x-admin-token'] !== ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json([...orders.values()]);
});

// 6. Update order status (admin → customer WhatsApp)
app.post('/api/orders/:id/status', async (req, res) => {
  if (req.headers['x-admin-token'] !== ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const status = req.body.status;
  if (!['accepted', 'cancelled', 'delivering', 'delivered'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  order.status = status;
  order.timeline = [...(order.timeline || []), { status, time: new Date().toISOString() }];

  // notify customer via WhatsApp
  const statusText = {
    accepted: `✅ Order ${order.id} CONFIRM ho gaya! Delivery jaldi shuru hogi.`,
    cancelled: `❌ Order ${order.id} CANCEL ho gaya.`,
    delivering: `🚚 Order ${order.id} DELIVERY mein hai! 15-20 min mein pahunch jayega.`,
    delivered: `✅ Order ${order.id} DELIVER ho gaya! Khana enjoy karo. Dhanyavaad! 🙏`,
  }[status];

  await sendWhatsApp(order.customer.phone, statusText);
  await sendWhatsApp(SHOP_PHONE, `📋 Order ${order.id} status → *${status}* (admin update)`);

  orders.set(order.id, order);
  res.json({ ok: true, order });
});

// ===== Start =====
app.listen(PORT, () => {
  console.log(`\n🍱 TiffinExpress backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Orders in memory: ${orders.size}\n`);
});
