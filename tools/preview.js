// 피그마 없이 code.js 를 그대로 돌려서 배치를 검증한다.
// 사람이 눈으로 확인하는 대신, 넘침·겹침·여백을 숫자로 잡는다.
// 사용: node tools/preview.js <spec.json> [out.svg]

const fs = require('fs');
const path = require('path');

/* ── 텍스트 높이 추정 ── */
function charW(ch, size) {
  const c = ch.codePointAt(0);
  if (c >= 0x1100 && c <= 0xD7FF) return size * 1.0;       // 한글
  if (c >= 0x3000 && c <= 0x9FFF) return size * 1.0;       // CJK
  if (ch === ' ') return size * 0.28;
  if (/[iljI.,!|]/.test(ch)) return size * 0.3;
  if (/[A-Z0-9]/.test(ch)) return size * 0.62;
  return size * 0.55;
}
function estLines(text, width, size) {
  let lines = 0;
  String(text).split('\n').forEach((para) => {
    if (!para) { lines += 1; return; }
    let w = 0, n = 1;
    for (const ch of para) {
      const cw = charW(ch, size);
      if (w + cw > width) { n++; w = cw; } else w += cw;
    }
    lines += n;
  });
  return Math.max(1, lines);
}

/* ── 노드 스텁 ── */
let SEQ = 0;
function node(type) {
  return {
    id: 'n' + (++SEQ), type, name: '', x: 0, y: 0, width: 0, height: 0,
    children: [], fills: [], strokes: [], opacity: 1,
    resize(w, h) { this.width = w; this.height = h; },
    appendChild(c) { c.parent = this; this.children.push(c); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this); },
  };
}
function textNode() {
  const t = node('TEXT');
  t._chars = ''; t._size = 14; t._lh = 130; t._auto = 'NONE';
  Object.defineProperty(t, 'characters', { get() { return t._chars; }, set(v) { t._chars = String(v); t._recalc(); } });
  Object.defineProperty(t, 'fontSize', { get() { return t._size; }, set(v) { t._size = v; t._recalc(); } });
  Object.defineProperty(t, 'lineHeight', { set(v) { t._lh = v.unit === 'PERCENT' ? v.value : 130; t._recalc(); } });
  Object.defineProperty(t, 'textAutoResize', { set(v) { t._auto = v; t._recalc(); } });
  t.letterSpacing = null; t.fontName = null;
  t.textAlignHorizontal = 'LEFT'; t.textAlignVertical = 'TOP';
  t._recalc = function () {
    if (t._auto === 'HEIGHT' && t.width > 0) {
      t.height = estLines(t._chars, t.width, t._size) * t._size * t._lh / 100;
    }
  };
  const origResize = t.resize.bind(t);
  t.resize = (w, h) => { t.width = w; t.height = h; t._recalc(); };
  return t;
}

const posted = [];
const figma = {
  currentPage: node('PAGE'),
  viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView() {} },
  ui: { postMessage(m) { posted.push(m); }, onmessage: null },
  clientStorage: { getAsync: async () => null, setAsync: async () => {} },
  showUI() {},
  createFrame() { const f = node('FRAME'); f.clipsContent = false; figma.currentPage.appendChild(f); return f; },
  createRectangle() { const r = node('RECT'); figma.currentPage.appendChild(r); return r; },
  createPolygon() { const p = node('POLY'); p.pointCount = 3; p.rotation = 0; figma.currentPage.appendChild(p); return p; },
  createText() { const t = textNode(); figma.currentPage.appendChild(t); return t; },
  loadFontAsync: async () => {},
  listAvailableFontsAsync: async () => [
    { fontName: { family: 'Pretendard', style: 'Regular' } },
    { fontName: { family: 'Pretendard', style: 'Bold' } },
  ],
};

/* ── code.js 로드 ── */
const src = fs.readFileSync(path.join(__dirname, '..', 'figma-plugin', 'code.js'), 'utf8');
const api = new Function('figma', '__html__',
  src + '\nreturn { renderAll, tokens, resolveFont, warnings };')(figma, '');

