// 카드뉴스 기획 스튜디오 — 메인 스레드
// 완성된 카드뉴스 한 세트를 제품으로 보고, 그에 대한 기획 문서 4종을 피그마에 그린다.
// 네트워크 호출은 ui.html에서만 가능하다. 여기서는 받은 데이터로 프레임만 만든다.


// 간격은 8의 배수만 쓴다. 눈으로 맞추면 카드마다 어긋난다.
const SP = { xs: 8, sm: 16, md: 24, lg: 40, xl: 64 };
const SAFE_BOTTOM = 132;   // 페이지 번호가 차지하는 하단 보호 영역

const warnings = [];

// 프레임 안의 요소가 밖으로 나갔는지 검사한다. 조용히 잘리는 것보다 알려주는 게 낫다.
function checkOverflow(f, label) {
  let bottom = 0, right = 0;
  f.children.forEach((n) => {
    bottom = Math.max(bottom, n.y + n.height);
    right = Math.max(right, n.x + n.width);
  });
  if (bottom > f.height + 2) warnings.push(label + ' 아래로 ' + Math.round(bottom - f.height) + 'px 넘침');
  else if (bottom < f.height * 0.72) warnings.push(label + ' 하단 여백 과다 (' + Math.round(f.height - bottom) + 'px)');
  if (right > f.width + 2) warnings.push(label + ' 오른쪽으로 ' + Math.round(right - f.width) + 'px 넘침');
}

let FONT = { family: 'Inter', regular: 'Regular', bold: 'Bold' };

figma.showUI(__html__, { width: 500, height: 720 });

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'load-settings') {
      const s = await figma.clientStorage.getAsync('settings');
      figma.ui.postMessage({ type: 'settings', data: s || null });
      return;
    }
    if (msg.type === 'save-settings') {
      await figma.clientStorage.setAsync('settings', msg.data);
      return;
    }
    if (msg.type === 'render') {
      await resolveFont();
      warnings.length = 0;
      const made = renderAll(msg.data, msg.opts);
      figma.currentPage.selection = made;
      figma.viewport.scrollAndZoomIntoView(made);
      figma.ui.postMessage({ type: 'done', font: FONT.family, warnings: warnings.slice(0, 8) });
      return;
    }
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
};

/* ───────────────── 폰트 ───────────────── */

async function resolveFont() {
  const all = await figma.listAvailableFontsAsync();
  const fam = {};
  all.forEach((f) => {
    if (!fam[f.fontName.family]) fam[f.fontName.family] = [];
    fam[f.fontName.family].push(f.fontName.style);
  });
  const prefer = ['Pretendard', 'Pretendard Variable', 'Noto Sans KR', 'Apple SD Gothic Neo',
    'Malgun Gothic', 'Spoqa Han Sans Neo', 'IBM Plex Sans KR', 'Inter'];
  const pick = (styles, want) => want.find((w) => styles.indexOf(w) !== -1);

  for (let i = 0; i < prefer.length; i++) {
    const f = prefer[i];
    if (!fam[f]) continue;
    const reg = pick(fam[f], ['Regular', 'Medium', 'Book']);
    const bold = pick(fam[f], ['Bold', 'SemiBold', 'Semi Bold', 'ExtraBold', 'Black']);
    if (reg && bold) { FONT = { family: f, regular: reg, bold: bold }; break; }
  }
  await figma.loadFontAsync({ family: FONT.family, style: FONT.regular });
  await figma.loadFontAsync({ family: FONT.family, style: FONT.bold });
}

/* ───────────────── 유틸 ───────────────── */

const g = (v) => ({ r: v, g: v, b: v });

function hex(h) {
  const s = String(h || '#111111').replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return { r: parseInt(n.slice(0, 2), 16) / 255, g: parseInt(n.slice(2, 4), 16) / 255, b: parseInt(n.slice(4, 6), 16) / 255 };
}
function readable(bg) { return (0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b) > 0.6 ? g(0.1) : g(1); }
function mix(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }; }

function rect(p, x, y, w, h, fill, radius, stroke) {
  const r = figma.createRectangle();
  p.appendChild(r);              // 먼저 붙인다. 그래야 x/y가 부모 기준이 된다
  r.resize(Math.max(w, 1), Math.max(h, 1));
  r.x = x; r.y = y;
  r.fills = [{ type: 'SOLID', color: fill }];
  if (radius) r.cornerRadius = radius;
  if (stroke) { r.strokes = [{ type: 'SOLID', color: stroke }]; r.strokeWeight = 1; }
  return r;
}

// 반환값은 실제로 그려진 높이. 이 값으로 커서를 내리므로 순서가 중요하다.
// 글자·크기·행간을 먼저 확정한 다음에 textAutoResize를 켜야 높이가 제대로 계산된다.
function txt(p, o) {
  const t = figma.createText();
  p.appendChild(t);
  t.fontName = { family: FONT.family, style: o.bold ? FONT.bold : FONT.regular };
  t.characters = String(o.text == null ? '' : o.text);
  t.fontSize = o.size || 14;
  if (o.lh) t.lineHeight = { value: o.lh, unit: 'PERCENT' };
  if (o.ls) t.letterSpacing = { value: o.ls, unit: 'PERCENT' };
  t.textAlignHorizontal = o.align || 'LEFT';

  if (o.fixed) {
    t.textAutoResize = 'NONE';
    t.resize(Math.max(o.w, 1), Math.max(o.h, 1));
    t.textAlignVertical = 'CENTER';
  } else {
    t.textAutoResize = 'HEIGHT';
    t.resize(Math.max(o.w, 1), t.height);
  }

  t.x = o.x; t.y = o.y;
  t.fills = [{ type: 'SOLID', color: o.color || g(0.1) }];
  return o.fixed ? o.h : t.height;
}

// 위에서 아래로 어두워지는 오버레이. 사진 위에 글자를 올리려면 필수다.
function scrim(p, x, y, w, h, strength) {
  const r = figma.createRectangle();
  r.x = x; r.y = y;
  r.resize(Math.max(w, 1), Math.max(h, 1));
  r.fills = [{
    type: 'GRADIENT_LINEAR',
    gradientTransform: [[0, 1, 0], [-1, 0, 1]],
    gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
      { position: 0.55, color: { r: 0, g: 0, b: 0, a: (strength || 0.8) * 0.45 } },
      { position: 1, color: { r: 0, g: 0, b: 0, a: strength || 0.8 } },
    ],
  }];
  p.appendChild(r);
  return r;
}

// 사진 자리. 피그마에서 이미지를 끌어다 놓으면 그대로 채워진다.
function photoSlot(p, x, y, w, h, label, radius) {
  const r = rect(p, x, y, w, h, g(0.86), radius || 0);
  r.name = '사진 · ' + (label || '');
  txt(p, { x: x, y: y + h / 2 - 18, w: w, align: 'CENTER', text: '사진을 여기로 끌어놓으세요', size: 24, color: g(0.52) });
  return r;
}

function board(root, name, x, y, w, h) {
  const f = figma.createFrame();
  f.name = name;
  f.resize(w, h);
  f.x = x; f.y = y;
  f.fills = [{ type: 'SOLID', color: g(1) }];
  f.clipsContent = false;
  root.appendChild(f);
  return f;
}

function boardTitle(root, x, y, no, title, desc, brand) {
  rect(root, x, y + 6, 6, 44, brand);
  txt(root, { x: x + 24, y: y, w: 900, text: no + '. ' + title, size: 44, bold: true, color: g(0.1) });
  if (desc) txt(root, { x: x + 24, y: y + 56, w: 1200, text: desc, size: 26, color: g(0.45), lh: 150 });
  return 120;
}

