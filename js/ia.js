// OpenGravity Diagramas — conexión con la IA (Gemini de Google AI Studio y OpenRouter).
// Este archivo no toca la pantalla: arma el pedido, llama al proveedor y devuelve el diagrama.
// Las claves se guardan solo en este dispositivo (localStorage) y se envían únicamente
// al proveedor correspondiente.
'use strict';
window.IA = (() => {
  const CLAVE_AJUSTES = 'opengravity.ia.v1';
  const TIEMPO_MAXIMO = 90000; // 90 s por intento
  const PROVEEDORES = { gemini: 'Gemini (Google AI Studio)', openrouter: 'OpenRouter' };

  // ---------- Ajustes ----------
  const AJUSTES_BASE = {
    principal: 'gemini',
    respaldo: true,
    gemini: { clave: '', modelo: '' },
    openrouter: { clave: '', modelo: '', soloGratis: true }
  };
  function leerAjustes() {
    let guardado = {};
    try { guardado = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || '{}') || {}; } catch (_) { /* sin almacenamiento */ }
    return {
      ...AJUSTES_BASE,
      ...guardado,
      gemini: { ...AJUSTES_BASE.gemini, ...(guardado.gemini || {}) },
      openrouter: { ...AJUSTES_BASE.openrouter, ...(guardado.openrouter || {}) }
    };
  }
  function guardarAjustes(a) {
    try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(a)); return true; } catch (_) { return false; }
  }
  const tieneClave = (a, p) => !!(a[p] && a[p].clave && a[p].clave.trim());

  // ---------- Errores con mensaje claro ----------
  class ErrorIA extends Error {
    constructor(mensaje, tipo = 'otro') { super(mensaje); this.tipo = tipo; }
  }
  function errorHttp(proveedor, estado, detalle) {
    const nombre = PROVEEDORES[proveedor];
    const extra = detalle ? ` (${String(detalle).slice(0, 160)})` : '';
    if (estado === 400 && /api key|API_KEY/i.test(detalle || '')) return new ErrorIA(`La clave de ${nombre} no es válida. Revísala en Ajustes de IA.`, 'clave');
    if (estado === 401 || estado === 403) return new ErrorIA(`La clave de ${nombre} no es válida o no tiene permiso. Revísala en Ajustes de IA.`, 'clave');
    if (estado === 402) return new ErrorIA(`${nombre} no tiene créditos suficientes para ese modelo. Elige un modelo gratuito en Ajustes de IA.`, 'creditos');
    if (estado === 404) return new ErrorIA(`${nombre} no encontró ese modelo. Elige otro en Ajustes de IA.`, 'modelo');
    if (estado === 429) return new ErrorIA(`Llegaste al límite de uso de ${nombre} por ahora. Espera un rato o usa el otro proveedor.`, 'limite');
    if (estado >= 500) return new ErrorIA(`${nombre} está con problemas en este momento${extra}. Prueba de nuevo en unos minutos o elige otro modelo en Ajustes de IA.`, 'servidor');
    return new ErrorIA(`${nombre} rechazó el pedido${extra}.`, 'otro');
  }

  // Si el proveedor está saturado (error 5xx, muy común en el nivel gratuito), reintenta solo dos veces.
  const ESPERAS_REINTENTO = [3000, 8000];
  function esperar(ms, senal) {
    return new Promise((listo, fallo) => {
      if (senal && senal.aborted) return fallo(new ErrorIA('Cancelado.', 'cancelado'));
      const reloj = setTimeout(listo, ms);
      if (senal) senal.addEventListener('abort', () => { clearTimeout(reloj); fallo(new ErrorIA('Cancelado.', 'cancelado')); }, { once: true });
    });
  }
  async function pedir(proveedor, url, opciones, senal) {
    for (let intento = 0; ; intento++) {
      try {
        return await pedirUnaVez(proveedor, url, opciones, senal);
      } catch (e) {
        if (e.tipo !== 'servidor' || intento >= ESPERAS_REINTENTO.length) throw e;
        await esperar(ESPERAS_REINTENTO[intento], senal);
      }
    }
  }
  async function pedirUnaVez(proveedor, url, opciones, senal) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort('tiempo'), TIEMPO_MAXIMO);
    const cortar = () => control.abort('cancelado');
    if (senal) senal.addEventListener('abort', cortar);
    try {
      const r = await fetch(url, { ...opciones, signal: control.signal });
      const texto = await r.text();
      let datos = null;
      try { datos = JSON.parse(texto); } catch (_) { /* respuesta no JSON */ }
      if (!r.ok) {
        const detalle = datos && datos.error ? (datos.error.message || datos.error.status || '') : texto.slice(0, 200);
        throw errorHttp(proveedor, r.status, detalle);
      }
      return datos;
    } catch (e) {
      if (e instanceof ErrorIA) throw e;
      if (control.signal.aborted) {
        if (control.signal.reason === 'cancelado') throw new ErrorIA('Cancelado.', 'cancelado');
        throw new ErrorIA(`${PROVEEDORES[proveedor]} tardó demasiado en responder.`, 'tiempo');
      }
      throw new ErrorIA(`No se pudo conectar con ${PROVEEDORES[proveedor]}. Revisa tu conexión a internet.`, 'red');
    } finally {
      clearTimeout(reloj);
      if (senal) senal.removeEventListener('abort', cortar);
    }
  }

  // ---------- Lista de modelos (se piden al proveedor, así nunca quedan desactualizados) ----------
  async function listarModelos(proveedor, ajustes, senal) {
    if (proveedor === 'gemini') {
      const clave = encodeURIComponent(ajustes.gemini.clave.trim());
      const datos = await pedir('gemini', `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${clave}`, {}, senal);
      return (datos.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => ({ id: String(m.name).replace(/^models\//, ''), nombre: m.displayName || m.name }))
        .filter((m) => /gemini/i.test(m.id) && !/(tts|image|embedding|live|audio|vision)/i.test(m.id));
    }
    const datos = await pedir('openrouter', 'https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${ajustes.openrouter.clave.trim()}` }
    }, senal);
    const gratis = (m) => /:free$/.test(m.id) || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0);
    return (datos.data || [])
      .filter((m) => !ajustes.openrouter.soloGratis || gratis(m))
      .map((m) => ({ id: m.id, nombre: `${m.name || m.id}${gratis(m) ? ' (gratis)' : ''}`, contexto: m.context_length || 0 }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  // Modelo sugerido cuando el usuario todavía no eligió uno.
  function modeloSugerido(proveedor, lista) {
    if (!lista.length) return '';
    if (proveedor === 'gemini') {
      const version = (id) => { const m = /gemini-(\d+(?:\.\d+)?)/.exec(id); return m ? parseFloat(m[1]) : 0; };
      const flash = lista.filter((m) => /flash/i.test(m.id) && !/(lite|exp|preview|thinking|8b)/i.test(m.id));
      const base = flash.length ? flash : lista;
      return [...base].sort((a, b) => version(b.id) - version(a.id) || a.id.length - b.id.length)[0].id;
    }
    return [...lista].sort((a, b) => (b.contexto || 0) - (a.contexto || 0))[0].id;
  }

  // ---------- Instrucciones para el modelo ----------
  function instrucciones(fondoClaro) {
    const colores = fondoClaro
      ? 'El fondo es CLARO: usa títulos #16243f, #1f78c8, #c2185b, #b45309 o #15803d; flechas #16243f; relleno de formas #1f78c8 con título #ffffff.'
      : 'El fondo es OSCURO: usa títulos #7fe3ff, #ffffff, #ff6b9a, #ffb454 o #7dffb2; flechas #ffffff; relleno de formas #1f78c8 con título #e6f7ff.';
    return `Eres un diseñador de diagramas para la app "OpenGravity Diagramas".
Respondes SOLO con un objeto JSON válido, sin texto antes ni después y sin bloques de código.

Formato:
{
  "name": "nombre corto del diagrama",
  "nodes": [ { "id": "texto-corto-unico", "type": "box" | "text" | "group",
               "shape": "round" | "rect" | "ellipse" | "diamond" | "triangle" | "hexagon" | "parallelogram" | "cylinder",
               "x": 0, "y": 0, "w": 220, "h": 110,
               "title": "TÍTULO", "subtitle": "detalle opcional",
               "color": "#hex", "fill": "#hex", "border": "solid" | "dashed" | "dotted" } ],
  "edges": [ { "id": "e1", "from": "id-origen", "to": "id-destino", "label": "opcional",
               "style": "solid" | "dashed" | "dotted", "arrow": "end" | "start" | "both" | "none", "color": "#hex" } ]
}

Tipos:
- "box": forma con relleno. "shape" elige la figura: diamond para decisiones, ellipse para inicio/fin,
  cylinder para bases de datos, parallelogram para entradas/salidas, round o rect para pasos.
- "text": título con brillo y sin caja (para conceptos o encabezados).
- "group": marco punteado que encierra a otros elementos (usa "border": "dashed"); su título va arriba a la izquierda.

Reglas de diseño:
- x, y son la esquina superior izquierda, en píxeles. Lienzo de unos 1400 x 900.
- Deja entre 60 y 120 px de espacio entre elementos. Nada se superpone, salvo los grupos que encierran
  a sus elementos con 40 px de margen.
- Tamaños típicos: box 220x110, text 300x90, ellipse o diamond 170x170, group lo necesario para encerrar.
- "title" en MAYÚSCULAS y corto (máximo 22 caracteres). "subtitle" en minúsculas, corto; puede usar \\n.
- Ordena el flujo de arriba hacia abajo o de izquierda a derecha, de forma prolija.
- Máximo 25 elementos. Escribe en el mismo idioma que el pedido.
- Cada "from" y "to" de las flechas debe ser un "id" que exista. Usa "label" para describir la relación cuando ayude.
- ${colores}
- No incluyas fondo ("bg") ni otros campos.`;
  }
  function mensajeUsuario(pedido, actual) {
    if (!actual) return `Crea un diagrama para este pedido:\n${pedido}`;
    const resumen = { name: actual.name, nodes: actual.nodes, edges: actual.edges };
    return `Este es el diagrama actual:\n${JSON.stringify(resumen)}\n\nModifícalo según este pedido:\n${pedido}\n\n` +
      'Devuelve el diagrama COMPLETO con los cambios. Conserva los "id", posiciones y estilos de lo que no cambia.';
  }

  // ---------- Llamadas a cada proveedor ----------
  async function llamarGemini(ajustes, sistema, mensajes, senal) {
    const modelo = ajustes.gemini.modelo;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(ajustes.gemini.clave.trim())}`;
    const cuerpo = {
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensajes.map((m) => ({ role: m.rol === 'asistente' ? 'model' : 'user', parts: [{ text: m.texto }] })),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
    };
    const datos = await pedir('gemini', url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }, senal);
    const cand = (datos.candidates || [])[0];
    const texto = cand && cand.content ? (cand.content.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('') : '';
    if (!texto) {
      const motivo = cand && cand.finishReason ? ` (${cand.finishReason})` : (datos.promptFeedback && datos.promptFeedback.blockReason ? ` (${datos.promptFeedback.blockReason})` : '');
      throw new ErrorIA(`Gemini no devolvió un diagrama${motivo}. Prueba describiéndolo de otra forma.`, 'vacio');
    }
    return texto;
  }
  async function llamarOpenRouter(ajustes, sistema, mensajes, senal) {
    const cuerpo = {
      model: ajustes.openrouter.modelo,
      messages: [{ role: 'system', content: sistema }, ...mensajes.map((m) => ({ role: m.rol === 'asistente' ? 'assistant' : 'user', content: m.texto }))],
      response_format: { type: 'json_object' },
      temperature: 0.4
    };
    const datos = await pedir('openrouter', 'https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ajustes.openrouter.clave.trim()}`, 'X-Title': 'OpenGravity Diagramas' },
      body: JSON.stringify(cuerpo)
    }, senal);
    if (datos && datos.error) throw new ErrorIA(`OpenRouter: ${datos.error.message || 'error desconocido'}`, 'otro');
    const texto = datos && datos.choices && datos.choices[0] && datos.choices[0].message ? datos.choices[0].message.content : '';
    if (!texto) throw new ErrorIA('OpenRouter no devolvió un diagrama. Prueba otro modelo o reformula el pedido.', 'vacio');
    return texto;
  }

  // ---------- Leer la respuesta ----------
  // Acepta JSON con o sin bloque ```json, o con texto alrededor.
  function interpretar(texto) {
    let t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let obj;
    try { obj = JSON.parse(t); } catch (_) {
      const i = t.indexOf('{'), j = t.lastIndexOf('}');
      if (i < 0 || j <= i) throw new ErrorIA('La respuesta no era un diagrama válido.', 'formato');
      try { obj = JSON.parse(t.slice(i, j + 1)); } catch (_) { throw new ErrorIA('La respuesta no era un diagrama válido.', 'formato'); }
    }
    if (obj && !Array.isArray(obj.nodes)) obj = obj.diagram || obj.diagrama || obj.doc || obj;
    if (!obj || !Array.isArray(obj.nodes) || !obj.nodes.length) throw new ErrorIA('La respuesta no traía elementos.', 'formato');
    if (!Array.isArray(obj.edges)) obj.edges = [];
    return obj;
  }

  // ---------- Generar (con reintento y proveedor de respaldo) ----------
  // `alAvanzar(texto)` informa en qué paso va. Devuelve { diagrama, proveedor, modelo }.
  async function generar({ pedido, actual = null, fondoClaro = false, alAvanzar = () => {}, senal } = {}) {
    const ajustes = leerAjustes();
    const otro = ajustes.principal === 'gemini' ? 'openrouter' : 'gemini';
    const orden = [ajustes.principal, ...(ajustes.respaldo ? [otro] : [])].filter((p) => tieneClave(ajustes, p));
    if (!orden.length) throw new ErrorIA('Falta configurar una clave de IA.', 'sin-clave');

    const sistema = instrucciones(fondoClaro);
    const fallas = [];
    for (const proveedor of orden) {
      try {
        if (!ajustes[proveedor].modelo) {
          alAvanzar(`Buscando un modelo de ${PROVEEDORES[proveedor]}…`);
          const lista = await listarModelos(proveedor, ajustes, senal);
          ajustes[proveedor].modelo = modeloSugerido(proveedor, lista);
          if (!ajustes[proveedor].modelo) throw new ErrorIA(`No encontré modelos disponibles en ${PROVEEDORES[proveedor]}.`, 'modelo');
          guardarAjustes(ajustes);
        }
        const mensajes = [{ rol: 'usuario', texto: mensajeUsuario(pedido, actual) }];
        for (let intento = 1; intento <= 2; intento++) {
          alAvanzar(`${PROVEEDORES[proveedor]} está armando el diagrama${intento > 1 ? ' (segundo intento)' : ''}…`);
          const texto = proveedor === 'gemini'
            ? await llamarGemini(ajustes, sistema, mensajes, senal)
            : await llamarOpenRouter(ajustes, sistema, mensajes, senal);
          try {
            return { diagrama: interpretar(texto), proveedor: PROVEEDORES[proveedor], modelo: ajustes[proveedor].modelo };
          } catch (e) {
            if (intento === 2) throw e;
            mensajes.push({ rol: 'asistente', texto: String(texto).slice(0, 4000) });
            mensajes.push({ rol: 'usuario', texto: 'Tu respuesta no era un JSON válido con el formato pedido. Responde de nuevo SOLO con el objeto JSON completo.' });
          }
        }
      } catch (e) {
        if (e.tipo === 'cancelado') throw e;
        fallas.push(e.message);
      }
    }
    throw new ErrorIA(fallas.join(' '), 'fallo');
  }

  return { PROVEEDORES, leerAjustes, guardarAjustes, tieneClave, listarModelos, modeloSugerido, generar, interpretar, instrucciones };
})();
