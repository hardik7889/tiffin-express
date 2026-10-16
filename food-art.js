/* ============================================================
   food-art.js — stylized soft-3D SVG food illustrations
   All art is inline SVG (gradients + shadows) so the site stays
   a single self-contained bundle with zero external images.
   ============================================================ */

let _faId = 0;
const faUid = () => 'fa' + (++_faId);

/* ---------- primitives ---------- */

function faShadow(cx, cy, rx, ry, o) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${o == null ? 0.3 : o}"/>`;
}

// bowl of curry / dal / anything liquid-ish, seen at a soft 3/4 top angle
function faBowl(x, y, r, c1, c2, inner) {
  const rim = faUid(), fd = faUid();
  const ry = r * 0.64;
  return `<defs>
    <linearGradient id="${rim}" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8b93a6"/></linearGradient>
    <radialGradient id="${fd}" cx="0.36" cy="0.28" r="0.95"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
  </defs>
  ${faShadow(x, y + ry * 0.62, r * 1.03, ry * 0.5, 0.32)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="url(#${rim})"/>
  <ellipse cx="${x}" cy="${y - ry * 0.1}" rx="${r * 0.85}" ry="${ry * 0.76}" fill="url(#${fd})"/>
  ${inner || ''}
  <ellipse cx="${x - r * 0.27}" cy="${y - ry * 0.36}" rx="${r * 0.24}" ry="${ry * 0.19}" fill="#ffffff" opacity="0.22"/>`;
}

function faRice(x, y, r) {
  const rim = faUid(), fd = faUid();
  const ry = r * 0.64;
  const grains = [[-0.45,-0.15],[-0.15,-0.35],[0.2,-0.3],[0.5,-0.05],[0.35,0.25],[0.05,0.35],[-0.3,0.25],[-0.55,0.05],[0,0],[-0.2,0.1],[0.25,0.05],[-0.5,-0.3]];
  const gs = grains.map(([gx, gy]) => {
    const px = x + gx * r * 0.7, py = y + gy * ry * 0.7;
    return `<ellipse cx="${px}" cy="${py}" rx="${r * 0.11}" ry="${ry * 0.13}" fill="#ffffff" opacity="0.85" transform="rotate(20 ${px} ${py})"/>`;
  }).join('');
  return `<defs>
    <linearGradient id="${rim}" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8b93a6"/></linearGradient>
    <radialGradient id="${fd}" cx="0.36" cy="0.28" r="0.95"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d3d9e6"/></radialGradient>
  </defs>
  ${faShadow(x, y + ry * 0.62, r * 1.03, ry * 0.5, 0.32)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="url(#${rim})"/>
  <ellipse cx="${x}" cy="${y - ry * 0.1}" rx="${r * 0.85}" ry="${ry * 0.76}" fill="url(#${fd})"/>
  ${gs}
  <ellipse cx="${x - r * 0.27}" cy="${y - ry * 0.4}" rx="${r * 0.2}" ry="${ry * 0.16}" fill="#ffffff" opacity="0.55"/>`;
}

function faRoti(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.38" cy="0.3" r="0.9"><stop offset="0" stop-color="#fbe3b4"/><stop offset="0.6" stop-color="#e0b878"/><stop offset="1" stop-color="#b8873f"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.22, r * 1.02, r * 0.4, 0.3)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.92}" fill="url(#${g})"/>
  <ellipse cx="${x - r * 0.25}" cy="${y - r * 0.28}" rx="${r * 0.4}" ry="${r * 0.3}" fill="#ffffff" opacity="0.22"/>
  <circle cx="${x + r * 0.35}" cy="${y + r * 0.15}" r="${r * 0.09}" fill="#a9762f" opacity="0.5"/>
  <circle cx="${x - r * 0.35}" cy="${y + r * 0.3}" r="${r * 0.07}" fill="#a9762f" opacity="0.45"/>
  <circle cx="${x + r * 0.1}" cy="${y - r * 0.42}" r="${r * 0.06}" fill="#a9762f" opacity="0.4"/>
  <circle cx="${x - r * 0.05}" cy="${y + r * 0.5}" r="${r * 0.05}" fill="#a9762f" opacity="0.35"/>`;
}

function faRotis(x, y, r, n) {
  let out = '';
  for (let i = n - 1; i >= 0; i--) out += faRoti(x + i * r * 0.36, y - i * r * 0.2, r);
  return out;
}

function faParatha(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.38" cy="0.3" r="0.9"><stop offset="0" stop-color="#fce7bb"/><stop offset="0.55" stop-color="#dfae6d"/><stop offset="1" stop-color="#ab7430"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.22, r * 1.02, r * 0.4, 0.3)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.92}" fill="url(#${g})"/>
  <ellipse cx="${x - r * 0.28}" cy="${y - r * 0.3}" rx="${r * 0.42}" ry="${r * 0.3}" fill="#ffffff" opacity="0.25"/>
  <ellipse cx="${x + r * 0.28}" cy="${y + r * 0.3}" rx="${r * 0.26}" ry="${r * 0.16}" fill="#8a5a1c" opacity="0.18"/>
  <circle cx="${x + r * 0.3}" cy="${y - r * 0.2}" r="${r * 0.1}" fill="#9c6626" opacity="0.55"/>
  <circle cx="${x - r * 0.4}" cy="${y + r * 0.22}" r="${r * 0.08}" fill="#9c6626" opacity="0.5"/>
  <circle cx="${x + r * 0.02}" cy="${y + r * 0.45}" r="${r * 0.06}" fill="#9c6626" opacity="0.45"/>`;
}