// 직각 커넥터. 곡선 대신 꺾은선을 쓴다. 재현성이 높고 어긋나지 않는다.
function connect(p, x1, y1, x2, y2, color) {
  const midX = x1 + (x2 - x1) / 2;
  const t = 2;
  rect(p, x1, y1 - t / 2, midX - x1, t, color);
  if (Math.abs(y2 - y1) > 1) rect(p, midX - t / 2, Math.min(y1, y2), t, Math.abs(y2 - y1), color);
  rect(p, midX, y2 - t / 2, x2 - midX, t, color);
  const a = figma.createPolygon();
  a.pointCount = 3;
  a.resize(12, 12);
  a.x = x2 - 6; a.y = y2 - 6;
  a.rotation = -90;
  a.fills = [{ type: 'SOLID', color: color }];
  p.appendChild(a);
}

// 다음 줄로 넘어가는 연결. 오른쪽으로 못 가는 경우 아래로 돌린다.
function connectDown(p, a, b, color) {
  const t = 2;
  const x1 = a.x + a.w / 2, y1 = a.y + a.h;
  const x2 = b.x + b.w / 2, y2 = b.y;
  const midY = y1 + (y2 - y1) / 2;
  rect(p, x1 - t / 2, y1, t, midY - y1, color);
  rect(p, Math.min(x1, x2), midY - t / 2, Math.abs(x2 - x1), t, color);
  rect(p, x2 - t / 2, midY, t, y2 - midY, color);
  const ar = figma.createPolygon();
  ar.pointCount = 3;
  ar.resize(12, 12);
  ar.x = x2 - 6; ar.y = y2 - 10;
  ar.rotation = 180;
  ar.fills = [{ type: 'SOLID', color: color }];
  p.appendChild(ar);
}

/* ───────────────── 전체 ───────────────── */

function renderAll(data, opts) {
  const brand = hex(opts.brandColor);
  const root = figma.createFrame();
  root.name = (data.project || '카드뉴스') + ' — 기획 산출물';
  root.fills = [{ type: 'SOLID', color: g(0.96) }];
  root.clipsContent = false;
  root.x = figma.viewport.center.x;
  root.y = figma.viewport.center.y;

  const PAD = 140;
  let y = PAD;
  let maxW = 0;

  txt(root, { x: PAD, y: y, w: 2000, text: data.project || '카드뉴스 기획 산출물', size: 72, bold: true, ls: -2 });
  y += 100;
  txt(root, { x: PAD, y: y, w: 2000, size: 28, color: g(0.45), lh: 150,
    text: ((data.prd || {}).mode === '신규')
      ? '제작 전에 작성한 기획서입니다. 이 문서를 승인받은 뒤 카드 제작에 들어갑니다.'
      : '완성된 카드뉴스를 분석해 역으로 구성한 기획 문서입니다. 실제 제작 시점의 기록이 아닌 사후 재구성입니다.' });
  y += 140;

  if (opts.prd) {
    y += boardTitle(root, PAD, y, '01', '요구사항 정의 (PRD)', '무엇을, 왜 만들었는지를 글로 정리합니다.', brand);
    const b = renderPRD(root, data, PAD, y, 1600, brand);
    y += b + 180; maxW = Math.max(maxW, 1600);
  }
  if (opts.tree) {
    y += boardTitle(root, PAD, y, '02', '기능명세서', '카드뉴스의 구성 요소를 계층과 번호로 정리합니다.', brand);
    const r = renderTree(root, data.features || [], PAD, y, brand);
    y += r.h + 180; maxW = Math.max(maxW, r.w);
  }
  if (opts.flow) {
    y += boardTitle(root, PAD, y, '03', '유저플로우', '독자가 카드를 넘기며 겪는 여정을 단계별로 그립니다.', brand);
    const r = renderFlow(root, data.flow || {}, PAD, y, brand);
    y += r.h + 180; maxW = Math.max(maxW, r.w);
  }
  if (opts.wire) {
    y += boardTitle(root, PAD, y, '04', '와이어프레임', '카드 구성과 정보 위계를 디자인 이전에 검증합니다.', brand);
    const r = renderWireBoard(root, data, PAD, y, opts);
    y += r.h + 180; maxW = Math.max(maxW, r.w);
  }
  if (opts.design) {
    y += boardTitle(root, PAD, y, '05', '카드뉴스 시안', '브랜드 컬러와 타이포를 적용한 결과물입니다.', brand);
    const r = renderDesignBoard(root, data, PAD, y, opts, brand);
    y += r.h + 180; maxW = Math.max(maxW, r.w);
  }

  root.resize(maxW + PAD * 2, y);
  return [root];
}

/* ───────────────── 01. PRD ───────────────── */

function renderPRD(root, data, x, y, w, brand) {
  const p = data.prd || {};
  const f = board(root, '01 요구사항 정의 (PRD)', x, y, w, 600);
  const PAD = 72;
  const iw = w - PAD * 2;
  let cy = PAD;

  cy += sec(f, PAD, cy, '개요', brand);
  cy += kv(f, PAD, cy, iw, '한 줄 정의', p.oneLine);
  cy += kv(f, PAD, cy, iw, '목표', p.goal);
  cy += kv(f, PAD, cy, iw, '핵심 메시지', p.coreMessage);
  cy += 40;

  cy += sec(f, PAD, cy, '배경', brand);
  cy += txt(f, { x: PAD, y: cy, w: iw, text: p.background || '-', size: 27, lh: 168, color: g(0.2) }) + 44;

  if (p.problems && p.problems.length) {
    cy += sec(f, PAD, cy, '문제 정의', brand);
    p.problems.forEach((s) => {
      rect(f, PAD, cy + 13, 9, 9, brand, 5);
      cy += txt(f, { x: PAD + 28, y: cy, w: iw - 28, text: s, size: 27, lh: 168, color: g(0.2) }) + 14;
    });
    cy += 44;
  }

  const t = p.target || {};
  cy += sec(f, PAD, cy, '타겟', brand);
  cy += kv(f, PAD, cy, iw, '주 타겟', t.persona);
  cy += kv(f, PAD, cy, iw, '보게 되는 순간', t.situation);
  cy += kv(f, PAD, cy, iw, '인식 수준', t.awareness);
  cy += kv(f, PAD, cy, iw, '원하는 것', t.desire);
  cy += kv(f, PAD, cy, iw, '톤 & 매너', p.tone);
  cy += 44;

  if (p.success && p.success.length) {
    cy += sec(f, PAD, cy, '목표와 측정 지표', brand);
    rect(f, PAD, cy, iw, 56, g(0.95));
    txt(f, { x: PAD + 20, y: cy, w: 600, h: 56, fixed: true, text: '목표', size: 24, bold: true, color: g(0.4) });
    txt(f, { x: PAD + 640, y: cy, w: 600, h: 56, fixed: true, text: '측정 방법', size: 24, bold: true, color: g(0.4) });
    txt(f, { x: PAD + 1260, y: cy, w: 160, h: 56, fixed: true, text: '실측', size: 24, bold: true, color: g(0.4) });
    cy += 56;
    p.success.forEach((s) => {
      const h1 = txt(f, { x: PAD + 20, y: cy + 16, w: 600, text: s.goal || '', size: 26, lh: 155, color: g(0.2) });
      const h2 = txt(f, { x: PAD + 640, y: cy + 16, w: 600, text: s.metric || '', size: 26, lh: 155, color: g(0.35) });
      txt(f, { x: PAD + 1260, y: cy + 16, w: 160, text: '-', size: 26, color: g(0.62) });
      const rh = Math.max(h1, h2) + 32;
      rect(f, PAD, cy + rh - 1, iw, 1, g(0.9));
      cy += rh;
    });
    cy += 20;
    txt(f, { x: PAD, y: cy, w: iw, size: 22, color: g(0.55), lh: 160,
      text: '게시 전 시안이므로 실측값은 비어 있습니다. 게시 후 채워야 합니다.' });
    cy += 60;
  }

  const sc = p.scope || {};
  if ((sc.in && sc.in.length) || (sc.out && sc.out.length)) {
    cy += sec(f, PAD, cy, '제작 범위', brand);
    const colW = (iw - 40) / 2;
    let ly = cy, ry = cy;
    txt(f, { x: PAD, y: ly, w: colW, text: '포함', size: 26, bold: true, color: g(0.25) }); ly += 42;
    (sc.in || []).forEach((s) => { ly += txt(f, { x: PAD, y: ly, w: colW, text: '· ' + s, size: 25, lh: 160, color: g(0.3) }) + 10; });
    txt(f, { x: PAD + colW + 40, y: ry, w: colW, text: '제외', size: 26, bold: true, color: g(0.25) }); ry += 42;
    (sc.out || []).forEach((s) => { ry += txt(f, { x: PAD + colW + 40, y: ry, w: colW, text: '· ' + s, size: 25, lh: 160, color: g(0.5) }) + 10; });
    cy = Math.max(ly, ry) + 44;
  }

  if (p.improvements && p.improvements.length) {
    cy += sec(f, PAD, cy, p.mode === '신규' ? '제작 전 확인해야 할 것' : '결과물을 다시 보며 발견한 것', brand);
    p.improvements.forEach((s, i) => {
      rect(f, PAD, cy, 36, 36, mix(brand, g(1), 0.85), 18);
      txt(f, { x: PAD, y: cy, w: 36, h: 36, fixed: true, text: String(i + 1), size: 22, bold: true, align: 'CENTER', color: brand });
      cy += Math.max(txt(f, { x: PAD + 54, y: cy + 2, w: iw - 54, text: s, size: 27, lh: 165, color: g(0.2) }), 36) + 18;
    });
    cy += 20;
  }

  f.resize(w, cy + PAD);
  return cy + PAD;
}

