# OpenGravity Diagramas

App para crear y editar diagramas con estilo de "pizarra brillante" (cajas,
textos con brillo, flechas continuas o punteadas, marcos de grupo), pensada para
usarse en **Android y Windows** desde una sola base de código.

## Sobre el dueño del proyecto
- No es programador: practica *vibecoding*. Explicar en español latinoamericano,
  sin jerga, de forma directa. Antes de ejecutar algo, confirmar en una frase lo entendido.
- La app es **solo para uso personal** (no hay usuarios externos).

## Decisiones tomadas (no volver a discutir salvo que el usuario lo pida)
1. **PWA** (app web instalable). Sin frameworks ni paso de compilación:
   HTML + CSS + JavaScript puro. Se instala desde Chrome (Android) o Edge/Chrome (Windows).
   Si más adelante hace falta tienda o `.exe`: Capacitor (Android) y Tauri/Electron (Windows).
2. **Versión 1 = editor sin IA** (hecha). La app debe ser útil sin IA.
3. **Versión 2 = botón "Generar con IA"** (pendiente):
   - Proveedores: **Google AI Studio (API de Gemini, nivel gratuito)** como principal y
     **OpenRouter** (créditos del usuario o modelos `:free`) como respaldo.
   - La suscripción Gemini Pro del usuario NO incluye API; se usa una clave de AI Studio aparte.
   - Las claves las pega el usuario en Ajustes y se guardan **solo en el dispositivo**
     (localStorage). Nada de claves en el código ni en el repositorio.
   - El modelo devuelve JSON en el mismo formato de `doc` (ver abajo). Validar con
     `normalizar()` y reintentar si viene roto; si falla, pasar al proveedor de respaldo.
   - Proveedor y nombre de modelo configurables en Ajustes.

## Estructura
- `index.html` — interfaz (barra, lienzo SVG, panel, menú).
- `css/app.css` — estilos; en pantallas ≤760px el panel es una hoja inferior.
- `js/app.js` — todo el editor: estado, dibujo SVG, gestos (mouse, dedo, pellizco),
  panel de propiedades, deshacer/rehacer, exportar PNG/SVG, guardar/abrir `.json`.
- `js/plantillas.js` — plantillas (`arnes` = diagrama "Arnés del agente", `blanco`).
- `manifest.webmanifest`, `sw.js`, `icons/` — instalación y modo sin conexión.
  Al cambiar archivos de la app, subir la versión de `CACHE` en `sw.js`.

## Formato del diagrama (`doc`)
```json
{
  "version": 1, "name": "…",
  "bg": { "c1": "#1d4f96", "c2": "#0a2350", "stars": true },
  "nodes": [{ "id": "…", "type": "box|text|group", "x": 0, "y": 0, "w": 200, "h": 80,
              "title": "…", "subtitle": "línea1\nlínea2", "color": "#7fe3ff",
              "fill": "#1f78c8", "titleSize": 30, "subSize": 16, "glow": true }],
  "edges": [{ "id": "…", "from": "idNodo", "to": "idNodo", "label": "…",
              "dashed": false, "arrow": "end|start|both|none", "color": "#ffffff" }]
}
```
`x, y` es la esquina superior izquierda. Los grupos se dibujan detrás de todo.

## Cómo probarla en la PC
Necesita un servidor local (el modo sin conexión no funciona abriendo el archivo directo):
- Con Python: `python -m http.server 8080` y abrir http://localhost:8080
- Con Node.js: `npx serve .`
Para instalarla en el celular hace falta publicarla en **https** (por ejemplo GitHub Pages).

## Próximos pasos sugeridos
- Publicar en GitHub Pages para instalarla en Android.
- Versión 2: IA (ver arriba).
- Ideas: varios diagramas guardados en la app, selección múltiple, flechas curvas,
  alinear elementos, más plantillas.