function faPuri(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#fff0c8"/><stop offset="0.7" stop-color="#efcb80"/><stop offset="1" stop-color="#c99a45"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.24, r * 1.02, r * 0.4, 0.3)}
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/>
  <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#c08f3d" stroke-width="1" opacity="0.5"/>
  <ellipse cx="${x - r * 0.3}" cy="${y - r * 0.32}" rx="${r * 0.35}" ry="${r * 0.25}" fill="#ffffff" opacity="0.35"/>
  <ellipse cx="${x + r * 0.3}" cy="${y + r * 0.28}" rx="${r * 0.2}" ry="${r * 0.14}" fill="#ffffff" opacity="0.18"/>`;
}

function faBhatura(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#fff2cc"/><stop offset="0.7" stop-color="#f0cd84"/><stop offset="1" stop-color="#c69a4a"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.3, r * 1.02, r * 0.42, 0.3)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.9}" fill="url(#${g})"/>
  <ellipse cx="${x - r * 0.28}" cy="${y - r * 0.3}" rx="${r * 0.42}" ry="${r * 0.28}" fill="#ffffff" opacity="0.32"/>
  <ellipse cx="${x + r * 0.3}" cy="${y + r * 0.26}" rx="${r * 0.22}" ry="${r * 0.13}" fill="#c69a4a" opacity="0.25"/>`;
}