function sec(f, x, y, title, brand) {
  rect(f, x, y + 5, 5, 30, brand);
  txt(f, { x: x + 20, y: y, w: 900, text: title, size: 34, bold: true, color: g(0.1) });
  return 62;
}

function kv(f, x, y, w, k, v) {
  if (!v) return 0;
  txt(f, { x: x, y: y + 2, w: 240, text: k, size: 25, bold: true, color: g(0.48) });
  return txt(f, { x: x + 260, y: y, w: w - 260, text: v, size: 28, lh: 158, color: g(0.15) }) + 22;
}

/* ───────────────── 02. 기능명세 트리 ───────────────── */

function renderTree(root, features, x, y, brand) {
  const L0 = 420, L1 = 460, L2 = 420;
  const GAPX = 120, GAPY = 28;
  const H1 = 132, H2 = 92;

  // 자식부터 자리를 잡고 부모를 자식 평균 위치에 놓는다
  let cy = 0;
  const rows = [];
  features.forEach((f) => {
    const kids = f.children || [];
    const start = cy;
    if (kids.length) {
      kids.forEach((k) => { rows.push({ node: k, y: cy, level: 2 }); cy += H2 + GAPY; });
    } else { cy += H1 + GAPY; }
    const end = cy - GAPY;
    rows.push({ node: f, y: start + (end - start) / 2 - H1 / 2, level: 1, top: start, bottom: end });
    cy += 40;
  });

  const totalH = cy + 40;
  const W = L0 + GAPX + L1 + GAPX + L2 + 160;
  const f = board(root, '02 기능명세서', x, y, W, totalH + 80);
  const PAD = 60;

  const rootY = totalH / 2 - 50;
  rect(f, PAD, rootY, L0, 100, g(0.12), 12);
  txt(f, { x: PAD + 28, y: rootY, w: L0 - 56, h: 100, fixed: true, text: features.length ? (features[0].root || '카드뉴스 세트') : '카드뉴스 세트', size: 30, bold: true, color: g(1) });

  rows.filter((r) => r.level === 1).forEach((r) => {
    const bx = PAD + L0 + GAPX;
    const by = r.y + 40;
    connect(f, PAD + L0, rootY + 50, bx, by + H1 / 2, g(0.72));
    rect(f, bx, by, L1, H1, g(1), 12, g(0.86));
    rect(f, bx, by, 6, H1, brand, 3);
    txt(f, { x: bx + 26, y: by + 22, w: L1 - 120, text: r.node.name || '', size: 28, bold: true, color: g(0.12) });
    txt(f, { x: bx + L1 - 80, y: by + 22, w: 54, text: r.node.no || '', size: 24, align: 'RIGHT', color: g(0.55) });
    if (r.node.desc) txt(f, { x: bx + 26, y: by + 62, w: L1 - 52, text: r.node.desc, size: 22, lh: 150, color: g(0.45) });

    (r.node.children || []).forEach((k) => {
      const kr = rows.find((q) => q.level === 2 && q.node === k);
      if (!kr) return;
      const kx = bx + L1 + GAPX;
      const ky = kr.y + 40;
      connect(f, bx + L1, by + H1 / 2, kx, ky + H2 / 2, g(0.78));
      rect(f, kx, ky, L2, H2, g(0.985), 10, g(0.88));
      txt(f, { x: kx + 22, y: ky + 16, w: L2 - 100, text: k.name || '', size: 25, bold: true, color: g(0.18) });
      txt(f, { x: kx + L2 - 76, y: ky + 16, w: 54, text: k.no || '', size: 21, align: 'RIGHT', color: g(0.58) });
      if (k.cards && k.cards.length) {
        txt(f, { x: kx + 22, y: ky + 52, w: L2 - 44, text: k.cards.join(', '), size: 20, color: brand });
      } else if (k.desc) {
        txt(f, { x: kx + 22, y: ky + 52, w: L2 - 44, text: k.desc, size: 20, color: g(0.5) });
      }
    });
  });

  return { h: totalH + 80, w: W };
}

/* ───────────────── 03. 유저플로우 ───────────────── */

