// Netlify function: send an order to WhatsApp automatically.
//
// Uses Meta's WhatsApp Cloud API (the official Business API). It needs a
// token + phone-number id, set as environment variables in Netlify:
//
//   WA_TOKEN        permanent access token from Meta Business
//   WA_PHONE_ID     the sender phone-number id from Meta
//   WA_TO           the shop's WhatsApp number, digits only (9198...)
//   WA_TEMPLATE     optional approved template name (default: plain text)
//   WA_TEMPLATE_LANG  template language code (default: en)
//
// Without WA_TOKEN/WA_PHONE_ID the function returns 501 with a clear
// message, so the site can fall back to the click-to-chat flow.

const GRAPH = 'https://graph.facebook.com/v21.0';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// Plain-text order summary, same shape the front-end builds.
function orderText(o) {
  const L = [];
  L.push('🍱 NAYA ORDER — TiffinExpress');
  L.push('');
  L.push('Order ID: ' + o.id);
  L.push('Naam: ' + o.customer.name);
  L.push('Phone: ' + o.customer.phone);
  L.push('Address: ' + o.customer.address);
  if (o.customer.lat && o.customer.lon) {
    L.push('Location: https://www.google.com/maps?q=' + o.customer.lat + ',' + o.customer.lon);
  }
  L.push('Payment: ' + (o.customer.payment === 'cod' ? 'Cash on Delivery'
                       : o.customer.payment === 'upi' ? 'UPI' : 'Card'));
  L.push('');
  L.push('Items:');
  (o.items || []).forEach(i => {
    L.push('• ' + i.name + (i.qty > 1 ? ' ×' + i.qty : '') + ' — ₹' + (i.price * i.qty));
  });
  L.push('');
  L.push('Delivery: ' + (o.delivery ? '₹' + o.delivery : 'FREE'));
  L.push('Total: ₹' + o.total);
  return L.join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const TOKEN = process.env.WA_TOKEN;
  const PHONE_ID = process.env.WA_PHONE_ID;
  const SHOP_TO = process.env.WA_TO;
  const TEMPLATE = process.env.WA_TEMPLATE;
  const TEMPLATE_LANG = process.env.WA_TEMPLATE_LANG || 'en';

  if (!TOKEN || !PHONE_ID || !SHOP_TO) {
    return json(501, {
      error: 'WhatsApp Business API configured nahi hai',
      need: ['WA_TOKEN', 'WA_PHONE_ID', 'WA_TO'],
      fallback: 'click-to-chat',
    });
  }

  let order;
  try {
    order = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (!order || !order.id || !order.customer) {
    return json(400, { error: 'Order object chahiye' });
  }

  const text = orderText(order);

  // A business-initiated message outside a 24h window must use an approved
  // template. If WA_TEMPLATE is set we use it; otherwise we try plain text
  // (works inside the 24h customer-service window).
  let payload;
  if (TEMPLATE) {
    payload = {
      messaging_product: 'whatsapp',
      to: SHOP_TO,
      type: 'template',
      template: {
        name: TEMPLATE,
        language: { code: TEMPLATE_LANG },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: String(order.id) },
            { type: 'text', text: String(order.customer.name || '') },
            { type: 'text', text: String(order.total) },
          ],
        }],
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: SHOP_TO,
      type: 'text',
      text: { preview_url: false, body: text },
    };
  }

  try {
    const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      return json(res.status, {
        error: 'WhatsApp API ne error diya',
        detail: data,
        usedTemplate: !!TEMPLATE,
      });
    }
    return json(200, {
      sent: true,
      to: SHOP_TO,
      usedTemplate: !!TEMPLATE,
      messageId: data.messages && data.messages[0] && data.messages[0].id,
    });
  } catch (e) {
    return json(502, { error: 'WhatsApp API tak nahi pahunch paye', detail: String(e) });
  }
};