function faPapad(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#f8e4bd"/><stop offset="1" stop-color="#cfa96a"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.2, r * 1.02, r * 0.38, 0.28)}
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/>
  <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#b98f4d" stroke-width="1" opacity="0.6"/>
  <circle cx="${x - r * 0.3}" cy="${y - r * 0.1}" r="${r * 0.07}" fill="#a97f3d" opacity="0.6"/>
  <circle cx="${x + r * 0.25}" cy="${y + r * 0.3}" r="${r * 0.06}" fill="#a97f3d" opacity="0.55"/>
  <circle cx="${x + r * 0.35}" cy="${y - r * 0.3}" r="${r * 0.05}" fill="#a97f3d" opacity="0.5"/>
  <circle cx="${x - r * 0.15}" cy="${y + r * 0.4}" r="${r * 0.05}" fill="#a97f3d" opacity="0.5"/>`;
}

function faPickle(x, y, r) {
  const inner = `<circle cx="${x - r * 0.3}" cy="${y - r * 0.1}" r="${r * 0.18}" fill="#c94a1c" opacity="0.9"/>
  <circle cx="${x + r * 0.25}" cy="${y + r * 0.12}" r="${r * 0.15}" fill="#d4571f" opacity="0.85"/>
  <circle cx="${x}" cy="${y - r * 0.3}" r="${r * 0.13}" fill="#b93e14" opacity="0.85"/>`;
  return faBowl(x, y, r, '#e0662f', '#8e2f12', inner);
}

function faSalad(x, y, r) {
  const rim = faUid(), fd = faUid();
  const ry = r * 0.64;
  return `<defs>
    <linearGradient id="${rim}" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8b93a6"/></linearGradient>
    <radialGradient id="${fd}" cx="0.36" cy="0.28" r="0.95"><stop offset="0" stop-color="#eaf7d8"/><stop offset="1" stop-color="#a9cf78"/></radialGradient>
  </defs>
  ${faShadow(x, y + ry * 0.62, r * 1.03, ry * 0.5, 0.3)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="url(#${rim})"/>
  <ellipse cx="${x}" cy="${y - ry * 0.1}" rx="${r * 0.85}" ry="${ry * 0.76}" fill="url(#${fd})"/>
  <circle cx="${x - r * 0.35}" cy="${y - ry * 0.15}" r="${r * 0.22}" fill="#7cc242" opacity="0.9"/>
  <circle cx="${x + r * 0.3}" cy="${y + ry * 0.05}" r="${r * 0.2}" fill="#8fd14f" opacity="0.9"/>
  <circle cx="${x + r * 0.05}" cy="${y - ry * 0.42}" r="${r * 0.18}" fill="#e8534a" opacity="0.9"/>
  <circle cx="${x - r * 0.1}" cy="${y + ry * 0.38}" r="${r * 0.15}" fill="#f0a83c" opacity="0.9"/>`;
}

function faLemon(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#fff59a"/><stop offset="1" stop-color="#e0c02a"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.4, r * 0.9, r * 0.35, 0.25)}
  <path d="M${x} ${y - r} A ${r} ${r} 0 0 1 ${x} ${y + r} Z" fill="url(#${g})"/>
  <path d="M${x} ${y - r} A ${r} ${r} 0 0 1 ${x} ${y + r}" fill="none" stroke="#c9a81f" stroke-width="1"/>
  <line x1="${x}" y1="${y - r * 0.75}" x2="${x}" y2="${y + r * 0.75}" stroke="#fff8c4" stroke-width="1.2" opacity="0.85"/>`;
}

function faGulabJamun(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#a8622c"/><stop offset="0.6" stop-color="#7a3d14"/><stop offset="1" stop-color="#4d2208"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.75, r * 0.95, r * 0.35, 0.3)}
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/>
  <ellipse cx="${x - r * 0.32}" cy="${y - r * 0.35}" rx="${r * 0.3}" ry="${r * 0.22}" fill="#ffffff" opacity="0.35"/>`;
}

function faIdli(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.35" cy="0.28" r="0.95"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f0f1ec"/><stop offset="1" stop-color="#c6c9bc"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.5, r * 1.0, r * 0.4, 0.28)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.85}" fill="url(#${g})"/>
  <ellipse cx="${x - r * 0.28}" cy="${y - r * 0.32}" rx="${r * 0.34}" ry="${r * 0.24}" fill="#ffffff" opacity="0.6"/>`;
}

function faJalebi(x, y, r) {
  const g = faUid();
  return `<defs><radialGradient id="${g}" cx="0.35" cy="0.3" r="0.95"><stop offset="0" stop-color="#ffd06a"/><stop offset="1" stop-color="#d9821c"/></radialGradient></defs>
  ${faShadow(x, y + r * 0.5, r * 1.0, r * 0.38, 0.28)}
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/>
  <circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="none" stroke="#c9750f" stroke-width="${r * 0.12}" opacity="0.75"/>
  <circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="none" stroke="#e08f28" stroke-width="${r * 0.12}" opacity="0.8"/>
  <circle cx="${x}" cy="${y}" r="${r * 0.2}" fill="#c9750f" opacity="0.7"/>
  <ellipse cx="${x - r * 0.3}" cy="${y - r * 0.35}" rx="${r * 0.25}" ry="${r * 0.16}" fill="#fff2c9" opacity="0.4"/>`;
}

function faPoha(x, y, r) {
  const rim = faUid(), fd = faUid();
  const ry = r * 0.64;
  const pts = [[-0.5,-0.2],[-0.25,0.15],[0,0.3],[0.3,0.1],[0.5,-0.2],[0.1,-0.35],[-0.35,0.35],[0.4,0.35]];
  const sev = pts.map(([px, py]) => `<circle cx="${x + px * r * 0.8}" cy="${y + py * ry * 0.8}" r="${r * 0.07}" fill="#e8a83c" opacity="0.9"/>`).join('');
  return `<defs>
    <linearGradient id="${rim}" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8b93a6"/></linearGradient>
    <radialGradient id="${fd}" cx="0.36" cy="0.28" r="0.95"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#e5c684"/></radialGradient>
  </defs>
  ${faShadow(x, y + ry * 0.62, r * 1.03, ry * 0.5, 0.3)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="url(#${rim})"/>
  <ellipse cx="${x}" cy="${y - ry * 0.1}" rx="${r * 0.85}" ry="${ry * 0.76}" fill="url(#${fd})"/>
  ${sev}
  <circle cx="${x + r * 0.5}" cy="${y - ry * 0.5}" r="${r * 0.12}" fill="#7cc242" opacity="0.85"/>`;
}

function faBhurji(x, y, r) {
  const inner = `<circle cx="${x - r * 0.35}" cy="${y - r * 0.2}" r="${r * 0.2}" fill="#fff0c0" opacity="0.95"/>
  <circle cx="${x + r * 0.2}" cy="${y - r * 0.32}" r="${r * 0.16}" fill="#ffeaae" opacity="0.9"/>
  <circle cx="${x + r * 0.38}" cy="${y + r * 0.15}" r="${r * 0.18}" fill="#fff3c9" opacity="0.9"/>
  <circle cx="${x - r * 0.15}" cy="${y + r * 0.3}" r="${r * 0.14}" fill="#ffeaae" opacity="0.9"/>
  <circle cx="${x - r * 0.05}" cy="${y - r * 0.05}" r="${r * 0.1}" fill="#e8534a" opacity="0.8"/>`;
  return faBowl(x, y, r, '#fdf0c4', '#d9a94e', inner);
}

function faToast(x, y, w) {
  const g = faUid();
  return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#f2cf94"/><stop offset="1" stop-color="#b8843f"/></linearGradient></defs>
  ${faShadow(x, y + w * 0.6, w * 0.75, w * 0.3, 0.3)}
  <rect x="${x - w * 0.5}" y="${y - w * 0.55}" width="${w}" height="${w * 1.1}" rx="${w * 0.16}" fill="url(#${g})"/>
  <rect x="${x - w * 0.38}" y="${y - w * 0.42}" width="${w * 0.76}" height="${w * 0.84}" rx="${w * 0.12}" fill="#fdf3dd" opacity="0.92"/>`;
}

function faHalwa(x, y, r) {
  const inner = `<circle cx="${x - r * 0.3}" cy="${y - r * 0.15}" r="${r * 0.14}" fill="#e8a63c" opacity="0.9"/>
  <circle cx="${x + r * 0.25}" cy="${y + r * 0.12}" r="${r * 0.12}" fill="#d9952f" opacity="0.85"/>
  <circle cx="${x}" cy="${y - r * 0.32}" r="${r * 0.1}" fill="#f0b953" opacity="0.9"/>`;
  return faBowl(x, y, r, '#f7b95a', '#c9721c', inner);
}

function faLassi(x, y, w, h) {
  const g = faUid();
  return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#f7f4ea"/><stop offset="1" stop-color="#d8d3c4"/></linearGradient></defs>
  ${faShadow(x, y + h * 0.55, w * 0.6, h * 0.12, 0.28)}
  <path d="M${x - w * 0.4} ${y - h * 0.5} L${x - w * 0.28} ${y + h * 0.5} L${x + w * 0.28} ${y + h * 0.5} L${x + w * 0.4} ${y - h * 0.5} Z" fill="url(#${g})" opacity="0.95"/>
  <ellipse cx="${x}" cy="${y - h * 0.5}" rx="${w * 0.4}" ry="${w * 0.13}" fill="#fbfaf5"/>
  <ellipse cx="${x}" cy="${y - h * 0.5}" rx="${w * 0.4}" ry="${w * 0.13}" fill="none" stroke="#c9c4b5" stroke-width="1"/>`;
}

function faBiryani(x, y, r) {
  const rim = faUid(), fd = faUid();
  const ry = r * 0.64;
  const bits = [[-0.5,-0.1],[-0.2,-0.4],[0.15,-0.35],[0.45,-0.05],[0.3,0.3],[-0.1,0.35],[-0.4,0.25],[0.05,0.05],[-0.25,0.1],[0.35,0.05]];
  const cols = ['#e8534a', '#7cc242', '#f0a83c', '#ffffff', '#c94a1c'];
  const inner = bits.map(([bx, by], i) =>
    `<ellipse cx="${x + bx * r * 0.7}" cy="${y + by * ry * 0.7}" rx="${r * 0.12}" ry="${ry * 0.1}" fill="${cols[i % 5]}" opacity="0.9"/>`).join('');
  return `<defs>
    <linearGradient id="${rim}" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8b93a6"/></linearGradient>
    <radialGradient id="${fd}" cx="0.36" cy="0.28" r="0.95"><stop offset="0" stop-color="#ffd88a"/><stop offset="1" stop-color="#d9852f"/></radialGradient>
  </defs>
  ${faShadow(x, y + ry * 0.62, r * 1.03, ry * 0.5, 0.32)}
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="url(#${rim})"/>
  <ellipse cx="${x}" cy="${y - ry * 0.1}" rx="${r * 0.85}" ry="${ry * 0.76}" fill="url(#${fd})"/>
  ${inner}`;
}

function faRaita(x, y, r) {
  const inner = `<circle cx="${x - r * 0.3}" cy="${y - r * 0.15}" r="${r * 0.13}" fill="#7cc242" opacity="0.85"/>
  <circle cx="${x + r * 0.25}" cy="${y + r * 0.05}" r="${r * 0.11}" fill="#8fd14f" opacity="0.85"/>
  <circle cx="${x}" cy="${y + r * 0.3}" r="${r * 0.09}" fill="#e8534a" opacity="0.8"/>`;
  return faBowl(x, y, r, '#ffffff', '#dde2ea', inner);
}

function faKheer(x, y, r) {
  const inner = `<circle cx="${x - r * 0.25}" cy="${y - r * 0.1}" r="${r * 0.09}" fill="#f0d9a8" opacity="0.95"/>
  <circle cx="${x + r * 0.2}" cy="${y + r * 0.18}" r="${r * 0.08}" fill="#e8c98a" opacity="0.9"/>
  <circle cx="${x + r * 0.05}" cy="${y - r * 0.32}" r="${r * 0.07}" fill="#f5e3bb" opacity="0.9"/>`;
  return faBowl(x, y, r, '#fff8e8', '#e3d3b0', inner);
}

/* ---------- topping helpers (positioned in absolute coords) ---------- */

function rajma(x, y, r) {
  return [[-0.35,-0.15,0.17], [0.2,-0.3,0.15], [0.38,0.15,0.16], [-0.1,0.32,0.14], [0, -0.05, 0.12]]
    .map(([a, b, s], i) => `<circle cx="${x + a * r}" cy="${y + b * r}" r="${r * s}" fill="${i % 2 ? '#7a1f14' : '#8a2418'}" opacity="0.9"/>`).join('');
}

function paneer(x, y, r) {
  return [[-0.45,-0.3],[0.1,-0.35],[-0.05,0.05],[0.2,0.15]]
    .map(([a, b], i) => `<rect x="${x + a * r}" y="${y + b * r}" width="${r * 0.3}" height="${r * 0.3}" rx="${r * 0.06}" fill="${i % 2 ? '#ffe8c0' : '#fff0d0'}" opacity="0.95"/>`).join('');
}

function kofta(x, y, r) {
  return [[-0.3,-0.15,0.2],[0.25,-0.25,0.18],[0.1,0.2,0.19]]
    .map(([a, b, s], i) => `<circle cx="${x + a * r}" cy="${y + b * r}" r="${r * s}" fill="${i % 2 ? '#e0b47c' : '#e8c08a'}" opacity="0.95"/>`).join('');
}

function matar(x, y, r) {
  return [[-0.4,-0.2],[0.05,-0.35],[0.45,-0.05],[0.3,0.25],[-0.15,0.3],[-0.45,0.15]]
    .map(([a, b]) => `<circle cx="${x + a * r * 0.85}" cy="${y + b * r * 0.85}" r="${r * 0.12}" fill="#7cc242" opacity="0.9"/>`).join('');
}

function aloo(x, y, r) {
  return [[-0.25,-0.1,0.18],[0.3,0.1,0.16],[-0.05,0.28,0.14]]
    .map(([a, b, s], i) => `<circle cx="${x + a * r}" cy="${y + b * r}" r="${r * s}" fill="${i % 2 ? '#f5d99a' : '#f0d08a'}" opacity="0.92"/>`).join('');
}

function gobi(x, y, r) {
  return [[-0.32,-0.1,0.17],[0.25,0.05,0.15],[-0.05,0.28,0.13]]
    .map(([a, b, s]) => `<circle cx="${x + a * r}" cy="${y + b * r}" r="${r * s}" fill="#f7f0d8" opacity="0.95"/>`).join('');
}

/* ---------- per-meal compositions (viewBox 0 0 220 150) ---------- */

const FOOD_ART = {
  /* ---- BREAKFAST ---- */
  b1: () => faParatha(66, 74, 40) + faBowl(152, 60, 26, '#ffffff', '#d6dbe6') + faPickle(170, 116, 18),
  b2: () => faPoha(70, 80, 44) + faJalebi(158, 64, 26) + faJalebi(180, 106, 20),
  b3: () => faIdli(56, 60, 26) + faIdli(88, 86, 24) + faBowl(160, 78, 32, '#f0a83c', '#c06a12'),
  b4: () => faParatha(66, 76, 40) + faBowl(152, 106, 24, '#ffffff', '#d6dbe6') + faPickle(160, 48, 16),
  b5: () => faBhurji(62, 78, 38) + faToast(142, 64, 32) + faSalad(170, 116, 22),
  b6: () => faBhatura(58, 64, 36) + faBhatura(96, 98, 30) + faBowl(166, 70, 30, '#c98a4a', '#7a4416') + faLassi(196, 112, 18, 40),
  b7: () => faPuri(54, 60, 28) + faPuri(86, 86, 25) + faPuri(48, 104, 22) + faHalwa(162, 78, 34),

  /* ---- LUNCH ---- */
  l1: () => faBowl(58, 80, 38, '#d9524a', '#7a1f18', rajma(58, 80, 38)) + faRice(132, 62, 32) + faRoti(180, 106, 24) + faLemon(28, 34, 11),
  l2: () => faRotis(48, 66, 22, 4) + faBowl(142, 66, 34, '#e8c25a', '#a87a1c', aloo(142, 66, 34) + gobi(142, 66, 34)) + faRice(172, 116, 24),
  l3: () => faBowl(58, 76, 38, '#f7d97a', '#c99a2a') + faRice(134, 68, 32) + faPapad(180, 112, 26) + faPickle(30, 32, 13),
  l4: () => faRoti(46, 62, 22) + faRoti(74, 82, 22) + faBowl(142, 70, 34, '#f0b04a', '#a8701c') + faRice(180, 114, 24) + faSalad(30, 32, 16),
  l5: () => faBiryani(62, 80, 42) + faRaita(148, 62, 28) + faPapad(180, 114, 26) + faSalad(28, 30, 15),
  l6: () => faRotis(46, 64, 20, 4) + faBowl(144, 70, 34, '#f08a4a', '#a83c12', paneer(144, 70, 34)) + faRice(180, 116, 24),
  l7: () => faPuri(44, 52, 24) + faPuri(74, 52, 24) + faPuri(59, 80, 24) + faRice(140, 58, 28)
    + faBowl(182, 104, 26, '#d9a04a', '#8a5010', aloo(182, 104, 26)) + faBowl(70, 118, 24, '#f0b04a', '#a8701c') + faGulabJamun(122, 114, 17),

  /* ---- DINNER ---- */
  d1: () => faBowl(58, 76, 36, '#d9b04a', '#8a5c14', aloo(58, 76, 36)) + faRotis(142, 64, 20, 4) + faBowl(180, 116, 22, '#f0b04a', '#a8701c'),
  d2: () => faBowl(58, 76, 36, '#c98a4a', '#6e3d10') + faRice(136, 68, 32) + faRoti(182, 114, 22) + faLemon(28, 32, 11),
  d3: () => faBowl(58, 76, 36, '#e8703c', '#8a2a08', paneer(58, 76, 36)) + faRotis(142, 62, 20, 4) + faRice(182, 114, 22),
  d4: () => faBowl(58, 76, 38, '#8a5a3a', '#3a1c0a') + faRice(136, 64, 30) + faRotis(178, 112, 18, 2) + faSalad(28, 30, 15),
  d5: () => faPuri(46, 52, 24) + faPuri(74, 52, 24) + faPuri(60, 80, 24) + faBowl(142, 66, 34, '#d9a84a', '#8a5c14', matar(142, 66, 34) + aloo(142, 66, 34)) + faRice(180, 116, 22) + faKheer(120, 116, 20),
  d6: () => faBowl(58, 76, 36, '#f0b04a', '#a8701c') + faRotis(142, 64, 20, 4) + faRice(182, 114, 22) + faSalad(28, 30, 15),
  d7: () => faBowl(58, 76, 38, '#fbe0b0', '#c99a4a', kofta(58, 76, 38)) + faRotis(142, 62, 20, 4) + faRice(182, 114, 22),
};

/* tag → css class */
const TAG_CLASS = {
  VEG: 'tag-veg', SWEET: 'tag-sweet', SOUTH: 'tag-south', PROTEIN: 'tag-protein',
  SPECIAL: 'tag-special', WEEKEND: 'tag-weekend', COMFORT: 'tag-comfort',
  THALI: 'tag-thali', PREMIUM: 'tag-premium', FEAST: 'tag-feast',
};