function renderFlow(root, flow, x, y, brand) {
  const groups = flow.groups || [];
  const NW = 250, NH = 76, GX = 90, GY = 56;
  const LABEL = 200;

  let maxCols = 0;
  groups.forEach((gr) => { maxCols = Math.max(maxCols, (gr.nodes || []).length); });

  const W = LABEL + maxCols * NW + (maxCols - 1) * GX + 160;
  let H = 80;
  groups.forEach(() => { H += NH + GY + 56; });
  H += flow.dropoff ? 120 : 40;

  const f = board(root, '03 유저플로우', x, y, W, H);
  const PAD = 60;
  const pos = {};

  let cy = PAD;
  groups.forEach((gr, gi) => {
    txt(f, { x: PAD, y: cy, w: LABEL - 20, text: gr.name || '', size: 24, bold: true, color: g(0.5) });
    if (gi > 0) rect(f, PAD, cy - 28, W - PAD * 2, 1, g(0.9));
    cy += 40;

    (gr.nodes || []).forEach((n, ni) => {
      const nx = PAD + LABEL + ni * (NW + GX);
      const isStart = n.type === 'start';
      const isExit = n.type === 'exit';
      const fill = isStart ? g(1) : isExit ? g(0.95) : mix(brand, g(1), 0.12);
      const stroke = isStart ? g(0.3) : isExit ? g(0.82) : null;
      rect(f, nx, cy, NW, NH, fill, 10, stroke);
      txt(f, { x: nx + 16, y: cy, w: NW - 32, h: NH, fixed: true, align: 'CENTER',
        text: n.label || '', size: 24, bold: !isExit,
        color: isStart || isExit ? g(0.25) : readable(mix(brand, g(1), 0.12)) });
      pos[n.id] = { x: nx, y: cy, w: NW, h: NH };
    });
    cy += NH + GY;
  });

  (flow.edges || []).forEach((e) => {
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b) return;
    if (b.x <= a.x) { connectDown(f, a, b, g(0.7)); if (e.label) txt(f, { x: b.x, y: b.y - 34, w: b.w, align: 'CENTER', text: e.label, size: 19, color: g(0.5) }); return; }
    connect(f, a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, g(0.7));
    if (e.label) {
      const mx = a.x + a.w + (b.x - (a.x + a.w)) / 2;
      txt(f, { x: mx - 60, y: Math.min(a.y + a.h / 2, b.y + b.h / 2) - 34, w: 120, text: e.label, size: 19, align: 'CENTER', color: g(0.5) });
    }
  });

  if (flow.dropoff) {
    cy += 20;
    rect(f, PAD, cy, W - PAD * 2, 4, mix(brand, g(1), 0.7), 2);
    cy += 24;
    txt(f, { x: PAD, y: cy, w: W - PAD * 2, text: '이탈이 가장 많이 날 지점', size: 24, bold: true, color: g(0.35) });
    txt(f, { x: PAD, y: cy + 36, w: W - PAD * 2, text: flow.dropoff, size: 26, lh: 160, color: g(0.2) });
  }

  return { h: H, w: W };
}

/* ───────────────── 04. 와이어프레임 ───────────────── */

function renderWireBoard(root, data, x, y, opts) {
  const cards = data.cards || [];
  const W = opts.cardW || 1080, H = opts.cardH || 1350;
  const IDX = 420, GAP = 100;

  // 좌측 카드 목록 패널
  const p = board(root, '카드 목록', x, y, IDX, H);
  p.strokes = [{ type: 'SOLID', color: g(0.88) }];
  let py = 44;
  txt(p, { x: 32, y: py, w: IDX - 64, text: '전체 카드 (' + cards.length + ')', size: 26, bold: true });
  py += 56;
  cards.forEach((c, i) => {
    rect(p, 24, py, IDX - 48, 74, i === 0 ? g(0.95) : g(1), 8);
    txt(p, { x: 40, y: py, w: 40, h: 74, fixed: true, text: String(i + 1), size: 22, color: g(0.6) });
    txt(p, { x: 84, y: py + 14, w: IDX - 130, text: c.role || '', size: 24, bold: true, color: g(0.15) });
    txt(p, { x: 84, y: py + 44, w: IDX - 130, text: c.id + (c.angle ? ' · ' + c.angle : ''), size: 19, color: g(0.55) });
    py += 82;
  });

  cards.forEach((c, i) => {
    const fx = x + IDX + GAP + i * (W + GAP);
    const f = board(root, 'W' + (i + 1) + ' · ' + (c.role || ''), fx, y, W, H);
    f.clipsContent = true;
    renderWire(f, c, W, H);
    if (c.why) txt(root, { x: fx, y: y + H + 28, w: W, text: c.id + ' — ' + c.why, size: 26, color: g(0.42), lh: 155 });
  });

  return { h: H + 160, w: IDX + GAP + cards.length * (W + GAP) };
}

function renderWire(f, c, W, H) {
  const PAD = 72;
  const iw = W - PAD * 2;
  let y = PAD;

  rect(f, PAD, y, 190, 42, g(0.88), 21);
  txt(f, { x: PAD, y: y, w: 190, h: 42, fixed: true, align: 'CENTER', text: c.role || '', size: 22, color: g(0.42) });
  y += 76;

  rect(f, PAD, y, iw, 140, g(0.9), 8);
  txt(f, { x: PAD + 22, y: y + 20, w: iw - 44, text: '헤드라인\n' + (c.headline || ''), size: 26, color: g(0.42), lh: 150 });
  y += 168;

  if (c.sub) {
    rect(f, PAD, y, iw, 66, g(0.94), 6);
    txt(f, { x: PAD + 22, y: y, w: iw - 44, h: 66, fixed: true, text: '서브카피', size: 22, color: g(0.5) });
    y += 94;
  }

  const body = c.body || [];
  if (c.layout === 'table' && body.length) {
    body.forEach(() => {
      rect(f, PAD, y, iw * 0.4, 66, g(0.93), 0, g(0.86));
      rect(f, PAD + iw * 0.4, y, iw * 0.6, 66, g(0.985), 0, g(0.86));
      y += 66;
    });
    y += 30;
  } else if (body.length) {
    body.forEach(() => {
      rect(f, PAD, y, 24, 24, g(0.85), 12);
      rect(f, PAD + 42, y + 3, iw - 42, 18, g(0.92), 4);
      y += 52;
    });
    y += 30;
  }

  const imgH = Math.max(160, H - y - PAD - (c.cta ? 170 : 110));
  rect(f, PAD, y, iw, imgH, g(0.88), 8);
  txt(f, { x: PAD, y: y + imgH / 2 - 18, w: iw, align: 'CENTER', text: '이미지 영역', size: 26, color: g(0.5) });
  y += imgH + 28;

  if (c.cta) {
    rect(f, PAD, y, iw, 90, g(0.2), 12);
    txt(f, { x: PAD, y: y, w: iw, h: 90, fixed: true, align: 'CENTER', text: 'CTA', size: 28, color: g(1) });
  }
  rect(f, PAD, H - PAD - 28, 220, 28, g(0.9), 4);
}

/* ───────────────── 05. 카드 시안 ───────────────── */

function renderDesignBoard(root, data, x, y, opts, brand) {
  const cards = data.cards || [];
  const W = opts.cardW || 1080, H = opts.cardH || 1350, GAP = 100;
  cards.forEach((c, i) => {
    const f = board(root, 'C' + (i + 1) + ' · ' + (c.role || ''), x + i * (W + GAP), y, W, H);
    f.clipsContent = true;
    renderDesign(f, c, W, H, brand, opts, i, cards.length);
    checkOverflow(f, (c.id || 'C' + (i + 1)) + ' 시안');
  });
  return { h: H, w: cards.length * (W + GAP) };
}

// 헤드라인을 \n 기준으로 나눠 첫 줄만 포인트 컬러로. 이게 한국형 카드뉴스의 기본 문법이다.
function twoToneHead(f, x, y, w, text, size, accent, dark, align) {
  const lines = String(text || '').split('\n');
  let cy = y;
  cy += txt(f, { x: x, y: cy, w: w, align: align || 'LEFT', text: lines[0] || '', size: size, bold: true, color: accent, lh: 126, ls: -2 });
  if (lines[1]) cy += txt(f, { x: x, y: cy, w: w, align: align || 'LEFT', text: lines.slice(1).join('\n'), size: size, bold: true, color: dark, lh: 126, ls: -2 });
  return cy - y;
}

function pill(f, x, y, text, size, fill, textColor, outline) {
  const w = Math.max(120, text.length * (size * 0.95) + size * 2.6);
  const h = size * 2.2;
  rect(f, x, y, w, h, fill, h / 2, outline);
  txt(f, { x: x, y: y, w: w, h: h, fixed: true, align: 'CENTER', text: text, size: size, bold: true, color: textColor });
  return { w: w, h: h };
}