/* ── 실행 ── */
const specPath = process.argv[2];
const outSvg = process.argv[3];
if (!specPath) { console.error('사용: node tools/preview.js <spec.json> [out.svg]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const opts = {
  cardW: (spec.canvas && spec.canvas.width) || 1080,
  cardH: (spec.canvas && spec.canvas.height) || 1350,
  brandColor: (spec.design && spec.design.brand) || '#1A1A1A',
  accentColor: (spec.design && spec.design.accent) || '#FFD84D',
  subColor: (spec.design && spec.design.sub) || '#3A5AA8',
  theme: spec.theme || 'clean',
  brandName: process.env.BRAND || '',
  handle: process.env.HANDLE || '',
  prd: false, tree: false, flow: false, wire: false, design: true,
};

(async () => {
  await api.resolveFont();
  api.warnings.length = 0;
  const made = api.renderAll(spec, opts);
  const root = made[0];

  /* ── 진단 ── */
  const cards = root.children.filter((n) => n.type === 'FRAME' && /^C\d/.test(n.name));
  const H = opts.cardH, W = opts.cardW;
  let bad = 0;

  // 마지막 블록이 flex면 아래 여백은 의도한 정렬이다. 경고에서 제외한다.
  const trailingFlex = {};
  (spec.cards || []).forEach((c) => {
    const b = c.blocks || [];
    trailingFlex[c.id] = b.length > 0 && !!b[b.length - 1].flex;
  });

  console.log('\n── 카드 진단 ──');
  cards.forEach((f) => {
    let bottom = 0, right = 0, tiny = [];
    f.children.forEach((n) => {
      bottom = Math.max(bottom, n.y + n.height);
      right = Math.max(right, n.x + n.width);
      if (n.type === 'TEXT' && n._size < 22 && n._chars.length > 6) tiny.push(n._size + 'px "' + n._chars.slice(0, 14) + '"');
    });
    const over = Math.round(bottom - H);
    const slack = Math.round(H - bottom);
    // 텍스트끼리 겹치는지
    const texts = f.children.filter((n) => n.type === 'TEXT' && n._chars.trim());
    const hits = [];
    for (let a = 0; a < texts.length; a++) {
      for (let b = a + 1; b < texts.length; b++) {
        const p = texts[a], q = texts[b];
        const ox = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x);
        const oy = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y);
        if (ox > 8 && oy > 8) hits.push('"' + p._chars.slice(0, 10) + '" ↔ "' + q._chars.slice(0, 10) + '"');
      }
    }
    // 가장자리에 너무 붙었는지 (전면 요소는 제외)
    const edge = f.children.filter((n) =>
      n.width < W - 4 && n.height < H - 4 &&
      (n.x < 24 || n.y < 24 || n.x + n.width > W - 24 || n.y + n.height > H - 24)).length;

    const msgs = [];
    if (hits.length) { msgs.push('텍스트 겹침 ' + hits.length + '건: ' + hits.slice(0, 2).join(', ')); bad++; }
    if (edge) { msgs.push('가장자리 24px 안쪽 침범 ' + edge + '개'); bad++; }
    if (over > 2) { msgs.push('아래로 ' + over + 'px 넘침'); bad++; }
    else if (slack > H * 0.22 && !trailingFlex[f.name.split(' ')[0]]) { msgs.push('하단 여백 ' + slack + 'px 과다'); bad++; }
    if (right > W + 2) { msgs.push('오른쪽 ' + Math.round(right - W) + 'px 넘침'); bad++; }
    if (tiny.length) { msgs.push('글자 너무 작음: ' + tiny.join(', ')); bad++; }
    console.log((msgs.length ? '  ✗ ' : '  ✓ ') + f.name.padEnd(18) + (msgs.join(' / ') || '정상'));
  });

  if (api.warnings.length) {
    console.log('\n── 엔진 경고 ──');
    api.warnings.forEach((w) => console.log('  · ' + w));
  }
  console.log('\n문제 ' + bad + '건\n');

  /* ── SVG 미리보기 ── */
  if (outSvg) {
    const GAP = 60;
    const total = cards.length * (W + GAP);
    const parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="' + (H + 120) + '" viewBox="0 0 ' + total + ' ' + (H + 120) + '">');
    parts.push('<rect width="100%" height="100%" fill="#eceff2"/>');
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rgb = (f) => {
      const c = f && f[0] && f[0].color;
      return c ? 'rgb(' + [c.r, c.g, c.b].map((v) => Math.round(v * 255)).join(',') + ')' : 'none';
    };
    cards.forEach((f, i) => {
      const ox = i * (W + GAP) + GAP / 2;
      parts.push('<g transform="translate(' + ox + ',60)">');
      parts.push('<rect width="' + W + '" height="' + H + '" fill="' + rgb(f.fills) + '"/>');
      f.children.forEach((n) => {
        if (n.type === 'RECT' || n.type === 'POLY') {
          parts.push('<rect x="' + n.x + '" y="' + n.y + '" width="' + n.width + '" height="' + n.height +
            '" rx="' + (n.cornerRadius || 0) + '" fill="' + rgb(n.fills) + '" opacity="' + (n.opacity || 1) + '"/>');
        } else if (n.type === 'TEXT') {
          const size = n._size, lh = size * n._lh / 100;
          const anchor = n.textAlignHorizontal === 'CENTER' ? 'middle' : (n.textAlignHorizontal === 'RIGHT' ? 'end' : 'start');
          const tx = anchor === 'middle' ? n.x + n.width / 2 : (anchor === 'end' ? n.x + n.width : n.x);
          const lines = [];
          String(n._chars).split('\n').forEach((para) => {
            let cur = '', w = 0;
            for (const ch of para) {
              const cw = charW(ch, size);
              if (w + cw > n.width) { lines.push(cur); cur = ch; w = cw; } else { cur += ch; w += cw; }
            }
            lines.push(cur);
          });
          const startY = n.textAlignVertical === 'CENTER'
            ? n.y + (n.height - lines.length * lh) / 2 + size * 0.82
            : n.y + size * 0.82;
          lines.forEach((l, li) => {
            parts.push('<text x="' + tx + '" y="' + (startY + li * lh) + '" font-size="' + size +
              '" text-anchor="' + anchor + '" fill="' + rgb(n.fills) +
              '" font-family="Pretendard, Malgun Gothic, sans-serif" font-weight="600">' + esc(l) + '</text>');
          });
        }
      });
      parts.push('<rect width="' + W + '" height="' + H + '" fill="none" stroke="#b9c0c8"/>');
      parts.push('</g>');
      parts.push('<text x="' + (ox) + '" y="40" font-size="26" fill="#5a6270" font-family="sans-serif">' + esc(f.name) + '</text>');
    });
    parts.push('</svg>');
    fs.writeFileSync(outSvg, parts.join('\n'));
    console.log('미리보기: ' + outSvg + '\n');
  }
})();
