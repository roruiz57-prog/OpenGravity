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
    out.bg = Object.assign({ c1: '#1d4f96', c2: '#0a2350', stars: true }, out.bg || {});
    out.nodes = (Array.isArray(out.nodes) ? out.nodes : []).map((n) => Object.assign({
      type: 'text', x: 0, y: 0, w: 200, h: 80, title: '', subtitle: '', color: '#ffffff',
      fill: '#1f78c8', titleSize: 28, subSize: 16, glow: true
    }, n, { id: n.id || uid('n') }));
    out.edges = (Array.isArray(out.edges) ? out.edges : []).map((e) => Object.assign({
      label: '', dashed: false, arrow: 'end', color: '#ffffff'
    }, e, { id: e.id || uid('e') }));
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
    let ini = salidaRect(a, sa, d);
    let fin = salidaRect(b, sb, { x: -d.x, y: -d.y });
    ini = { x: ini.x + d.x * hueco, y: ini.y + d.y * hueco };
    fin = { x: fin.x - d.x * hueco, y: fin.y - d.y * hueco };
    return { ini, fin, d, perp, o };
  }

  // ---------- Dibujo ----------
  function defs(paraExportar) {
    const estrellas = [];
    let semilla = 7;
    const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      estrellas.push(`<circle cx="${(azar() * 400).toFixed(1)}" cy="${(azar() * 400).toFixed(1)}" r="${(0.6 + azar() * 1.3).toFixed(2)}" fill="#cfe6ff" opacity="${(0.25 + azar() * 0.5).toFixed(2)}"/>`);
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
        <stop offset="0" stop-color="${esc(doc.bg.c1)}"/><stop offset="1" stop-color="${esc(doc.bg.c2)}"/>
      </radialGradient>
      <pattern id="estrellas" width="400" height="400" patternUnits="userSpaceOnUse">${estrellas.join('')}</pattern>
      ${paraExportar ? '' : `<pattern id="puntos" width="${GRILLA * 4}" height="${GRILLA * 4}" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ffffff" opacity=".07"/></pattern>`}
    </defs>`;
  }

  function lineasTexto(n) {
    const out = [];
    const tit = n.title ? String(n.title).split('\n') : [];
    const sub = n.type !== 'group' && n.subtitle ? String(n.subtitle).split('\n') : [];
    const altT = n.titleSize * 1.12, altS = n.subSize * 1.4, sep = tit.length && sub.length ? 8 : 0;
    const total = tit.length * altT + sub.length * altS + sep;
    let y = n.y + n.h / 2 - total / 2;
    const cx = n.x + n.w / 2;
    const fil = n.glow ? ' filter="url(#brillo)"' : '';
    for (const t of tit) {
      out.push(`<text x="${cx}" y="${y + altT * 0.82}" text-anchor="middle" font-family="${FUENTE_TITULO}" font-weight="900" font-size="${n.titleSize}" fill="${esc(n.color)}"${fil}>${esc(t)}</text>`);
      y += altT;
    }
    y += sep;
    const colorSub = n.type === 'box' ? '#e9f3ff' : '#f2f6ff';
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
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="4" fill="none" stroke="${esc(n.color)}" stroke-width="3" stroke-dasharray="12 9"${fil}/>
        ${n.title ? `<text x="${n.x - 4}" y="${n.y - 12}" font-family="${FUENTE_TITULO}" font-weight="900" font-size="${n.titleSize}" fill="${esc(n.color)}"${n.glow ? ' filter="url(#brillo)"' : ''}${datos}>${esc(n.title)}</text>` : ''}
        ${paraExportar ? '' : `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="none" stroke="transparent" stroke-width="22" pointer-events="stroke"${datos}/>`}
      </g>`;
    }
    let forma = '';
    if (n.type === 'box') {
      const fil = n.glow ? ' filter="url(#brillo-suave)"' : '';
      const relleno = n.fill === 'none' ? 'none' : esc(n.fill);
      forma = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" fill="${relleno}" stroke="${esc(n.color)}" stroke-width="3"${fil}/>`;
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
    const guion = e.dashed ? ' stroke-dasharray="10 8"' : '';
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
      etiqueta = `<text x="${lx}" y="${ly}" text-anchor="${ancla}" font-family="${FUENTE_MONO}" font-weight="700" font-size="15" fill="#f2f6ff" stroke="${esc(doc.bg.c2)}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(e.label)}</text>`;
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
        s += `<rect x="${n.x - pad}" y="${n.y - pad}" width="${n.w + pad * 2}" height="${n.h + pad * 2}" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="${1.5 / k}" stroke-dasharray="${6 / k} ${4 / k}" pointer-events="none"/>`;
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

  function dibujar() {
    const W = svg.clientWidth || 800, H = svg.clientHeight || 600;
    const x0 = -view.x / view.k, y0 = -view.y / view.k, ancho = W / view.k, alto = H / view.k;
    svg.innerHTML = defs(false) +
      `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#degradado)"/>` +
      `<g transform="translate(${view.x} ${view.y}) scale(${view.k})">` +
      (doc.bg.stars ? `<rect x="${x0}" y="${y0}" width="${ancho}" height="${alto}" fill="url(#estrellas)" pointer-events="none"/>` : '') +
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
  function verTodo() {
    const b = limites();
    const W = svg.clientWidth || 800, H = svg.clientHeight || 600;
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
  function agregarNodo(tipo) {
    const c = centroVista();
    const n = { id: uid('n'), type: tipo, title: '', subtitle: '', glow: true, subSize: 16 };
    if (tipo === 'box') Object.assign(n, { w: 220, h: 110, title: 'NUEVO', subtitle: 'descripción', color: '#e6f7ff', fill: '#1f78c8', titleSize: 34 });
    if (tipo === 'text') Object.assign(n, { w: 280, h: 80, title: 'TÍTULO', subtitle: 'detalle · detalle', color: '#7fe3ff', fill: 'none', titleSize: 30 });
    if (tipo === 'group') Object.assign(n, { w: 460, h: 300, title: 'GRUPO', color: '#ffb454', fill: 'none', titleSize: 26 });
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
      gesto = { tipo: 'mover', id: idNodo, inicio: p, orig: { x: n.x, y: n.y }, movido: false };
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
      n.x = ajustar(gesto.orig.x + dx);
      n.y = ajustar(gesto.orig.y + dy);
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
        const e = { id: uid('e'), from: gesto.desde, to: destino, label: '', dashed: false, arrow: 'end', color: '#ffffff' };
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

  function dibujarPanel() {
    $('#pista').hidden = !!sel;
    if (!sel) { panel.hidden = true; panel.innerHTML = ''; requestAnimationFrame(dibujar); return; }
    panel.hidden = false;
    let h = '';
    if (sel.kind === 'node') {
      const n = nodo(sel.id);
      if (!n) { sel = null; return dibujarPanel(); }
      const nombreTipo = { box: 'Caja', text: 'Texto', group: 'Grupo' }[n.type];
      h += `<h2>${nombreTipo}<button class="cerrar" id="p-cerrar" title="Cerrar">×</button></h2>
        <div class="campo"><label for="p-titulo">Título</label><input type="text" id="p-titulo" value="${esc(n.title)}"></div>`;
      if (n.type !== 'group') h += `<div class="campo"><label for="p-sub">Subtítulo (Enter = nueva línea)</label><textarea id="p-sub" rows="2">${esc(n.subtitle)}</textarea></div>`;
      h += `<div class="campo"><span>${n.type === 'box' ? 'Color del borde y título' : 'Color'}</span>${muestras('p-color', COLORES, n.color, true)}</div>`;
      if (n.type === 'box') h += `<div class="campo"><span>Relleno</span>${muestras('p-relleno', RELLENOS, n.fill, true)}</div>`;
      h += `<div class="campo"><label for="p-tam">Tamaño del título: <b id="p-tam-v">${n.titleSize}</b></label><input type="range" id="p-tam" min="12" max="80" value="${n.titleSize}"></div>`;
      if (n.type !== 'group') h += `<div class="campo"><label for="p-tamsub">Tamaño del subtítulo: <b id="p-tamsub-v">${n.subSize}</b></label><input type="range" id="p-tamsub" min="10" max="40" value="${n.subSize}"></div>`;
      h += `<div class="fila">
          <label class="check"><input type="checkbox" id="p-brillo" ${n.glow ? 'checked' : ''}> Brillo</label>
          <div class="campo" style="flex:1;min-width:120px"><select id="p-tipo" aria-label="Tipo">
            <option value="box" ${n.type === 'box' ? 'selected' : ''}>Caja</option>
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
            <option value="0" ${!e.dashed ? 'selected' : ''}>Continua</option>
            <option value="1" ${e.dashed ? 'selected' : ''}>Punteada</option></select></div>
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
      h += `<h2>Diagrama<button class="cerrar" id="p-cerrar" title="Cerrar">×</button></h2>
        <div class="campo"><label for="p-nombre">Nombre</label><input type="text" id="p-nombre" value="${esc(doc.name)}"></div>
        <div class="campo"><span>Fondo: color del centro</span>${muestras('p-c1', ['#1d4f96', '#2a2f6b', '#14324a', '#3a1d4f', '#1b1b1b', '#e9eef6'], doc.bg.c1, true)}</div>
        <div class="campo"><span>Fondo: color de los bordes</span>${muestras('p-c2', ['#0a2350', '#11143a', '#06141f', '#170a24', '#000000', '#c9d3e3'], doc.bg.c2, true)}</div>
        <label class="check"><input type="checkbox" id="p-estrellas" ${doc.bg.stars ? 'checked' : ''}> Estrellas en el fondo</label>`;
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
    on('p-estrellas', 'change', (ev) => { doc.bg.stars = ev.target.checked; confirmarCambio(); dibujar(); });
    on('p-linea', 'change', (ev) => { objetivo().dashed = ev.target.value === '1'; confirmarCambio(); dibujar(); });
    on('p-puntas', 'change', (ev) => { objetivo().arrow = ev.target.value; confirmarCambio(); dibujar(); });
    on('p-tipo', 'change', (ev) => {
      const n = objetivo();
      n.type = ev.target.value;
      if (n.type === 'box' && (!n.fill || n.fill === 'none')) n.fill = '#1f78c8';
      if (n.type === 'group') { doc.nodes = doc.nodes.filter((x) => x !== n); doc.nodes.unshift(n); }
      confirmarCambio(); dibujar(); dibujarPanel();
    });
    on('p-duplicar', 'click', duplicarSeleccion);
    on('p-frente', 'click', () => moverOrden(true));
    on('p-fondo', 'click', () => moverOrden(false));
    on('p-eliminar', 'click', eliminarSeleccion);
    on('p-invertir', 'click', () => { const e = objetivo(); [e.from, e.to] = [e.to, e.from]; confirmarCambio(); dibujar(); });

    const campoColor = { 'p-color': 'color', 'p-relleno': 'fill', 'p-c1': 'c1', 'p-c2': 'c2' };
    const aplicarColor = (grupo, c) => {
      const o = grupo === 'p-c1' || grupo === 'p-c2' ? doc.bg : objetivo();
      o[campoColor[grupo]] = c;
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
  function svgExportable() {
    const b = limites();
    const m = 50;
    const x = b.x - m, y = b.y - m, w = b.w + m * 2, h = b.h + m * 2;
    return {
      w, h,
      texto: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">${defs(true)}` +
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#degradado)"/>` +
        (doc.bg.stars ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#estrellas)"/>` : '') +
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
  function generarPNG() {
    return new Promise((resolver, rechazar) => {
      const { w, h, texto } = svgExportable();
      const escala = Math.min(3, Math.max(1, 3000 / Math.max(w, h)));
      const img = new Image();
      const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(w * escala);
        c.height = Math.round(h * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolver(b) : rechazar(new Error('sin imagen'))), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('no se pudo dibujar')); };
      img.src = url;
    });
  }
  async function exportarPNG() {
    try { descargar(await generarPNG(), nombreArchivo() + '.png'); avisar('Imagen PNG exportada'); }
    catch (_) { avisar('No se pudo crear la imagen'); }
  }
  function exportarSVG() {
    descargar(new Blob([svgExportable().texto], { type: 'image/svg+xml' }), nombreArchivo() + '.svg');
    avisar('Imagen SVG exportada');
  }
  async function compartir() {
    try {
      const archivo = new File([await generarPNG()], nombreArchivo() + '.png', { type: 'image/png' });
      await navigator.share({ files: [archivo], title: doc.name });
    } catch (err) {
      if (err && err.name !== 'AbortError') avisar('No se pudo compartir; usa Exportar PNG');
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
  $('#b-menu').addEventListener('click', (ev) => { ev.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('pointerdown', (ev) => { if (!menu.hidden && !menu.contains(ev.target) && !$('#b-menu').contains(ev.target)) cerrarMenu(); });
  try {
    if (navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })) $('#m-compartir').hidden = false;
  } catch (_) { /* sin compartir */ }

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
    else if (accion === 'png') exportarPNG();
    else if (accion === 'svg') exportarSVG();
    else if (accion === 'compartir') compartir();
    else if (accion === 'fondo') { seleccionar({ kind: 'doc' }); dibujar(); }
  });

  $('#b-caja').addEventListener('click', () => agregarNodo('box'));
  $('#b-texto').addEventListener('click', () => agregarNodo('text'));
  $('#b-grupo').addEventListener('click', () => agregarNodo('group'));
  $('#b-deshacer').addEventListener('click', deshacer);
  $('#b-rehacer').addEventListener('click', rehacer);
  $('#b-ajustar').addEventListener('click', verTodo);
  $('#b-png').addEventListener('click', exportarPNG);

  // ---------- Teclado (Windows) ----------
  document.addEventListener('keydown', (ev) => {
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 'z' && !ev.shiftKey && !escribiendo) { ev.preventDefault(); deshacer(); }
    else if (ctrl && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey)) && !escribiendo) { ev.preventDefault(); rehacer(); }
    else if (ctrl && ev.key.toLowerCase() === 's') { ev.preventDefault(); guardarArchivo(); }
    else if (ctrl && ev.key.toLowerCase() === 'd' && !escribiendo) { ev.preventDefault(); duplicarSeleccion(); }
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !escribiendo) { ev.preventDefault(); eliminarSeleccion(); }
    else if (ev.key === 'Escape') { if (escribiendo) document.activeElement.blur(); cerrarMenu(); seleccionar(null); dibujar(); }
    else if (!escribiendo && sel && sel.kind === 'node' && ev.key.startsWith('Arrow')) {
      ev.preventDefault();
      const n = nodo(sel.id), paso = ev.shiftKey ? GRILLA * 5 : GRILLA;
      if (ev.key === 'ArrowLeft') n.x -= paso;
      if (ev.key === 'ArrowRight') n.x += paso;
      if (ev.key === 'ArrowUp') n.y -= paso;
      if (ev.key === 'ArrowDown') n.y += paso;
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