function summaryBox(f, x, y, w, text, brand) {
  const h = measure(text, w - 80, 27, 165) + 64;
  if (y + h > f.height - SAFE_BOTTOM + 40) y = Math.max(y, f.height - SAFE_BOTTOM - h + 24);
  rect(f, x, y, w, h, g(1), 20, g(0.9));
  txt(f, { x: x + 40, y: y + 32, w: w - 80, align: 'CENTER', text: text, size: 27, bold: true, color: g(0.2), lh: 165 });
  return h;
}

function pageNo(f, W, H, idx, brand) {
  const y = H - 92;
  pill(f, 88, y, String(idx + 1).padStart(2, '0'), 22, g(1), brand, brand);
  rect(f, 240, y + 24, W - 240 - 88, 2, mix(brand, g(1), 0.65));
}

/* ═══════════ 자유 레이아웃 엔진 ═══════════
   AI가 design 토큰과 blocks 트리를 직접 써서 보내면 여기서 그대로 그린다.
   템플릿을 고르는 게 아니라 배치를 서술하는 방식이라, 코드를 안 고쳐도 새 디자인이 나온다.

   blocks 는 세로로 쌓인다. flex: 1 을 준 블록이 남는 높이를 가져간다. */

const PALETTE = ['page', 'surface', 'ink', 'inkSub', 'accent', 'brand', 'sub', 'white', 'black'];

function tokens(design, opts) {
  const d = design || {};
  const brand = hex(d.brand || opts.brandColor || '#1A1A1A');
  const accent = hex(d.accent || opts.accentColor || '#FFD84D');
  return {
    page: d.page ? hex(d.page) : g(1),
    surface: d.surface ? hex(d.surface) : g(0.97),
    ink: d.ink ? hex(d.ink) : g(0.1),
    inkSub: d.inkSub ? hex(d.inkSub) : g(0.45),
    accent: accent,
    brand: brand,
    sub: hex(d.sub || opts.subColor || '#3A5AA8'),
    white: g(1), black: g(0.08),
    radius: d.radius == null ? 16 : d.radius,
    pad: d.pad == null ? 88 : d.pad,
    gap: d.gap == null ? 24 : d.gap,
    sq: 1,                                   // 압축 계수. 내용이 넘치면 1보다 작아진다
  };
}

// 같은 토큰을 압축 계수만 바꿔 복제한다
function squeeze(D, sq, gap) {
  const o = {};
  for (const k in D) o[k] = D[k];
  o.sq = sq;
  if (gap != null) o.gap = gap;
  return o;
}
const SQ = (D, v, min) => Math.max(min == null ? 0 : min, Math.round(v * (D.sq == null ? 1 : D.sq)));

function col(v, D, fallback) {
  if (!v) return fallback || D.ink;
  if (PALETTE.indexOf(v) !== -1) return D[v];
  if (String(v).charAt(0) === '#') return hex(v);
  return fallback || D.ink;
}

function measureBlock(b, w, D) {
  if (!b || b.flex) return 0;
  const t = b.type || 'text';
  if (t === 'space') return SQ(D, b.h || D.gap, 4);
  if (t === 'divider') return b.h || 2;
  if (t === 'photo') return SQ(D, b.h || 320, 90);
  if (t === 'pill') return SQ(D, b.h || 56, 40);
  if (t === 'text') {
    const size = fitBlockSize(b, w, D);
    return measure(b.text || '', w, size, b.lh || (size > 44 ? 130 : 158));
  }
  if (t === 'row') {
    const kids = b.children || [];
    const ws = splitWidths(w, kids, b.gap == null ? D.gap : b.gap, b.widths);
    let m = 0;
    kids.forEach((k, i) => { m = Math.max(m, measureBlock(k, ws[i], D)); });
    return b.h || m;
  }
  if (t === 'box') {
    const pad = SQ(D, b.pad == null ? 32 : b.pad, 16);
    const inner = stackHeight(b.children || [], w - pad * 2, SQ(D, b.gap == null ? D.gap : b.gap, 6), D);
    return b.h ? SQ(D, b.h, 60) : (inner + pad * 2);
  }
  return SQ(D, b.h || 60, 30);
}

function fitBlockSize(b, w, D) {
  const sq = D && D.sq != null ? D.sq : 1;
  const base = Math.max(16, Math.round((b.size || 30) * Math.max(sq, 0.62)));
  if (!b.maxLines) return base;
  return fitSize(b.text || '', w, base, Math.max(16, base - 26), b.maxLines, b.lh || 130);
}

function splitWidths(w, kids, gap, widths) {
  const n = kids.length || 1;
  const total = w - gap * (n - 1);
  const ratios = widths && widths.length === n ? widths : kids.map(function () { return 1; });
  const sum = ratios.reduce(function (a, v) { return a + v; }, 0) || n;
  return ratios.map(function (r) { return total * r / sum; });
}

function stackHeight(list, w, gap, D) {
  let h = 0;
  (list || []).forEach(function (b, i) {
    h += measureBlock(b, w, D);
    if (i < list.length - 1) h += SQ(D, b.gapAfter != null ? b.gapAfter : gap, 6);
  });
  return h;
}

function drawStack(parent, list, x, y, w, avail, D) {
  const items = list || [];
  const gap = D.gap;
  let fixed = 0, flexTotal = 0, gaps = 0;
  items.forEach(function (b, i) {
    if (b && b.flex) flexTotal += b.flex; else fixed += measureBlock(b, w, D);
    if (i < items.length - 1) gaps += SQ(D, b && b.gapAfter != null ? b.gapAfter : gap, 6);
  });
  const spare = Math.max(0, avail - fixed - gaps);

  let cy = y;
  items.forEach(function (b, i) {
    const h = b && b.flex ? (spare * b.flex / flexTotal) : measureBlock(b, w, D);
    if (h > 0) drawBlock(parent, b, x, cy, w, h, D);
    cy += h;
    if (i < items.length - 1) cy += SQ(D, b && b.gapAfter != null ? b.gapAfter : gap, 6);
  });
  return cy - y;
}

