// Plantillas de diagramas. Cada plantilla es un diagrama completo en el mismo
// formato que se guarda en los archivos .json de la app.
window.PLANTILLAS = {
  arnes: {
    version: 1,
    name: 'Arnés del agente',
    bg: { c1: '#1d4f96', c2: '#0a2350', stars: true },
    nodes: [
      { id: 'g-arnes', type: 'group', x: 80, y: 100, w: 1160, h: 640, title: 'ARNÉS', subtitle: '', color: '#ffb454', titleSize: 30, subSize: 16, glow: true },
      { id: 'agente', type: 'text', x: 490, y: 20, w: 340, h: 60, title: 'AGENTE', subtitle: '', color: '#ffffff', titleSize: 40, subSize: 16, glow: true },
      { id: 'contexto', type: 'text', x: 420, y: 130, w: 480, h: 90, title: 'CONTEXTO', subtitle: 'prompts · memoria · skills · conversación', color: '#7fe3ff', titleSize: 34, subSize: 16, glow: true },
      { id: 'modelo', type: 'box', x: 540, y: 340, w: 240, h: 130, title: 'MODELO', subtitle: 'razona → decide', color: '#e6f7ff', fill: '#1f78c8', titleSize: 42, subSize: 17, glow: true },
      { id: 'control', type: 'text', x: 120, y: 310, w: 320, h: 110, title: 'CONTROL', subtitle: 'compactación, orquestación,\nbucles Ralph', color: '#ff6b9a', titleSize: 34, subSize: 16, glow: true },
      { id: 'accion', type: 'text', x: 930, y: 250, w: 280, h: 110, title: 'ACCIÓN', subtitle: 'llama a bash,\nherramientas, MCP', color: '#7fe3ff', titleSize: 34, subSize: 16, glow: true },
      { id: 'persistir', type: 'text', x: 380, y: 610, w: 340, h: 90, title: 'PERSISTIR', subtitle: 'archivos · git · progreso', color: '#ffffff', titleSize: 32, subSize: 16, glow: true },
      { id: 'observar', type: 'text', x: 790, y: 590, w: 430, h: 90, title: 'OBSERVAR Y VERIFICAR', subtitle: 'capturas · tests · registros', color: '#ffffff', titleSize: 30, subSize: 16, glow: true }
    ],
    edges: [
      { id: 'e1', from: 'contexto', to: 'modelo', label: '', dashed: false, arrow: 'end', color: '#ffffff' },
      { id: 'e2', from: 'control', to: 'modelo', label: '', dashed: false, arrow: 'end', color: '#ff6b9a' },
      { id: 'e3', from: 'modelo', to: 'accion', label: '', dashed: false, arrow: 'end', color: '#ffffff' },
      { id: 'e4', from: 'accion', to: 'modelo', label: 'resultados al contexto', dashed: true, arrow: 'end', color: '#ffffff' },
      { id: 'e5', from: 'modelo', to: 'persistir', label: 'escribe', dashed: false, arrow: 'end', color: '#ffffff' },
      { id: 'e6', from: 'persistir', to: 'modelo', label: 'lee', dashed: true, arrow: 'end', color: '#ffffff' },
      { id: 'e7', from: 'modelo', to: 'observar', label: '', dashed: false, arrow: 'end', color: '#ffffff' },
      { id: 'e8', from: 'observar', to: 'modelo', label: '', dashed: true, arrow: 'end', color: '#ffffff' }
    ]
  },

  blanco: {
    version: 1,
    name: 'Diagrama nuevo',
    bg: { c1: '#1d4f96', c2: '#0a2350', stars: true },
    nodes: [],
    edges: []
  }
};
