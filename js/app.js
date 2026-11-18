// OpenGravity Diagramas — editor de diagramas (versión 1, sin IA).
// Todo el diagrama vive en el objeto `doc`; cada cambio vuelve a dibujar el SVG.
'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const svg = $('#lienzo');
  const panel = $('#panel');
  const CLAVE_GUARDADO = 'opengravity.diagrama.actual.v1';
  const GRILLA = 10;

  const COLORES = ['#ffffff', '#7fe3ff', '#4fb3ff', '#ff6b9a', '#ffb454', '#ffe36e', '#7dffb2', '#c9a2ff'];
  const RELLENOS = ['none', '#1f78c8', '#0f4a8a', '#16335f', '#7a1f4a', '#7a4a12', '#155a3a', '#2b2b45'];
  const FUENTE_TITULO = "'Arial Black','Segoe UI Black','Roboto',system-ui,sans-serif";
  const FUENTE_MONO = "ui-monospace,'Cascadia Mono',Consolas,'Roboto Mono','Courier New',monospace";

  // ---------- Formas y bordes ----------
  // Polígonos en proporciones de 0 a 1 del rectángulo que ocupa la forma.
  const POLIGONOS = {
    diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
    triangle: [[0.5, 0], [1, 1], [0, 1]],
    hexagon: [[0.22, 0], [0.78, 0], [1, 0.5], [0.78, 1], [0.22, 1], [0, 0.5]],
    parallelogram: [[0.18, 0], [1, 0], [0.82, 1], [0, 1]]
  };
  const FORMAS = {
    round: { nombre: 'Redondeado', w: 220, h: 110 },
    rect: { nombre: 'Rectángulo', w: 220, h: 110 },
    ellipse: { nombre: 'Círculo', w: 160, h: 160 },
    diamond: { nombre: 'Rombo', w: 170, h: 170 },
    triangle: { nombre: 'Triángulo', w: 180, h: 160 },
    hexagon: { nombre: 'Hexágono', w: 220, h: 120 },
    parallelogram: { nombre: 'Paralelogramo', w: 230, h: 110 },
    cylinder: { nombre: 'Cilindro', w: 160, h: 180 }
  };
  const BORDES = { solid: 'Continuo', dashed: 'Rayas', dotted: 'Puntos' };
  const tapaCilindro = (h) => Math.min(h * 0.15, 20);

  // Contorno SVG de una forma dentro del rectángulo (x, y, w, h); `attrs` son los atributos de estilo.
  function figura(shape, x, y, w, h, attrs) {
    if (shape === 'ellipse') return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${attrs}/>`;
    if (POLIGONOS[shape]) return `<polygon points="${POLIGONOS[shape].map(([px, py]) => `${x + px * w},${y + py * h}`).join(' ')}" ${attrs}/>`;
    if (shape === 'cylinder') {
      const rx = w / 2, ry = tapaCilindro(h);
      return `<path d="M${x},${y + ry} A${rx},${ry} 0 0 1 ${x + w},${y + ry} V${y + h - ry} A${rx},${ry} 0 0 1 ${x},${y + h - ry} Z M${x},${y + ry} A${rx},${ry} 0 0 0 ${x + w},${y + ry}" ${attrs}/>`;
    }
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape === 'rect' ? 0 : Math.min(14, w / 4, h / 4)}" ${attrs}/>`;
  }
  // Patrón del borde: rayas o puntos.
  function trazoBorde(border) {
    if (border === 'dashed') return ' stroke-dasharray="12 8"';
    if (border === 'dotted') return ' stroke-dasharray="0.1 8" stroke-linecap="round"';
    return '';
  }

  // ---------- Fondos ----------
  const FONDOS = {
    noche: { nombre: 'Noche azul', type: 'gradient', c1: '#1d4f96', c2: '#0a2350', stars: true, pattern: 'none' },
    violeta: { nombre: 'Espacio violeta', type: 'gradient', c1: '#4a2a8a', c2: '#120a2e', stars: true, pattern: 'none' },
    negro: { nombre: 'Negro', type: 'solid', c1: '#0b0d12', c2: '#0b0d12', stars: false, pattern: 'none' },
    pizarra: { nombre: 'Pizarra verde', type: 'gradient', c1: '#2f5a46', c2: '#142a22', stars: false, pattern: 'none' },
    plano: { nombre: 'Plano técnico', type: 'solid', c1: '#16457f', c2: '#16457f', stars: false, pattern: 'grid' },
    blanco: { nombre: 'Blanco', type: 'solid', c1: '#ffffff', c2: '#ffffff', stars: false, pattern: 'none' },
    gris: { nombre: 'Gris claro', type: 'solid', c1: '#e9edf3', c2: '#e9edf3', stars: false, pattern: 'none' },
    papel: { nombre: 'Papel cuadriculado', type: 'solid', c1: '#f8fafd', c2: '#f8fafd', stars: false, pattern: 'grid' }
  };
  const TEXTURAS = { none: 'Ninguna', grid: 'Cuadrícula', dots: 'Puntos' };
  const TINTA_OSCURA = '#16243f';

  function luminancia(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0;
    const v = parseInt(m[1], 16);
    const canal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * canal(v >> 16 & 255) + 0.7152 * canal(v >> 8 & 255) + 0.0722 * canal(v & 255);
  }
  // Color "de base" del fondo: el liso, o el de los bordes en un degradado.
  const colorBase = () => (doc.bg.type === 'solid' ? doc.bg.c1 : doc.bg.c2);
  function fondoClaro() {
    const l = doc.bg.type === 'solid' ? luminancia(doc.bg.c1) : (luminancia(doc.bg.c1) + luminancia(doc.bg.c2)) / 2;
    return l > 0.45;
  }
  // Color de los textos fijos (subtítulos, etiquetas, selección) según el fondo.
  const tinta = () => (fondoClaro() ? TINTA_OSCURA : '#f2f6ff');

  // Cambia el fondo; si pasa de oscuro a claro (o al revés), los elementos blancos
  // pasan a azul oscuro (o al revés) para que se sigan viendo.
  function cambiarFondo(mutar) {
    const antes = fondoClaro();
    mutar(doc.bg);
    const ahora = fondoClaro();
    if (antes === ahora) return;
    const [de, a] = ahora ? ['#ffffff', TINTA_OSCURA] : [TINTA_OSCURA, '#ffffff'];
    for (const n of doc.nodes) if (String(n.color).toLowerCase() === de) n.color = a;
    for (const e of doc.edges) if (String(e.color).toLowerCase() === de) e.color = a;
  }

  // ---------- Estado ----------
  let doc = null;
  let sel = null; // { kind: 'node' | 'edge' | 'doc', id }
  const view = { x: 0, y: 0, k: 1 };
  let pasado = [];
  let futuro = [];
  let presente = '';
  let gesto = null;
  const punteros = new Map();
  let ultimoToque = { id: null, t: 0 };

  const copia = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ajustar = (v) => Math.round(v / GRILLA) * GRILLA;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nodo = (id) => doc.nodes.find((n) => n.id === id);
  const arista = (id) => doc.edges.find((e) => e.id === id);

  function normalizar(d) {
    const base = copia(window.PLANTILLAS.blanco);
    const out = Object.assign(base, d || {});
    out.bg = Object.assign({ type: 'gradient', c1: '#1d4f96', c2: '#0a2350', stars: true, pattern: 'none' }, out.bg || {});
    if (!['gradient', 'solid'].includes(out.bg.type)) out.bg.type = 'gradient';
    if (!TEXTURAS[out.bg.pattern]) out.bg.pattern = 'none';
    out.nodes = (Array.isArray(out.nodes) ? out.nodes : []).map((n) => {
      const m = Object.assign({
        type: 'text', x: 0, y: 0, w: 200, h: 80, title: '', subtitle: '', color: '#ffffff',
        fill: '#1f78c8', titleSize: 28, subSize: 16, glow: true
      }, n, { id: n.id || uid('n') });
      if (!FORMAS[m.shape]) m.shape = 'round';
      if (!BORDES[m.border]) m.border = m.type === 'group' ? 'dashed' : 'solid';
      return m;
    });
    out.edges = (Array.isArray(out.edges) ? out.edges : []).map((e) => {
      const m = Object.assign({ label: '', arrow: 'end', color: '#ffffff' }, e, { id: e.id || uid('e') });
      if (!BORDES[m.style]) m.style = m.dashed ? 'dashed' : 'solid'; // archivos viejos usaban "dashed"
      delete m.dashed;
      return m;
    });
    const ids = new Set(out.nodes.map((n) => n.id));
    out.edges = out.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    return out;
  }

  // ---------- Historial (deshacer / rehacer) y autoguardado ----------
  function confirmarCambio() {
    const s = JSON.stringify(doc);
    if (s === presente) return;
    pasado.push(presente);
    if (pasado.length > 150) pasado.shift();
    presente = s;
    futuro = [];
    guardarLocal();
    actualizarBotones();
  }
  function deshacer() {
    if (!pasado.length) return;
    futuro.push(presente);
    presente = pasado.pop();
    doc = JSON.parse(presente);
    tras_historial();
  }
  function rehacer() {
    if (!futuro.length) return;
    pasado.push(presente);
    presente = futuro.pop();
    doc = JSON.parse(presente);
    tras_historial();
  }
  function tras_historial() {
    if (sel && sel.kind === 'node' && !nodo(sel.id)) sel = null;
    if (sel && sel.kind === 'edge' && !arista(sel.id)) sel = null;
    guardarLocal();
    dibujar();
    dibujarPanel();
    actualizarBotones();
  }
  function cargarDoc(d, { reiniciarHistorial = true } = {}) {
    doc = normalizar(d);
    if (reiniciarHistorial) { pasado = []; futuro = []; presente = JSON.stringify(doc); }
    else confirmarCambio();
    sel = null;
    guardarLocal();
    dibujar();
    dibujarPanel();
    verTodo();
    actualizarBotones();
  }
  function guardarLocal() {
    try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(doc)); } catch (_) { /* sin almacenamiento */ }
  }
  function leerLocal() {
    try {
      const s = localStorage.getItem(CLAVE_GUARDADO);
      if (!s) return null;
      const d = JSON.parse(s);
      return d && Array.isArray(d.nodes) ? d : null;
    } catch (_) { return null; }
  }
  function actualizarBotones() {
    $('#b-deshacer').disabled = !pasado.length;
    $('#b-rehacer').disabled = !futuro.length;
    $('#nombre-doc').textContent = doc.name || '';
  }

  // ---------- Geometría ----------
  const centro = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

  // Punto donde una recta que sale de p (dentro del rectángulo) en dirección d cruza el borde.
  function salidaRect(n, p, d) {
    const tx = d.x > 1e-9 ? (n.x + n.w - p.x) / d.x : d.x < -1e-9 ? (n.x - p.x) / d.x : Infinity;
    const ty = d.y > 1e-9 ? (n.y + n.h - p.y) / d.y : d.y < -1e-9 ? (n.y - p.y) / d.y : Infinity;
    const t = Math.max(0, Math.min(tx, ty));
    return { x: p.x + d.x * t, y: p.y + d.y * t };
  }

  // Igual que salidaRect, pero respetando el contorno real (círculo, rombo, triángulo…).
  // Se toma la intersección más lejana en la dirección d: la cara que mira hacia el otro elemento.
  function salidaForma(n, p, d) {
    if (n.type !== 'box') return salidaRect(n, p, d);
    if (n.shape === 'ellipse') {
      const rx = n.w / 2, ry = n.h / 2, cx = n.x + rx, cy = n.y + ry;
      const qx = p.x - cx, qy = p.y - cy;
      const a = (d.x * d.x) / (rx * rx) + (d.y * d.y) / (ry * ry);
      const b = 2 * ((qx * d.x) / (rx * rx) + (qy * d.y) / (ry * ry));
      const c = (qx * qx) / (rx * rx) + (qy * qy) / (ry * ry) - 1;
      const disc = b * b - 4 * a * c;
      if (disc < 0 || a === 0) return salidaRect(n, p, d);
      const t = Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
      return { x: p.x + d.x * t, y: p.y + d.y * t };
    }
    const poli = POLIGONOS[n.shape];
    if (!poli) return salidaRect(n, p, d);
    const pts = poli.map(([px, py]) => ({ x: n.x + px * n.w, y: n.y + py * n.h }));
    let mejor = -1;
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i], B = pts[(i + 1) % pts.length];
      const ex = B.x - A.x, ey = B.y - A.y;
      const den = d.x * ey - d.y * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((A.x - p.x) * ey - (A.y - p.y) * ex) / den;
      const u = ((A.x - p.x) * d.y - (A.y - p.y) * d.x) / den;
      if (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > mejor) mejor = t;
    }
    if (mejor < 0) return salidaRect(n, p, d);
    return { x: p.x + d.x * mejor, y: p.y + d.y * mejor };
  }

  // Separa las flechas que unen el mismo par de elementos para que no se encimen.
  function desplazamientos() {
    const grupos = {};
    for (const e of doc.edges) {
      const k = [e.from, e.to].sort().join('|');
      (grupos[k] = grupos[k] || []).push(e);
    }
    const off = {};
    for (const k in grupos) {
      const lista = grupos[k];
      lista.forEach((e, i) => { off[e.id] = (i - (lista.length - 1) / 2) * 22; });
    }
    return off;
  }

  function geometriaArista(e, off) {
    const a = nodo(e.from), b = nodo(e.to);
    if (!a || !b) return null;
    const ca = centro(a), cb = centro(b);
    const [p, q] = e.from < e.to ? [ca, cb] : [cb, ca];
    const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const perp = { x: -(q.y - p.y) / L, y: (q.x - p.x) / L };
    const lim = Math.max(0, Math.min(a.w, a.h, b.w, b.h) / 2 - 6);
    const o = Math.max(-lim, Math.min(lim, off || 0));
    const d = { x: (cb.x - ca.x) / L, y: (cb.y - ca.y) / L };
    const sa = { x: ca.x + perp.x * o, y: ca.y + perp.y * o };
    const sb = { x: cb.x + perp.x * o, y: cb.y + perp.y * o };
    const hueco = 6;
    let ini = salidaForma(a, sa, d);
    let fin = salidaForma(b, sb, { x: -d.x, y: -d.y });
    ini = { x: ini.x + d.x * hueco, y: ini.y + d.y * hueco };
    fin = { x: fin.x - d.x * hueco, y: fin.y - d.y * hueco };
    return { ini, fin, d, perp, o };
  }

  // ---------- Dibujo ----------
  function defs(paraExportar) {
    const claro = fondoClaro();
    const estrellas = [];
    let semilla = 7;
    const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      estrellas.push(`<circle cx="${(azar() * 400).toFixed(1)}" cy="${(azar() * 400).toFixed(1)}" r="${(0.6 + azar() * 1.3).toFixed(2)}" fill="${claro ? '#7d9cc7' : '#cfe6ff'}" opacity="${(0.25 + azar() * 0.5).toFixed(2)}"/>`);
    }
    return `<defs>
      <filter id="brillo" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="brillo-suave" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="degradado" cx="50%" cy="45%" r="75%">
        <stop offset="0" stop-color="${esc(doc.bg.c1)}"/><stop offset="1" stop-color="${esc(doc.bg.type === 'solid' ? doc.bg.c1 : doc.bg.c2)}"/>
      </radialGradient>
      <pattern id="estrellas" width="400" height="400" patternUnits="userSpaceOnUse">${estrellas.join('')}</pattern>
      <pattern id="cuadricula" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${claro ? '#8fb3e0' : '#ffffff'}" stroke-opacity="${claro ? 0.6 : 0.13}" stroke-width="1"/></pattern>
      <pattern id="puntos-fondo" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.5" fill="${claro ? '#8fb3e0' : '#ffffff'}" opacity="${claro ? 0.7 : 0.18}"/></pattern>
      ${paraExportar ? '' : `<pattern id="puntos" width="${GRILLA * 4}" height="${GRILLA * 4}" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${claro ? TINTA_OSCURA : '#ffffff'}" opacity="${claro ? 0.12 : 0.07}"/></pattern>`}
    </defs>`;
  }

  function lineasTexto(n) {
    const out = [];
    const tit = n.title ? String(n.title).split('\n') : [];
    const sub = n.type !== 'group' && n.subtitle ? String(n.subtitle).split('\n') : [];
    const altT = n.titleSize * 1.12, altS = n.subSize * 1.4, sep = tit.length && sub.length ? 8 : 0;
    const total = tit.length * altT + sub.length * altS + sep;
    let centroY = n.y + n.h / 2;
    if (n.type === 'box' && n.shape === 'triangle') centroY = n.y + n.h * 0.64;
    if (n.type === 'box' && n.shape === 'cylinder') centroY += tapaCilindro(n.h) / 2;
    let y = centroY - total / 2;
    const cx = n.x + n.w / 2;
    const fil = n.glow ? ' filter="url(#brillo)"' : '';
    for (const t of tit) {
      out.push(`<text x="${cx}" y="${y + altT * 0.82}" text-anchor="middle" font-family="${FUENTE_TITULO}" font-weight="900" font-size="${n.titleSize}" fill="${esc(n.color)}"${fil}>${esc(t)}</text>`);
      y += altT;
    }
    y += sep;
    // En las formas el subtítulo va sobre el relleno; si no hay relleno, sobre el fondo.
    const colorSub = n.type === 'box' && n.fill !== 'none' ? '#e9f3ff' : tinta();
    for (const t of sub) {
      out.push(`<text x="${cx}" y="${y + altS * 0.72}" text-anchor="middle" font-family="${FUENTE_MONO}" font-weight="700" font-size="${n.subSize}" fill="${colorSub}">${esc(t)}</text>`);
      y += altS;
    }
    return out.join('');
  }

  function dibujarNodo(n, paraExportar) {
    const datos = paraExportar ? '' : ` data-node="${n.id}"`;
    if (n.type === 'group') {
      const fil = n.glow ? ' filter="url(#brillo-suave)"' : '';
      return `<g>
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="4" fill="none" stroke="${esc(n.color)}" stroke-width="3"${trazoBorde(n.border)}${fil}/>
        ${n.title ? `<text x="${n.x - 4}" y="${n.y - 12}" font-family="${FUENTE_TITULO}" font-weight="900" font-size="${n.titleSize}" fill="${esc(n.color)}"${n.glow ? ' filter="url(#brillo)"' : ''}${datos}>${esc(n.title)}</text>` : ''}
        ${paraExportar ? '' : `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="none" stroke="transparent" stroke-width="22" pointer-events="stroke"${datos}/>`}
      </g>`;
    }
    let forma = '';
    if (n.type === 'box') {
      const fil = n.glow ? ' filter="url(#brillo-suave)"' : '';
      const relleno = n.fill === 'none' ? 'none' : esc(n.fill);
      forma = figura(n.shape, n.x, n.y, n.w, n.h, `fill="${relleno}" stroke="${esc(n.color)}" stroke-width="3" stroke-linejoin="round"${trazoBorde(n.border)}${fil}`);
    }
    const zona = paraExportar ? '' : `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="transparent"${datos}/>`;
    return `<g>${forma}<g pointer-events="none">${lineasTexto(n)}</g>${zona}</g>`;
  }

  function dibujarArista(e, off, paraExportar) {
    const g = geometriaArista(e, off);
    if (!g) return '';
    const { d, perp } = g;
    let { ini, fin } = g;
    const flechaFin = e.arrow === 'end' || e.arrow === 'both';
    const flechaIni = e.arrow === 'start' || e.arrow === 'both';
    const largo = 14, ancho = 7;
    const puntas = [];
    const punta = (tip, dir) => {
      const bx = tip.x - dir.x * largo, by = tip.y - dir.y * largo;
      const px = -dir.y, py = dir.x;
      return `<polygon points="${tip.x},${tip.y} ${bx + px * ancho},${by + py * ancho} ${bx - px * ancho},${by - py * ancho}" fill="${esc(e.color)}"/>`;
    };
    if (flechaFin) { puntas.push(punta(fin, d)); fin = { x: fin.x - d.x * largo * 0.8, y: fin.y - d.y * largo * 0.8 }; }
    if (flechaIni) { const r = { x: -d.x, y: -d.y }; puntas.push(punta(ini, r)); ini = { x: ini.x + d.x * largo * 0.8, y: ini.y + d.y * largo * 0.8 }; }
    const trazo = `M${ini.x},${ini.y} L${fin.x},${fin.y}`;
    const guion = e.style === 'dashed' ? ' stroke-dasharray="10 8"' : e.style === 'dotted' ? ' stroke-dasharray="0.1 7"' : '';
    const seleccionada = !paraExportar && sel && sel.kind === 'edge' && sel.id === e.id;

    let etiqueta = '';
    if (e.label) {
      const signo = g.o < 0 ? -1 : 1;
      const m = { x: (g.ini.x + g.fin.x) / 2, y: (g.ini.y + g.fin.y) / 2 };
      const nx = perp.x * signo, ny = perp.y * signo;
      let ancla = 'middle', lx = m.x + nx * 16, ly = m.y + ny * 16 + 5;
      if (Math.abs(nx) > 0.5) { ancla = nx > 0 ? 'start' : 'end'; lx = m.x + nx * 12; ly = m.y + ny * 12 + 5; }
      else if (ny < 0) { ly = m.y + ny * 16; }
      else { ly = m.y + ny * 16 + 12; }
      etiqueta = `<text x="${lx}" y="${ly}" text-anchor="${ancla}" font-family="${FUENTE_MONO}" font-weight="700" font-size="15" fill="${tinta()}" stroke="${esc(colorBase())}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(e.label)}</text>`;
    }
    return `<g>
      ${seleccionada ? `<path d="${trazo}" stroke="#7fe3ff" stroke-width="12" opacity=".35" stroke-linecap="round" fill="none"/>` : ''}
      <path d="${trazo}" stroke="${esc(e.color)}" stroke-width="3" stroke-linecap="round" fill="none"${guion}/>
      ${puntas.join('')}
      ${etiqueta}
      ${paraExportar ? '' : `<path d="M${g.ini.x},${g.ini.y} L${g.fin.x},${g.fin.y}" stroke="transparent" stroke-width="20" fill="none" data-edge="${e.id}"/>`}
    </g>`;
  }

  function contenido(paraExportar) {
    const off = desplazamientos();
    const grupos = doc.nodes.filter((n) => n.type === 'group');
    const otros = doc.nodes.filter((n) => n.type !== 'group');
    return grupos.map((n) => dibujarNodo(n, paraExportar)).join('') +
      doc.edges.map((e) => dibujarArista(e, off[e.id], paraExportar)).join('') +
      otros.map((n) => dibujarNodo(n, paraExportar)).join('');
  }

  function capaSeleccion() {
    let s = '';
    const k = view.k;
    if (sel && sel.kind === 'node') {
      const n = nodo(sel.id);
      if (n) {
        const pad = 6 / k;
        s += `<rect x="${n.x - pad}" y="${n.y - pad}" width="${n.w + pad * 2}" height="${n.h + pad * 2}" fill="none" stroke="${tinta()}" stroke-opacity=".75" stroke-width="${1.5 / k}" stroke-dasharray="${6 / k} ${4 / k}" pointer-events="none"/>`;
        const t = 16 / k;
        s += `<rect x="${n.x + n.w - t / 2}" y="${n.y + n.h - t / 2}" width="${t}" height="${t}" rx="${3 / k}" fill="#7fe3ff" stroke="#04213f" stroke-width="${1.5 / k}" data-handle="resize" data-id="${n.id}"/>`;
        const r = 13 / k, cx = n.x + n.w + 26 / k, cy = n.y + n.h / 2;
        s += `<g data-handle="connect" data-id="${n.id}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#7fe3ff" stroke="#04213f" stroke-width="${1.5 / k}" data-handle="connect" data-id="${n.id}"/>
          <path d="M${cx - r * 0.5},${cy} H${cx + r * 0.5} M${cx},${cy - r * 0.5} V${cy + r * 0.5}" stroke="#04213f" stroke-width="${2.5 / k}" stroke-linecap="round" pointer-events="none"/></g>`;
      }
    }
    if (gesto && gesto.tipo === 'conectar') {
      const n = nodo(gesto.desde);
      if (n) {
        const c = centro(n);
        s += `<path d="M${c.x},${c.y} L${gesto.p.x},${gesto.p.y}" stroke="#7fe3ff" stroke-width="${2.5 / k}" stroke-dasharray="${8 / k} ${6 / k}" fill="none" pointer-events="none"/>`;
        s += `<circle cx="${gesto.p.x}" cy="${gesto.p.y}" r="${6 / k}" fill="#7fe3ff" pointer-events="none"/>`;
      }
    }
    return s;
  }

  // Textura y estrellas del fondo, en coordenadas del diagrama (se mueven con él).
  function capasFondo(x, y, w, h) {
    const r = (relleno) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${relleno})" pointer-events="none"/>`;
    return (doc.bg.pattern === 'grid' ? r('cuadricula') : doc.bg.pattern === 'dots' ? r('puntos-fondo') : '') +
      (doc.bg.stars ? r('estrellas') : '');
  }
  const colorFondo = () => (doc.bg.type === 'solid' ? esc(doc.bg.c1) : 'url(#degradado)');

  function dibujar() {
    const W = svg.clientWidth || 800, H = svg.clientHeight || 600;
    const x0 = -view.x / view.k, y0 = -view.y / view.k, ancho = W / view.k, alto = H / view.k;
    svg.innerHTML = defs(false) +
      `<rect x="0" y="0" width="${W}" height="${H}" fill="${colorFondo()}"/>` +
      `<g transform="translate(${view.x} ${view.y}) scale(${view.k})">` +
      capasFondo(x0, y0, ancho, alto) +
      `<rect x="${x0}" y="${y0}" width="${ancho}" height="${alto}" fill="url(#puntos)" pointer-events="none"/>` +
      contenido(false) + capaSeleccion() + '</g>';
  }

  // ---------- Vista ----------
  function limites() {
    if (!doc.nodes.length) return { x: 0, y: 0, w: 800, h: 500 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of doc.nodes) {
      const extraArriba = n.type === 'group' && n.title ? n.titleSize + 16 : 0;
      x1 = Math.min(x1, n.x - 8); y1 = Math.min(y1, n.y - extraArriba);
      x2 = Math.max(x2, n.x + n.w + 8); y2 = Math.max(y2, n.y + n.h + 8);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  // `fraccion`: parte de la altura disponible (en el celular, 0.5 = la mitad de arriba, sobre el panel).
  function verTodo(fraccion = 1) {
    const b = limites();
    const W = svg.clientWidth || 800, H = (svg.clientHeight || 600) * fraccion;
    const margen = W < 500 ? 8 : 30;
    const k = Math.max(0.15, Math.min(2, Math.min((W - margen * 2) / b.w, (H - margen * 2 - 30) / b.h)));
    view.k = k;
    view.x = (W - b.w * k) / 2 - b.x * k;
    view.y = (H - b.h * k) / 2 - b.y * k - 10;
    dibujar();
  }
  function zoomEn(sx, sy, factor) {
    const k = Math.max(0.1, Math.min(5, view.k * factor));
    const wx = (sx - view.x) / view.k, wy = (sy - view.y) / view.k;
    view.k = k;
    view.x = sx - wx * k;
    view.y = sy - wy * k;
  }
  function aMundo(cx, cy) {
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  }
  // En el celular el panel tapa la mitad de abajo: subir la vista si el elemento quedó oculto.
  function asegurarVisible(id) {
    const n = nodo(id);
    if (!n || !window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches) return;
    const H = svg.clientHeight;
    const cy = (n.y + n.h / 2) * view.k + view.y;
    if (cy > H * 0.42) { view.y -= cy - H * 0.25; dibujar(); }
  }
  function centroVista() {
    return aMundo(svg.getBoundingClientRect().left + svg.clientWidth / 2, svg.getBoundingClientRect().top + svg.clientHeight / 2);
  }

  // ---------- Crear y modificar ----------
  function agregarNodo(tipo, forma = 'round') {
    const c = centroVista();
    const n = { id: uid('n'), type: tipo, title: '', subtitle: '', glow: true, subSize: 16, shape: 'round', border: 'solid' };
    if (tipo === 'box') {
      const f = FORMAS[forma] || FORMAS.round;
      const conSubtitulo = ['round', 'rect', 'hexagon', 'parallelogram', 'cylinder'].includes(forma);
      Object.assign(n, {
        shape: FORMAS[forma] ? forma : 'round', w: f.w, h: f.h, title: 'NUEVO', subtitle: conSubtitulo ? 'descripción' : '',
        color: '#e6f7ff', fill: '#1f78c8', titleSize: conSubtitulo ? 34 : 28
      });
    }
    if (tipo === 'text') Object.assign(n, { w: 280, h: 80, title: 'TÍTULO', subtitle: 'detalle · detalle', color: '#7fe3ff', fill: 'none', titleSize: 30 });
    if (tipo === 'group') Object.assign(n, { w: 460, h: 300, title: 'GRUPO', color: '#ffb454', fill: 'none', titleSize: 26, border: 'dashed' });
    n.x = ajustar(c.x - n.w / 2 + (Math.random() * 40 - 20));
    n.y = ajustar(c.y - n.h / 2 + (Math.random() * 40 - 20));
    if (tipo === 'group') doc.nodes.unshift(n); else doc.nodes.push(n);
    sel = { kind: 'node', id: n.id };
    confirmarCambio();
    dibujar();
    dibujarPanel();
    asegurarVisible(n.id);
  }
  function eliminarSeleccion() {
    if (!sel) return;
    if (sel.kind === 'node') {
      doc.nodes = doc.nodes.filter((n) => n.id !== sel.id);
      doc.edges = doc.edges.filter((e) => e.from !== sel.id && e.to !== sel.id);
    } else if (sel.kind === 'edge') {
      doc.edges = doc.edges.filter((e) => e.id !== sel.id);
    } else return;
    sel = null;
    confirmarCambio();
    dibujar();
    dibujarPanel();
  }
  function duplicarSeleccion() {
    if (!sel || sel.kind !== 'node') return;
    const n = nodo(sel.id);
    const c = Object.assign(copia(n), { id: uid('n'), x: n.x + 30, y: n.y + 30 });
    doc.nodes.splice(doc.nodes.indexOf(n) + 1, 0, c);
    sel = { kind: 'node', id: c.id };
    confirmarCambio();
    dibujar();
    dibujarPanel();
  }
  function moverOrden(alFrente) {
    if (!sel || sel.kind !== 'node') return;
    const n = nodo(sel.id);
    doc.nodes = doc.nodes.filter((x) => x !== n);
    if (alFrente) doc.nodes.push(n); else doc.nodes.unshift(n);
    confirmarCambio();
    dibujar();
  }
  // Elementos que están dentro de un grupo: los que tienen su centro dentro del marco.
  // Incluye grupos anidados (y, por lo tanto, lo que estos tienen adentro).
  function contenidoDeGrupo(g) {
    if (!g || g.type !== 'group') return [];
    return doc.nodes.filter((n) => {
      if (n === g) return false;
      const c = centro(n);
      return c.x >= g.x && c.x <= g.x + g.w && c.y >= g.y && c.y <= g.y + g.h;
    });
  }

  function nodoEn(cx, cy, excluir) {
    for (const el of document.elementsFromPoint(cx, cy)) {
      const id = el.getAttribute && el.getAttribute('data-node');
      if (id && id !== excluir) return id;
    }
    // Si no hay nada justo debajo, probar con los rectángulos (útil dentro de grupos).
    const p = aMundo(cx, cy);
    const candidatos = doc.nodes.filter((n) => n.id !== excluir && p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h);
    const noGrupo = candidatos.filter((n) => n.type !== 'group');
    const elegido = (noGrupo.length ? noGrupo : candidatos).pop();
    return elegido ? elegido.id : null;
  }

  // ---------- Gestos con mouse y dedos ----------
  function seleccionar(s) {
    const cambio = JSON.stringify(s) !== JSON.stringify(sel);
    sel = s;
    if (cambio) dibujarPanel();
  }

  svg.addEventListener('pointerdown', (ev) => {
    cerrarMenu();
    try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* nada */ }
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const r = svg.getBoundingClientRect();
      gesto = {
        tipo: 'pellizco',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        medio: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
        vista: { ...view }
      };
      return;
    }
    if (punteros.size > 2) return;

    const t = ev.target;
    const p = aMundo(ev.clientX, ev.clientY);
    const handle = t.getAttribute('data-handle') || (t.parentNode && t.parentNode.getAttribute && t.parentNode.getAttribute('data-handle'));
    const idHandle = t.getAttribute('data-id') || (t.parentNode && t.parentNode.getAttribute && t.parentNode.getAttribute('data-id'));
    const idNodo = t.getAttribute('data-node');
    const idArista = t.getAttribute('data-edge');

    if (handle === 'resize') {
      const n = nodo(idHandle);
      gesto = { tipo: 'redimensionar', id: n.id, inicio: p, orig: { w: n.w, h: n.h } };
    } else if (handle === 'connect') {
      gesto = { tipo: 'conectar', desde: idHandle, p };
    } else if (idNodo) {
      const n = nodo(idNodo);
      const ahora = Date.now();
      const dobleToque = ultimoToque.id === idNodo && ahora - ultimoToque.t > 60 && ahora - ultimoToque.t < 380;
      ultimoToque = { id: idNodo, t: ahora };
      seleccionar({ kind: 'node', id: idNodo });
      const arrastrados = [n, ...contenidoDeGrupo(n)].map((m) => ({ id: m.id, x: m.x, y: m.y }));
      gesto = { tipo: 'mover', id: idNodo, inicio: p, orig: { x: n.x, y: n.y }, arrastrados, movido: false };
      if (dobleToque) setTimeout(() => { const i = $('#p-titulo'); if (i) { i.focus(); i.select(); } }, 30);
    } else if (idArista) {
      seleccionar({ kind: 'edge', id: idArista });
      gesto = null;
    } else {
      gesto = { tipo: 'desplazar', sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, movido: false };
      svg.classList.add('arrastrando');
    }
    dibujar();
  });

  svg.addEventListener('pointermove', (ev) => {
    if (!punteros.has(ev.pointerId)) return;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!gesto) return;

    if (gesto.tipo === 'pellizco' && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const r = svg.getBoundingClientRect();
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const medio = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const k = Math.max(0.1, Math.min(5, gesto.vista.k * dist / gesto.dist));
      const wx = (gesto.medio.x - gesto.vista.x) / gesto.vista.k;
      const wy = (gesto.medio.y - gesto.vista.y) / gesto.vista.k;
      view.k = k;
      view.x = medio.x - wx * k;
      view.y = medio.y - wy * k;
      dibujar();
      return;
    }
    const p = aMundo(ev.clientX, ev.clientY);
    if (gesto.tipo === 'desplazar') {
      const dx = ev.clientX - gesto.sx, dy = ev.clientY - gesto.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) gesto.movido = true;
      view.x = gesto.vx + dx;
      view.y = gesto.vy + dy;
      dibujar();
    } else if (gesto.tipo === 'mover') {
      const n = nodo(gesto.id);
      const dx = p.x - gesto.inicio.x, dy = p.y - gesto.inicio.y;
      if (!gesto.movido && Math.hypot(dx, dy) * view.k < 4) return;
      gesto.movido = true;
      // El elemento principal se ajusta a la grilla y los de adentro se mueven exactamente lo mismo.
      const mx = ajustar(gesto.orig.x + dx) - gesto.orig.x, my = ajustar(gesto.orig.y + dy) - gesto.orig.y;
      for (const a of gesto.arrastrados) {
        const m = nodo(a.id);
        if (m) { m.x = a.x + mx; m.y = a.y + my; }
      }
      dibujar();
    } else if (gesto.tipo === 'redimensionar') {
      const n = nodo(gesto.id);
      n.w = Math.max(40, ajustar(gesto.orig.w + p.x - gesto.inicio.x));
      n.h = Math.max(30, ajustar(gesto.orig.h + p.y - gesto.inicio.y));
      dibujar();
    } else if (gesto.tipo === 'conectar') {
      gesto.p = p;
      dibujar();
    }
  });

  function finPuntero(ev) {
    if (!punteros.has(ev.pointerId)) return;
    punteros.delete(ev.pointerId);
    svg.classList.remove('arrastrando');
    if (!gesto) return;
    if (gesto.tipo === 'pellizco') { if (punteros.size === 0) gesto = null; return; }

    if (gesto.tipo === 'desplazar' && !gesto.movido && ev.type === 'pointerup') {
      seleccionar(null);
    } else if (gesto.tipo === 'mover' && gesto.movido) {
      confirmarCambio();
    } else if (gesto.tipo === 'mover') {
      asegurarVisible(gesto.id);
    } else if (gesto.tipo === 'redimensionar') {
      confirmarCambio();
    } else if (gesto.tipo === 'conectar' && ev.type === 'pointerup') {
      const destino = nodoEn(ev.clientX, ev.clientY, gesto.desde);
      if (destino) {
        const e = { id: uid('e'), from: gesto.desde, to: destino, label: '', style: 'solid', arrow: 'end', color: '#ffffff' };
        doc.edges.push(e);
        confirmarCambio();
        gesto = null;
        seleccionar({ kind: 'edge', id: e.id });
        avisar('Flecha creada');
      } else {
        avisar('Suelta el + sobre otro elemento para conectarlos');
      }
    }
    gesto = null;
    dibujar();
  }
  svg.addEventListener('pointerup', finPuntero);
  svg.addEventListener('pointercancel', finPuntero);

  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = svg.getBoundingClientRect();
    if (ev.ctrlKey || Math.abs(ev.deltaY) >= Math.abs(ev.deltaX)) {
      zoomEn(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)));
    } else {
      view.x -= ev.deltaX;
    }
    dibujar();
  }, { passive: false });

  // Al girar el celular (cambia el ancho) se vuelve a encuadrar el diagrama;
  // si solo cambia el alto (por ejemplo, al abrir el teclado) se redibuja.
  let anchoPrevio = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - anchoPrevio) > 40) { anchoPrevio = window.innerWidth; verTodo(); }
    else dibujar();
  });

  // ---------- Panel de propiedades ----------
  function muestras(id, lista, actual, conSelector) {
    const botones = lista.map((c) => `<button type="button" class="muestra${c === 'none' ? ' nada' : ''}${c === actual ? ' activa' : ''}" data-grupo="${id}" data-color="${c}" title="${c === 'none' ? 'Sin relleno' : c}" ${c === 'none' ? '' : `style="background:${c}"`}></button>`).join('');
    const selector = conSelector ? `<input type="color" id="${id}-libre" value="${/^#[0-9a-f]{6}$/i.test(actual) ? actual : '#ffffff'}" title="Otro color">` : '';
    return `<div class="muestras">${botones}${selector}</div>`;
  }

  // Vista previa de un fondo de la galería, con CSS.
  function estiloMiniatura(f) {
    const claro = (f.type === 'solid' ? luminancia(f.c1) : (luminancia(f.c1) + luminancia(f.c2)) / 2) > 0.45;
    const capas = [];
    const lineas = claro ? 'rgba(143,179,224,.7)' : 'rgba(255,255,255,.25)';
    if (f.pattern === 'grid') capas.push(`linear-gradient(${lineas} 1px, transparent 1px)`, `linear-gradient(90deg, ${lineas} 1px, transparent 1px)`);
    if (f.pattern === 'dots') capas.push(`radial-gradient(${lineas} 1px, transparent 1.5px)`);
    if (f.stars) capas.push('radial-gradient(#cfe6ff 1px, transparent 1.5px)');
    capas.push(f.type === 'solid' ? `linear-gradient(${f.c1}, ${f.c1})` : `radial-gradient(circle at 50% 45%, ${f.c1}, ${f.c2})`);
    const tam = capas.map((c) => (c.includes('1px, transparent 1px') ? '10px 10px' : c.includes('1.5px') ? (f.stars && c.includes('#cfe6ff') ? '13px 11px' : '8px 8px') : '100% 100%')).join(', ');
    return `background-image:${capas.join(', ')};background-size:${tam}`;
  }

  function dibujarPanel() {
    $('#pista').hidden = !!sel;
    if (!sel) { panel.hidden = true; panel.innerHTML = ''; requestAnimationFrame(dibujar); return; }
    panel.hidden = false;
    let h = '';
    if (sel.kind === 'node') {
      const n = nodo(sel.id);
      if (!n) { sel = null; return dibujarPanel(); }
      const nombreTipo = { box: 'Forma', text: 'Texto', group: 'Grupo' }[n.type];
      const opciones = (lista, actual) => Object.entries(lista).map(([k, v]) => `<option value="${k}" ${k === actual ? 'selected' : ''}>${typeof v === 'string' ? v : v.nombre}</option>`).join('');
      let formaYBorde = '';
      if (n.type === 'box') formaYBorde += `<div class="campo" style="flex:1"><label for="p-forma">Forma</label><select id="p-forma">${opciones(FORMAS, n.shape)}</select></div>`;
      if (n.type !== 'text') formaYBorde += `<div class="campo" style="flex:1"><label for="p-borde">Borde</label><select id="p-borde">${opciones(BORDES, n.border)}</select></div>`;
      h += `<h2>${nombreTipo}<button class="cerrar" id="p-cerrar" title="Cerrar">×</button></h2>
        <div class="campo"><label for="p-titulo">Título</label><input type="text" id="p-titulo" value="${esc(n.title)}"></div>`;
      if (formaYBorde) h += `<div class="fila">${formaYBorde}</div>`;
      if (n.type !== 'group') h += `<div class="campo"><label for="p-sub">Subtítulo (Enter = nueva línea)</label><textarea id="p-sub" rows="2">${esc(n.subtitle)}</textarea></div>`;
      h += `<div class="campo"><span>${n.type === 'box' ? 'Color del borde y título' : 'Color'}</span>${muestras('p-color', COLORES, n.color, true)}</div>`;
      if (n.type === 'box') h += `<div class="campo"><span>Relleno</span>${muestras('p-relleno', RELLENOS, n.fill, true)}</div>`;
      h += `<div class="campo"><label for="p-tam">Tamaño del título: <b id="p-tam-v">${n.titleSize}</b></label><input type="range" id="p-tam" min="12" max="80" value="${n.titleSize}"></div>`;
      if (n.type !== 'group') h += `<div class="campo"><label for="p-tamsub">Tamaño del subtítulo: <b id="p-tamsub-v">${n.subSize}</b></label><input type="range" id="p-tamsub" min="10" max="40" value="${n.subSize}"></div>`;
      h += `<div class="fila">
          <label class="check"><input type="checkbox" id="p-brillo" ${n.glow ? 'checked' : ''}> Brillo</label>
          <div class="campo" style="flex:1;min-width:120px"><select id="p-tipo" aria-label="Tipo">
            <option value="box" ${n.type === 'box' ? 'selected' : ''}>Forma</option>
            <option value="text" ${n.type === 'text' ? 'selected' : ''}>Texto</option>
            <option value="group" ${n.type === 'group' ? 'selected' : ''}>Grupo</option>
          </select></div>
        </div>
        <div class="botones">
          <button class="btn-sec" id="p-duplicar">Duplicar</button>
          <button class="btn-sec" id="p-frente">Al frente</button>
          <button class="btn-sec" id="p-fondo">Al fondo</button>
          <button class="btn-peligro" id="p-eliminar">Eliminar</button>
        </div>`;
    } else if (sel.kind === 'edge') {
      const e = arista(sel.id);
      if (!e) { sel = null; return dibujarPanel(); }
      h += `<h2>Flecha<button class="cerrar" id="p-cerrar" title="Cerrar">×</button></h2>
        <div class="campo"><label for="p-etiqueta">Etiqueta</label><input type="text" id="p-etiqueta" value="${esc(e.label)}" placeholder="por ejemplo: escribe"></div>
        <div class="fila">
          <div class="campo" style="flex:1"><label for="p-linea">Línea</label><select id="p-linea">
            <option value="solid" ${e.style === 'solid' ? 'selected' : ''}>Continua</option>
            <option value="dashed" ${e.style === 'dashed' ? 'selected' : ''}>Rayas</option>
            <option value="dotted" ${e.style === 'dotted' ? 'selected' : ''}>Puntos</option></select></div>
          <div class="campo" style="flex:1"><label for="p-puntas">Puntas</label><select id="p-puntas">
            <option value="end" ${e.arrow === 'end' ? 'selected' : ''}>Al final →</option>
            <option value="start" ${e.arrow === 'start' ? 'selected' : ''}>Al inicio ←</option>
            <option value="both" ${e.arrow === 'both' ? 'selected' : ''}>Ambas ↔</option>
            <option value="none" ${e.arrow === 'none' ? 'selected' : ''}>Ninguna</option></select></div>
        </div>
        <div class="campo"><span>Color</span>${muestras('p-color', COLORES, e.color, true)}</div>
        <div class="botones">
          <button class="btn-sec" id="p-invertir">Invertir sentido</button>
          <button class="btn-peligro" id="p-eliminar">Eliminar</button>
        </div>`;
    } else if (sel.kind === 'doc') {
      const bg = doc.bg;
      const esActual = (f) => f.type === bg.type && f.c1 === bg.c1 && (f.type === 'solid' || f.c2 === bg.c2) && f.pattern === bg.pattern && f.stars === bg.stars;
      const galeria = Object.entries(FONDOS).map(([k, f]) => `<button type="button" class="fondo-op${esActual(f) ? ' activa' : ''}" data-fondo="${k}">
          <span class="mini" style="${estiloMiniatura(f)}"></span>${f.nombre}</button>`).join('');
      const listaColores = ['#1d4f96', '#4a2a8a', '#2f5a46', '#16457f', '#0b0d12', '#ffffff', '#e9edf3', '#fdf6e3'];
      h += `<h2>Fondo<button class="cerrar" id="p-cerrar" title="Cerrar">×</button></h2>
        <div class="fondos">${galeria}</div>
        <div class="fila">
          <div class="campo" style="flex:1"><label for="p-tipofondo">Tipo</label><select id="p-tipofondo">
            <option value="gradient" ${bg.type === 'gradient' ? 'selected' : ''}>Degradado</option>
            <option value="solid" ${bg.type === 'solid' ? 'selected' : ''}>Color liso</option></select></div>
          <div class="campo" style="flex:1"><label for="p-textura">Textura</label><select id="p-textura">
            ${Object.entries(TEXTURAS).map(([k, v]) => `<option value="${k}" ${bg.pattern === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <div class="campo"><span>${bg.type === 'solid' ? 'Color' : 'Color del centro'}</span>${muestras('p-c1', listaColores, bg.c1, true)}</div>
        ${bg.type === 'gradient' ? `<div class="campo"><span>Color de los bordes</span>${muestras('p-c2', ['#0a2350', '#120a2e', '#142a22', '#06141f', '#000000', '#c9d3e3', '#ffffff', '#efe4c6'], bg.c2, true)}</div>` : ''}
        <label class="check"><input type="checkbox" id="p-estrellas" ${bg.stars ? 'checked' : ''}> Estrellas</label>
        <div class="campo"><label for="p-nombre">Nombre del diagrama</label><input type="text" id="p-nombre" value="${esc(doc.name)}"></div>`;
    }
    panel.innerHTML = h;
    conectarPanel();
    requestAnimationFrame(dibujar);
  }

  function conectarPanel() {
    const on = (id, evento, fn) => { const el = $('#' + id); if (el) el.addEventListener(evento, fn); };
    const objetivo = () => (sel.kind === 'node' ? nodo(sel.id) : sel.kind === 'edge' ? arista(sel.id) : doc);
    const enVivo = (id, aplicar) => {
      on(id, 'input', (ev) => { aplicar(objetivo(), ev.target); dibujar(); });
      on(id, 'change', () => confirmarCambio());
    };

    on('p-cerrar', 'click', () => { seleccionar(null); dibujar(); });
    enVivo('p-titulo', (o, el) => { o.title = el.value; });
    enVivo('p-sub', (o, el) => { o.subtitle = el.value; });
    enVivo('p-tam', (o, el) => { o.titleSize = +el.value; $('#p-tam-v').textContent = el.value; });
    enVivo('p-tamsub', (o, el) => { o.subSize = +el.value; $('#p-tamsub-v').textContent = el.value; });
    enVivo('p-etiqueta', (o, el) => { o.label = el.value; });
    enVivo('p-nombre', (o, el) => { o.name = el.value; $('#nombre-doc').textContent = el.value; });
    on('p-brillo', 'change', (ev) => { objetivo().glow = ev.target.checked; confirmarCambio(); dibujar(); });
    on('p-estrellas', 'change', (ev) => { doc.bg.stars = ev.target.checked; confirmarCambio(); dibujar(); dibujarPanel(); });
    on('p-tipofondo', 'change', (ev) => { cambiarFondo((bg) => { bg.type = ev.target.value; }); confirmarCambio(); dibujar(); dibujarPanel(); });
    on('p-textura', 'change', (ev) => { doc.bg.pattern = ev.target.value; confirmarCambio(); dibujar(); dibujarPanel(); });
    panel.querySelectorAll('[data-fondo]').forEach((b) => b.addEventListener('click', () => {
      const f = FONDOS[b.dataset.fondo];
      cambiarFondo((bg) => Object.assign(bg, { type: f.type, c1: f.c1, c2: f.c2, stars: f.stars, pattern: f.pattern }));
      confirmarCambio(); dibujar(); dibujarPanel();
    }));
    on('p-linea', 'change', (ev) => { objetivo().style = ev.target.value; confirmarCambio(); dibujar(); });
    on('p-forma', 'change', (ev) => { objetivo().shape = ev.target.value; confirmarCambio(); dibujar(); });
    on('p-borde', 'change', (ev) => { objetivo().border = ev.target.value; confirmarCambio(); dibujar(); });
    on('p-puntas', 'change', (ev) => { objetivo().arrow = ev.target.value; confirmarCambio(); dibujar(); });
    on('p-tipo', 'change', (ev) => {
      const n = objetivo();
      n.type = ev.target.value;
      if (n.type === 'box' && (!n.fill || n.fill === 'none')) n.fill = '#1f78c8';
      if (n.type === 'group') { doc.nodes = doc.nodes.filter((x) => x !== n); doc.nodes.unshift(n); if (n.border === 'solid') n.border = 'dashed'; }
      confirmarCambio(); dibujar(); dibujarPanel();
    });
    on('p-duplicar', 'click', duplicarSeleccion);
    on('p-frente', 'click', () => moverOrden(true));
    on('p-fondo', 'click', () => moverOrden(false));
    on('p-eliminar', 'click', eliminarSeleccion);
    on('p-invertir', 'click', () => { const e = objetivo(); [e.from, e.to] = [e.to, e.from]; confirmarCambio(); dibujar(); });

    const campoColor = { 'p-color': 'color', 'p-relleno': 'fill', 'p-c1': 'c1', 'p-c2': 'c2' };
    const aplicarColor = (grupo, c) => {
      if (grupo === 'p-c1' || grupo === 'p-c2') cambiarFondo((bg) => { bg[campoColor[grupo]] = c; });
      else objetivo()[campoColor[grupo]] = c;
      panel.querySelectorAll(`.muestra[data-grupo="${grupo}"]`).forEach((b) => b.classList.toggle('activa', b.dataset.color === c));
      dibujar();
    };
    panel.querySelectorAll('.muestra').forEach((b) => b.addEventListener('click', () => { aplicarColor(b.dataset.grupo, b.dataset.color); confirmarCambio(); }));
    for (const g of Object.keys(campoColor)) {
      on(g + '-libre', 'input', (ev) => aplicarColor(g, ev.target.value));
      on(g + '-libre', 'change', () => confirmarCambio());
    }
  }

  // ---------- Exportar, guardar y abrir ----------
  function nombreArchivo() {
    return (doc.name || 'diagrama').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'diagrama';
  }
  // `transparente`: sin color, textura ni estrellas de fondo (solo los elementos).
  function svgExportable(transparente = false) {
    const b = limites();
    const m = 50;
    const x = b.x - m, y = b.y - m, w = b.w + m * 2, h = b.h + m * 2;
    return {
      w, h,
      texto: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">${defs(true)}` +
        (transparente ? '' : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colorFondo()}"/>` + capasFondo(x, y, w, h)) +
        contenido(true) + '</svg>'
    };
  }
  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  // Dibuja el diagrama en un lienzo y lo convierte al tipo de imagen pedido (PNG, JPG o WebP).
  function generarImagen(tipo = 'image/png', calidad, transparente = false) {
    return new Promise((resolver, rechazar) => {
      const { w, h, texto } = svgExportable(transparente);
      const escala = Math.min(3, Math.max(1, 3000 / Math.max(w, h)));
      const img = new Image();
      const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(w * escala);
        c.height = Math.round(h * escala);
        const ctx = c.getContext('2d');
        if (!transparente) { // fondo sólido por si el formato no admite transparencia
          ctx.fillStyle = colorBase();
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolver({ blob: b, ancho: c.width, alto: c.height, w, h }) : rechazar(new Error('sin imagen'))), tipo, calidad);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('no se pudo dibujar')); };
      img.src = url;
    });
  }

  // PDF de una página con la imagen JPG adentro, armado a mano (sin librerías, funciona sin internet).
  function crearPDF(jpg, ancho, alto, pw, ph) {
    const enc = new TextEncoder();
    const partes = [];
    const pos = [];
    let largo = 0;
    const agregar = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); largo += b.length; };
    const objeto = (num, cuerpo) => { pos[num] = largo; agregar(`${num} 0 obj\n${cuerpo}\nendobj\n`); };
    agregar('%PDF-1.4\n');
    objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objeto(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objeto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    pos[4] = largo;
    agregar(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    agregar(jpg);
    agregar('\nendstream\nendobj\n');
    const dibujo = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    objeto(5, `<< /Length ${dibujo.length} >>\nstream\n${dibujo}\nendstream`);
    const inicioXref = largo;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let k = 1; k <= 5; k++) xref += String(pos[k]).padStart(10, '0') + ' 00000 n \n';
    agregar(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);
    return new Blob(partes, { type: 'application/pdf' });
  }

  const FORMATOS = {
    png: { tipo: 'image/png', nombre: 'PNG' },
    jpg: { tipo: 'image/jpeg', calidad: 0.92, nombre: 'JPG' },
    webp: { tipo: 'image/webp', calidad: 0.92, nombre: 'WebP' }
  };
  async function exportar(formato) {
    const transparente = $('#exp-transparente').checked && ['png', 'webp', 'svg'].includes(formato);
    try {
      if (formato === 'svg') return exportarSVG(transparente);
      if (formato === 'compartir') return compartir();
      if (formato === 'pdf') {
        const r = await generarImagen('image/jpeg', 0.92);
        const jpg = new Uint8Array(await r.blob.arrayBuffer());
        // Tamaño de página en puntos (1 px de pantalla = 0,75 pt).
        descargar(crearPDF(jpg, r.ancho, r.alto, +(r.w * 0.75).toFixed(2), +(r.h * 0.75).toFixed(2)), nombreArchivo() + '.pdf');
        return avisar('PDF exportado');
      }
      const f = FORMATOS[formato];
      const r = await generarImagen(f.tipo, f.calidad, transparente);
      descargar(r.blob, `${nombreArchivo()}.${formato}`);
      avisar(`Imagen ${f.nombre} exportada`);
    } catch (_) {
      avisar('No se pudo exportar; prueba con otro formato');
    }
  }
  function exportarSVG(transparente) {
    descargar(new Blob([svgExportable(transparente).texto], { type: 'image/svg+xml' }), nombreArchivo() + '.svg');
    avisar('Imagen SVG exportada');
  }
  async function compartir() {
    try {
      const archivo = new File([(await generarImagen('image/png')).blob], nombreArchivo() + '.png', { type: 'image/png' });
      await navigator.share({ files: [archivo], title: doc.name });
    } catch (err) {
      if (err && err.name !== 'AbortError') avisar('No se pudo compartir; usa Exportar');
    }
  }
  function guardarArchivo() {
    descargar(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), nombreArchivo() + '.diagrama.json');
    avisar('Archivo guardado');
  }
  $('#archivo').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.nodes)) throw new Error('formato');
      cargarDoc(d, { reiniciarHistorial: false });
      avisar('Diagrama abierto');
    } catch (_) {
      avisar('Ese archivo no es un diagrama de esta app');
    }
  });

  // ---------- Menú, avisos y confirmaciones ----------
  const menu = $('#menu');
  function cerrarMenu() { menu.hidden = true; }
  $('#b-menu').addEventListener('click', (ev) => { ev.stopPropagation(); cerrarFormas(); menu.hidden = !menu.hidden; });
  document.addEventListener('pointerdown', (ev) => { if (!menu.hidden && !menu.contains(ev.target) && !$('#b-menu').contains(ev.target)) cerrarMenu(); });
  try {
    if (navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })) $('#f-compartir').hidden = false;
  } catch (_) { /* sin compartir */ }
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    if (c.toDataURL('image/webp').startsWith('data:image/webp')) $('#f-webp').hidden = false;
  } catch (_) { /* sin WebP */ }

  // Cuadro de exportación
  const cuadroExportar = $('#exportar');
  function abrirExportar() { cerrarMenu(); cerrarFormas(); cuadroExportar.hidden = false; }
  $('#exportar-cerrar').addEventListener('click', () => { cuadroExportar.hidden = true; });
  // La casilla "Fondo transparente" se recuerda en este dispositivo.
  const CLAVE_TRANSPARENTE = 'opengravity.exportar.transparente';
  try { $('#exp-transparente').checked = localStorage.getItem(CLAVE_TRANSPARENTE) === '1'; } catch (_) { /* sin almacenamiento */ }
  $('#exp-transparente').addEventListener('change', (ev) => {
    try { localStorage.setItem(CLAVE_TRANSPARENTE, ev.target.checked ? '1' : '0'); } catch (_) { /* sin almacenamiento */ }
  });
  cuadroExportar.addEventListener('click', (ev) => {
    if (ev.target === cuadroExportar) { cuadroExportar.hidden = true; return; }
    const b = ev.target.closest('[data-formato]');
    if (!b) return;
    cuadroExportar.hidden = true;
    exportar(b.dataset.formato);
  });

  // Selector de formas
  const selectorFormas = $('#formas');
  selectorFormas.innerHTML = Object.entries(FORMAS).map(([k, f]) =>
    `<button type="button" role="menuitem" data-forma="${k}"><svg viewBox="0 0 40 32">${figura(k, 3, 3, 34, 26, '')}</svg>${f.nombre}</button>`).join('');
  function cerrarFormas() { selectorFormas.hidden = true; }
  $('#b-forma').addEventListener('click', (ev) => { ev.stopPropagation(); cerrarMenu(); selectorFormas.hidden = !selectorFormas.hidden; });
  selectorFormas.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-forma]');
    if (!b) return;
    cerrarFormas();
    agregarNodo('box', b.dataset.forma);
  });
  document.addEventListener('pointerdown', (ev) => {
    if (!selectorFormas.hidden && !selectorFormas.contains(ev.target) && !$('#b-forma').contains(ev.target)) cerrarFormas();
  });

  function preguntar(texto) {
    return new Promise((resolver) => {
      const m = $('#modal');
      $('#modal-texto').textContent = texto;
      m.hidden = false;
      const fin = (v) => { m.hidden = true; $('#modal-si').onclick = $('#modal-no').onclick = null; resolver(v); };
      $('#modal-si').onclick = () => fin(true);
      $('#modal-no').onclick = () => fin(false);
    });
  }
  let temporizador = 0;
  function avisar(texto) {
    const a = $('#aviso');
    a.textContent = texto;
    a.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => a.classList.remove('visible'), 2200);
  }

  menu.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    cerrarMenu();
    const accion = b.dataset.accion;
    if (accion === 'nuevo' || accion === 'plantilla') {
      const ok = await preguntar('Se reemplazará el diagrama actual. Puedes volver atrás con Deshacer. ¿Continuar?');
      if (ok) cargarDoc(copia(window.PLANTILLAS[accion === 'nuevo' ? 'blanco' : 'arnes']), { reiniciarHistorial: false });
    } else if (accion === 'abrir') $('#archivo').click();
    else if (accion === 'guardar') guardarArchivo();
    else if (accion === 'exportar') abrirExportar();
    else if (accion === 'fondo') { seleccionar({ kind: 'doc' }); dibujar(); }
  });

  $('#b-texto').addEventListener('click', () => agregarNodo('text'));
  $('#b-fondo').addEventListener('click', () => {
    cerrarMenu(); cerrarFormas(); seleccionar({ kind: 'doc' });
    // En el celular vertical el panel tapa la mitad de abajo: encuadrar el diagrama arriba.
    if (window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches) verTodo(0.5); else dibujar();
  });
  $('#b-grupo').addEventListener('click', () => agregarNodo('group'));
  $('#b-deshacer').addEventListener('click', deshacer);
  $('#b-rehacer').addEventListener('click', rehacer);
  $('#b-ajustar').addEventListener('click', () => verTodo());
  $('#b-exportar').addEventListener('click', abrirExportar);

  // ---------- Teclado (Windows) ----------
  document.addEventListener('keydown', (ev) => {
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 'z' && !ev.shiftKey && !escribiendo) { ev.preventDefault(); deshacer(); }
    else if (ctrl && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey)) && !escribiendo) { ev.preventDefault(); rehacer(); }
    else if (ctrl && ev.key.toLowerCase() === 's') { ev.preventDefault(); guardarArchivo(); }
    else if (ctrl && ev.key.toLowerCase() === 'd' && !escribiendo) { ev.preventDefault(); duplicarSeleccion(); }
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !escribiendo) { ev.preventDefault(); eliminarSeleccion(); }
    else if (ev.key === 'Escape') { if (escribiendo) document.activeElement.blur(); cerrarMenu(); cerrarFormas(); cuadroExportar.hidden = true; seleccionar(null); dibujar(); }
    else if (!escribiendo && sel && sel.kind === 'node' && ev.key.startsWith('Arrow')) {
      ev.preventDefault();
      const n = nodo(sel.id), paso = ev.shiftKey ? GRILLA * 5 : GRILLA;
      const dx = ev.key === 'ArrowLeft' ? -paso : ev.key === 'ArrowRight' ? paso : 0;
      const dy = ev.key === 'ArrowUp' ? -paso : ev.key === 'ArrowDown' ? paso : 0;
      for (const m of [n, ...contenidoDeGrupo(n)]) { m.x += dx; m.y += dy; }
      confirmarCambio();
      dibujar();
    }
  });

  // ---------- Inicio ----------
  doc = normalizar(leerLocal() || copia(window.PLANTILLAS.arnes));
  presente = JSON.stringify(doc);
  actualizarBotones();
  requestAnimationFrame(() => { verTodo(); dibujarPanel(); });

  // App instalable y sin conexión (solo funciona en https o localhost).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ }); });
  }

  // Para pruebas automáticas.
  window.__diagramas = { get doc() { return doc; }, view, verTodo, cargarDoc };
})();