function drawBlock(parent, b, x, y, w, h, D) {
  if (!b) return;
  const t = b.type || 'text';

  if (t === 'space') return;

  if (t === 'divider') {
    rect(parent, x, y, w, b.h || 2, col(b.color, D, D.inkSub));
    return;
  }

  if (t === 'photo') {
    const r = rect(parent, x, y, w, h, col(b.fill, D, g(0.88)), b.radius == null ? D.radius : b.radius);
    r.name = '사진 · ' + (b.label || '');
    txt(parent, { x: x, y: y + h / 2 - 16, w: w, align: 'CENTER',
      text: b.label ? '사진 · ' + b.label : '사진을 여기로 끌어놓으세요', size: 24, color: g(0.5) });
    return;
  }

  if (t === 'pill') {
    const text = b.text || '';
    const psize = SQ(D, b.size || 24, 16);
    const pw = b.w || Math.max(110, text.length * psize + SQ(D, 56, 28));
    const px = b.align === 'CENTER' ? x + (w - pw) / 2 : (b.align === 'RIGHT' ? x + w - pw : x);
    const fill = col(b.fill, D, D.accent);
    rect(parent, px, y, pw, h, fill, b.radius == null ? h / 2 : b.radius, b.stroke ? col(b.stroke, D) : null);
    txt(parent, { x: px, y: y, w: pw, h: h, fixed: true, align: 'CENTER', text: text,
      size: psize, bold: true, color: col(b.color, D, readable(fill)) });
    return;
  }

  if (t === 'text') {
    const size = fitBlockSize(b, w, D);
    txt(parent, { x: x, y: y, w: w, text: b.text || '', size: size,
      bold: b.weight !== 'regular', align: b.align || 'LEFT',
      color: col(b.color, D, D.ink), lh: b.lh || (size > 44 ? 130 : 158), ls: b.ls });
    return;
  }

  if (t === 'row') {
    const kids = b.children || [];
    const gap = b.gap == null ? D.gap : b.gap;
    const ws = splitWidths(w, kids, gap, b.widths);
    let cx = x;
    kids.forEach(function (k, i) {
      const kh = k && k.stretch ? h : measureBlock(k, ws[i], D);
      drawBlock(parent, k, cx, y, ws[i], kh, D);
      cx += ws[i] + gap;
    });
    return;
  }

  if (t === 'box') {
    const pad = SQ(D, b.pad == null ? 32 : b.pad, 16);
    rect(parent, x, y, w, h, col(b.fill, D, D.surface), b.radius == null ? D.radius : b.radius,
      b.stroke ? col(b.stroke, D) : null);
    if (b.bar) rect(parent, x, y, 8, h, col(b.bar, D, D.accent), 4);
    drawStack(parent, b.children || [], x + pad, y + pad, w - pad * 2, h - pad * 2,
      squeeze(D, D.sq, SQ(D, b.gap == null ? D.gap : b.gap, 6)));
    return;
  }
}

// blocks 를 직접 준 카드
function renderFreeCard(f, c, W, H, D, opts) {
  const bgName = c.bg || 'page';
  if (bgName === 'photo') {
    f.fills = [{ type: 'SOLID', color: g(0.1) }];
    photoSlot(f, 0, 0, W, H, c.photoLabel || '배경');
    if (c.scrim !== false) {
      const sy = H * (c.scrimFrom == null ? 0.28 : c.scrimFrom);
      scrim(f, 0, sy, W, H - sy, c.scrimStrength == null ? 0.9 : c.scrimStrength);
    }
  } else {
    f.fills = [{ type: 'SOLID', color: col(bgName, D, D.page) }];
  }
  // 내용이 프레임을 넘으면 여백 → 사진 → 글자 순으로 줄여가며 맞춘다.
  // 잘라내는 것보다 줄이는 게 낫다. 잘리면 무슨 말인지 알 수 없게 된다.
  let pad = c.pad == null ? D.pad : c.pad;
  const iw0 = W - pad * 2;
  let sq = 1, Dx = D;
  for (let i = 0; i < 16; i++) {
    Dx = squeeze(D, sq, Math.max(6, Math.round(D.gap * sq)));
    pad = Math.max(40, Math.round((c.pad == null ? D.pad : c.pad) * Math.max(sq, 0.6)));
    const need = stackHeight(c.blocks || [], W - pad * 2, Dx.gap, Dx);
    if (need <= H - pad * 2) break;
    sq -= 0.05;
    if (sq < 0.6) break;
  }
  if (sq < 0.85) warnings.push((c.id || '카드') + ' 내용이 많아 ' + Math.round((1 - sq) * 100) + '% 축소됨 — 문구를 줄이면 더 낫습니다');
  drawStack(f, c.blocks || [], pad, pad, W - pad * 2, H - pad * 2, Dx);
}

/* ═══════════ 테마 ═══════════
   레이아웃은 "무엇이 어디에", 테마는 "어떤 옷을 입고".
   둘을 섞어두면 콘텐츠가 달라도 결과가 똑같아 보인다. */

function makeTheme(name, brand, accent, sub) {
  const T = { name: name, brand: brand, accent: accent, sub: sub };

  if (name === 'bold') {
    // 인사이트·분석형. 어두운 지면에 큰 타이포.
    T.page = g(0.09); T.surface = g(0.15); T.line = g(0.26);
    T.ink = g(1); T.inkSub = g(0.62); T.inkOn = g(0.09);
    T.radius = 10; T.align = 'LEFT'; T.footer = 'line';
    T.headMax = 78; T.headMin = 46; T.bodySize = 32; T.subSize = 30;
    T.pad = 88; T.chip = accent;
  } else if (name === 'soft') {
    // 정보 정리형. 연한 지면에 둥근 카드.
    T.page = mix(brand, g(1), 0.92); T.surface = g(1); T.line = mix(brand, g(1), 0.78);
    T.ink = g(0.14); T.inkSub = g(0.42); T.inkOn = g(1);
    T.radius = 28; T.align = 'CENTER'; T.footer = 'page';
    T.headMax = 66; T.headMin = 40; T.bodySize = 30; T.subSize = 28;
    T.pad = 84; T.chip = brand;
  } else if (name === 'editorial') {
    // 브랜드 스토리형. 여백을 크게 두고 장식을 뺀다.
    T.page = { r: 0.98, g: 0.975, b: 0.965 }; T.surface = g(1); T.line = g(0.82);
    T.ink = g(0.12); T.inkSub = g(0.45); T.inkOn = g(1);
    T.radius = 0; T.align = 'LEFT'; T.footer = 'rule';
    T.headMax = 70; T.headMin = 42; T.bodySize = 30; T.subSize = 29;
    T.pad = 120; T.chip = brand;
  } else {
    // clean — 제품 소개형. 흰 지면에 컬러는 최소로.
    T.page = g(1); T.surface = g(0.97); T.line = g(0.9);
    T.ink = g(0.1); T.inkSub = g(0.4); T.inkOn = g(1);
    T.radius = 16; T.align = 'LEFT'; T.footer = 'bar';
    T.headMax = 62; T.headMin = 40; T.bodySize = 31; T.subSize = 30;
    T.pad = 90; T.chip = brand;
  }
  return T;
}

/* ═══════════ 공통 파츠 ═══════════ */

// 한 줄이 몇 줄로 감기는지 재고, 정해진 줄 수 안에 들어올 때까지 글자를 줄인다.
// 한국어는 어절 단위로 감겨서 크기를 안 줄이면 줄바꿈이 제멋대로 떨어진다.
function fitSize(text, w, maxSize, minSize, maxLines, lh) {
  const lines = String(text || '').split('\n');
  let size = maxSize;
  while (size > minSize) {
    let total = 0;
    for (let i = 0; i < lines.length; i++) {
      const h = measure(lines[i], w, size, lh);
      total += Math.max(1, Math.round(h / (size * lh / 100)));
    }
    if (total <= maxLines) break;
    size -= 3;
  }
  return size;
}

// 헤드라인. \n 앞줄은 강조색, 뒷줄은 본문색.
function headline(f, x, y, w, text, T, maxLines, align, c1, c2) {
  const size = fitSize(text, w, T.headMax, T.headMin, maxLines || 3, 130);
  const lines = String(text || '').split('\n');
  const a = align || T.align;
  let cy = y;
  cy += txt(f, { x: x, y: cy, w: w, align: a, text: lines[0] || '', size: size, bold: true, color: c1 || T.accent, lh: 130, ls: -2 });
  if (lines.length > 1) {
    cy += txt(f, { x: x, y: cy, w: w, align: a, text: lines.slice(1).join('\n'), size: size, bold: true, color: c2 || T.ink, lh: 130, ls: -2 });
  }
  return cy - y;
}

function brandLine(f, W, T, opts, align) {
  if (!opts.brandName) return 0;
  txt(f, { x: T.pad, y: T.pad - 30, w: W - T.pad * 2, align: align || T.align,
    text: opts.brandName, size: 28, bold: true, color: T.name === 'bold' ? T.accent : T.inkSub });
  return 48;
}

function badgeAt(f, x, y, text, T, align, W) {
  if (!text) return 0;
  const h = 52;
  const w = text.length * 25 + 56;
  const bx = align === 'CENTER' ? (W - w) / 2 : x;
  if (T.name === 'soft') { rect(f, bx, y, w, h, T.surface, h / 2, T.brand); txt(f, { x: bx, y: y, w: w, h: h, fixed: true, align: 'CENTER', text: text, size: 24, bold: true, color: T.brand }); }
  else if (T.name === 'bold') { rect(f, bx, y, w, h, T.accent, 6); txt(f, { x: bx, y: y, w: w, h: h, fixed: true, align: 'CENTER', text: text, size: 24, bold: true, color: T.inkOn }); }
  else if (T.name === 'editorial') { rect(f, bx, y + h - 2, w, 2, T.brand); txt(f, { x: bx, y: y, w: w, h: h, fixed: true, align: 'LEFT', text: text, size: 24, bold: true, color: T.brand }); }
  else { rect(f, bx, y, w, h, T.brand, 6); txt(f, { x: bx, y: y, w: w, h: h, fixed: true, align: 'CENTER', text: text, size: 24, bold: true, color: readable(T.brand) }); }
  return h + SP.md;
}

function footer(f, W, H, T, idx, opts) {
  if (T.footer === 'bar') rect(f, 0, H - 14, W, 14, T.brand);
  else if (T.footer === 'line') { rect(f, T.pad, H - 78, W - T.pad * 2, 2, T.line);
    txt(f, { x: T.pad, y: H - 62, w: W - T.pad * 2, text: opts.handle || '', size: 22, color: T.inkSub }); }
  else if (T.footer === 'page') {
    const w = 96;
    rect(f, T.pad, H - 96, w, 46, T.surface, 23, T.brand);
    txt(f, { x: T.pad, y: H - 96, w: w, h: 46, fixed: true, align: 'CENTER', text: String(idx + 1).padStart(2, '0'), size: 22, bold: true, color: T.brand });
    rect(f, T.pad + w + SP.md, H - 74, W - T.pad * 2 - w - SP.md, 2, T.line);
  } else if (T.footer === 'rule') {
    rect(f, T.pad, H - 90, 80, 3, T.ink);
    txt(f, { x: T.pad, y: H - 74, w: W - T.pad * 2, text: (opts.handle || '') + '   ·   ' + String(idx + 1).padStart(2, '0'), size: 21, color: T.inkSub });
  }
}

/* ═══════════ 카드 렌더 ═══════════ */

function renderDesign(f, c, W, H, brand, opts, idx, total) {
  // AI가 blocks 를 직접 짜서 보냈으면 그대로 그린다. 템플릿을 거치지 않는다.
  if (c.blocks && c.blocks.length) {
    renderFreeCard(f, c, W, H, tokens(opts.design, opts), opts);
    return;
  }
  const T = makeTheme(opts.theme || 'clean', brand, hex(opts.accentColor || '#FFD84D'), hex(opts.subColor || '#3A5AA8'));
  const layout = c.layout || 'text';
  const PAD = T.pad;
  const iw = W - PAD * 2;

  f.fills = [{ type: 'SOLID', color: T.page }];

  /* ── 표지 ── */
  if (layout === 'cover') {
    f.fills = [{ type: 'SOLID', color: g(0.1) }];
    photoSlot(f, 0, 0, W, H, '표지');
    scrim(f, 0, H * 0.28, W, H * 0.72, 0.9);
    if (opts.brandName) txt(f, { x: PAD, y: 56, w: iw, align: 'CENTER', text: opts.brandName, size: 32, bold: true, color: g(1) });

    const size = fitSize(c.headline || '', iw, 80, 48, 4, 132);
    const lines = String(c.headline || '').split('\n');
    let y = H - PAD - (c.sub ? 60 : 0);
    if (lines.length > 1) {
      const l2 = lines.slice(1).join('\n');
      y -= measure(l2, iw, size, 132);
      txt(f, { x: PAD, y: y, w: iw, text: l2, size: size, bold: true, color: T.accent, lh: 132, ls: -2 });
      y -= SP.xs;
    }
    y -= measure(lines[0] || '', iw, size, 132);
    txt(f, { x: PAD, y: y, w: iw, text: lines[0] || '', size: size, bold: true, color: g(1), lh: 132, ls: -2 });

    if (c.badge) {
      const bw = c.badge.length * 25 + 56;
      y -= 52 + SP.md;
      rect(f, PAD, y, bw, 52, g(0.12), T.name === 'soft' ? 26 : 6).opacity = 0.9;
      txt(f, { x: PAD, y: y, w: bw, h: 52, fixed: true, align: 'CENTER', text: c.badge, size: 24, bold: true, color: g(1) });
    }
    if (c.sub) txt(f, { x: PAD, y: H - PAD - 40, w: iw, text: c.sub, size: 26, color: g(0.8) });
    return;
  }

  /* ── CTA ── */
  if (layout === 'cta') {
    const dark = T.name === 'bold';
    f.fills = [{ type: 'SOLID', color: dark ? T.page : T.brand }];
    const ink = dark ? T.ink : readable(T.brand);
    const onInk = dark ? T.page : T.brand;

    let y = PAD + 20;
    if (opts.brandName) { txt(f, { x: PAD, y: y, w: iw, align: 'CENTER', text: opts.brandName, size: 30, bold: true, color: T.accent }); y += 70; }

    const headH = measure(c.headline || '', iw, 70, 130) * (String(c.headline || '').split('\n').length > 1 ? 2 : 1);
    const need = headH + SP.lg + (c.sub ? 60 : 0) + (c.cta ? 116 + SP.lg : 0) + 120;
    const photoH = Math.max(0, H - y - need - SP.lg);
    if (photoH > 160) { photoSlot(f, PAD, y, iw, photoH, '대표 컷', T.radius); y += photoH + SP.xl; }
    else y += SP.xl;

    y += headline(f, PAD, y, iw, c.headline || '', T, 3, 'CENTER', ink, ink) + SP.md;
    if (c.sub) y += txt(f, { x: PAD, y: y, w: iw, align: 'CENTER', text: c.sub, size: T.subSize, color: ink, lh: 160 }) + SP.lg;
    if (c.cta) {
      rect(f, PAD + iw * 0.08, y, iw * 0.84, 112, ink, 56);
      txt(f, { x: PAD + iw * 0.08, y: y, w: iw * 0.84, h: 112, fixed: true, align: 'CENTER', text: c.cta, size: 34, bold: true, color: onInk });
    }
    rect(f, 0, H - 74, W, 74, T.accent);
    txt(f, { x: PAD, y: H - 74, w: iw, h: 74, fixed: true, align: 'CENTER', text: opts.handle || '', size: 26, bold: true, color: readable(T.accent) });
    return;
  }

  /* ── 리스트 ── */
  if (layout === 'list') {
    let y = PAD;
    y += brandLine(f, W, T, opts, T.align) + SP.xs;
    y += badgeAt(f, PAD, y, c.badge, T, T.align, W);
    y += headline(f, PAD, y, iw, c.headline || '', T, 2) + SP.md;
    if (c.sub) y += txt(f, { x: PAD, y: y, w: iw, align: T.align, text: c.sub, size: T.subSize, color: T.inkSub, lh: 160 }) + SP.lg;

    const items = c.body || [];
    const bottom = H - (T.footer === 'bar' ? 60 : 130);
    const rowH = 96;
    const gap = items.length > 1
      ? Math.max(SP.sm, Math.min(SP.lg, ((bottom - y) - items.length * rowH) / (items.length - 1))) : 0;
    items.forEach((s) => {
      rect(f, PAD, y, iw, rowH, T.surface, T.radius);
      rect(f, PAD + 30, y + 33, 30, 30, T.chip, 15);
      txt(f, { x: PAD + 30, y: y + 33, w: 30, h: 30, fixed: true, align: 'CENTER', text: 'v', size: 17, bold: true, color: readable(T.chip) });
      txt(f, { x: PAD + 82, y: y, w: iw - 112, h: rowH, fixed: true, text: s, size: T.bodySize, color: T.ink });
      y += rowH + gap;
    });
    footer(f, W, H, T, idx, opts);
    return;
  }

  /* ── 표 ── */
  if (layout === 'table') {
    let y = PAD;
    y += brandLine(f, W, T, opts, T.align) + SP.xs;
    y += badgeAt(f, PAD, y, c.badge, T, T.align, W);
    y += headline(f, PAD, y, iw, c.headline || '', T, 2) + SP.md;
    if (c.sub) y += txt(f, { x: PAD, y: y, w: iw, align: T.align, text: c.sub, size: T.subSize, color: T.inkSub, lh: 160 }) + SP.lg;

    // 좌우로 쪼개지 않고 전폭 행으로 간다. 값이 커야 읽힌다.
    const rows = c.body || [];
    const bottom = H - (T.footer === 'bar' ? 60 : 130);
    const rowH = Math.max(96, Math.min(140, (bottom - y - SP.lg) / Math.max(rows.length, 1) - SP.sm));
    rows.forEach((row) => {
      const parts = String(row).split('·').map((t) => t.trim());
      rect(f, PAD, y, iw, rowH, T.surface, T.radius);
      rect(f, PAD, y, 8, rowH, T.chip, T.radius ? 4 : 0);
      txt(f, { x: PAD + 40, y: y, w: iw * 0.42, h: rowH, fixed: true, text: parts[0] || '', size: 28, bold: true, color: T.inkSub });
      txt(f, { x: PAD + iw * 0.46, y: y, w: iw * 0.5, h: rowH, fixed: true, text: parts[1] || '', size: 40, bold: true, color: T.ink });
      y += rowH + SP.sm;
    });
    if (c.summary) { y += SP.sm; summaryBoxT(f, PAD, y, iw, c.summary, T); }
    footer(f, W, H, T, idx, opts);
    return;
  }

  /* ── 비교 ── */
  if (layout === 'compare') {
    let y = PAD;
    y += brandLine(f, W, T, opts, 'CENTER') + SP.xs;
    y += badgeAt(f, PAD, y, c.badge, T, 'CENTER', W);
    y += headline(f, PAD, y, iw, c.headline || '', T, 2, 'CENTER') + SP.md;
    if (c.sub) y += txt(f, { x: PAD, y: y, w: iw, align: 'CENTER', text: c.sub, size: T.subSize, color: T.inkSub, lh: 160 }) + SP.lg;

    const cmp = c.compare || {};
    const colW = (iw - SP.lg) / 2;
    const cols = [
      { d: cmp.left || {}, x: PAD, color: T.brand },
      { d: cmp.right || {}, x: PAD + colW + SP.lg, color: T.sub },
    ];
    const maxItems = Math.max((cmp.left && cmp.left.items || []).length, (cmp.right && cmp.right.items || []).length);
    const sumH = c.summary ? measure(c.summary, iw - 80, 27, 165) + 64 : 0;
    const bottom = H - (T.footer === 'bar' ? 60 : 130);
    const avail = bottom - y - (sumH ? sumH + SP.md : 0);
    const chrome = 104 + maxItems * 76 + SP.lg;
    const photoH = Math.max(0, Math.min(200, avail - chrome));
    const colH = chrome + photoH;

    cols.forEach((col) => {
      rect(f, col.x, y, colW, colH, T.name === 'bold' ? T.surface : mix(T.brand, g(1), 0.95), T.radius + 8);
      const lw = Math.max(150, (col.d.label || '').length * 26 + 48);
      rect(f, col.x + (colW - lw) / 2, y + SP.md, lw, 52, col.color, 26);
      txt(f, { x: col.x + (colW - lw) / 2, y: y + SP.md, w: lw, h: 52, fixed: true, align: 'CENTER', text: col.d.label || '', size: 26, bold: true, color: readable(col.color) });
      let iy = y + 96;
      if (photoH > 60) { photoSlot(f, col.x + SP.md, iy, colW - SP.md * 2, photoH, col.d.label || '', 12); iy += photoH + SP.sm; }
      (col.d.items || []).forEach((it) => {
        rect(f, col.x + SP.sm, iy, colW - SP.sm * 2, 64, T.name === 'bold' ? T.page : g(1), 12);
        rect(f, col.x + 38, iy + 20, 24, 24, col.color, 12);
        txt(f, { x: col.x + 38, y: iy + 20, w: 24, h: 24, fixed: true, align: 'CENTER', text: 'v', size: 14, bold: true, color: readable(col.color) });
        txt(f, { x: col.x + 76, y: iy, w: colW - 100, h: 64, fixed: true, text: it, size: 24, color: T.ink });
        iy += 76;
      });
    });
    y += colH + SP.md;
    if (c.summary) summaryBoxT(f, PAD, y, iw, c.summary, T);
    footer(f, W, H, T, idx, opts);
    return;
  }

  /* ── 기본 본문 ── */
  let y = PAD;
  y += brandLine(f, W, T, opts, T.align) + SP.xs;
  y += badgeAt(f, PAD, y, c.badge, T, T.align, W);
  y += headline(f, PAD, y, iw, c.headline || '', T, 3) + SP.md;
  if (c.sub) y += txt(f, { x: PAD, y: y, w: iw, align: T.align, text: c.sub, size: T.subSize, color: T.inkSub, lh: 165 }) + SP.lg;
  (c.body || []).forEach((s) => {
    rect(f, PAD, y + 8, 12, 12, T.accent, 6);
    y += txt(f, { x: PAD + 36, y: y, w: iw - 36, text: s, size: T.bodySize, color: T.ink, lh: 158 }) + SP.md;
  });
  y += SP.md;
  const bottom = H - (T.footer === 'bar' ? 60 : 130);
  if (bottom - y > 180) photoSlot(f, PAD, y, iw, bottom - y - SP.md, '본문 이미지', T.radius);
  footer(f, W, H, T, idx, opts);
}

function summaryBoxT(f, x, y, w, text, T) {
  const h = measure(text, w - 80, 27, 165) + 64;
  rect(f, x, y, w, h, T.name === 'bold' ? T.surface : g(1), T.radius, T.line);
  txt(f, { x: x + 40, y: y + 32, w: w - 80, align: 'CENTER', text: text, size: 27, bold: true, color: T.ink, lh: 165 });
  return h;
}

function measure(text, w, size, lh) {
  const t = figma.createText();
  figma.currentPage.appendChild(t);
  t.fontName = { family: FONT.family, style: FONT.bold };
  t.characters = String(text || '');
  t.fontSize = size;
  if (lh) t.lineHeight = { value: lh, unit: 'PERCENT' };
  t.textAutoResize = 'HEIGHT';
  t.resize(Math.max(w, 1), t.height);
  const h = t.height;
  t.remove();
  return h;
}
