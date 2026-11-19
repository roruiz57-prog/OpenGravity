# OpenGravity Diagramas

> **Al empezar un chat nuevo, leer primero `RETOMAR.md`**: tiene el estado actual y las tareas pendientes.

App para crear y editar diagramas con estilo de "pizarra brillante" (cajas,
textos con brillo, flechas continuas o punteadas, marcos de grupo), pensada para
usarse en **Android y Windows** desde una sola base de código.

## Sobre el dueño del proyecto
- No es programador: practica *vibecoding*. Explicar en español latinoamericano,
  sin jerga, de forma directa. Antes de ejecutar algo, confirmar en una frase lo entendido.
- La app es **solo para uso personal** (no hay usuarios externos).

## Seguridad de credenciales (regla prioritaria del usuario, vale para todo)
- **Nunca subir a GitHub ni a ningún servicio en la nube** claves de API, contraseñas, llaves de firma
  (`.jks`, `.keystore`) ni archivos con secretos. Viven solo en los dispositivos del usuario y en su
  gestor de contraseñas. (`.gitignore` ya excluye `*.jks` y `*.keystore`.)
- **Nunca pedirle que pegue credenciales en el chat.** Si un paso las necesita, las escribe él en la
  terminal (oculto) o directamente en la app.
- **Antes de cada subida a GitHub**, revisar que no vaya ningún secreto. El código sin secretos **sí se
  sube**: si queda solo en la PC, se pierde si le pasa algo.
- El proyecto se trabaja desde **dos lugares** (sesiones en la nube y Claude Code en su PC) que suben a la
  misma rama. **Antes de empezar, traer lo último de GitHub** (`git fetch` / `git pull`) para no pisar
  el trabajo del otro lado.

## Decisiones tomadas (no volver a discutir salvo que el usuario lo pida)
1. **PWA** (app web instalable). Sin frameworks ni paso de compilación:
   HTML + CSS + JavaScript puro. Se instala desde Chrome (Android) o Edge/Chrome (Windows).
   Si más adelante hace falta tienda o `.exe`: Capacitor (Android) y Tauri/Electron (Windows).
2. **Versión 1 = editor sin IA** (hecha). La app debe ser útil sin IA.
3. **Versión 2 = botón "Generar con IA"** (hecha, en `js/ia.js`):
   - Proveedores: **Google AI Studio (API de Gemini, nivel gratuito)** como principal y
     **OpenRouter** (créditos del usuario o modelos `:free`) como respaldo.
   - La suscripción Gemini Pro del usuario NO incluye API; se usa una clave de AI Studio aparte.
   - Las claves las pega el usuario en Ajustes y se guardan **solo en el dispositivo**
     (localStorage). Nada de claves en el código ni en el repositorio.
   - El modelo devuelve JSON en el mismo formato de `doc` (ver abajo). Validar con
     `normalizar()` y reintentar si viene roto; si falla, pasar al proveedor de respaldo.
   - Proveedor y nombre de modelo configurables en Ajustes. La lista de modelos se pide en vivo
     a cada proveedor (`listarModelos()`); no hay nombres de modelo fijos en el código.
   - Modos: crear un diagrama nuevo (va a Mis diagramas) o modificar el abierto (se puede deshacer).
   - Si el modelo está saturado (5xx): 2 reintentos y luego hasta 2 modelos más de la lista (`modelosGeminiEnOrden()`,
     Flash-Lite primero). 429 con espera corta: espera y reintenta.
     Sin respuesta en 60 s: 1 reintento y luego 1 modelo más. No se usan varias claves (decidido 19/11/2026).
   - `prepararDiagramaIA()` en `app.js` corrige ids, completa campos y agranda formas para que entre el texto.

## Estructura
- `index.html` — interfaz (barra, lienzo SVG, panel, menú).
- `css/app.css` — estilos; en pantallas ≤760px el panel es una hoja inferior.
- `js/app.js` — todo el editor: estado, dibujo SVG, formas (`FORMAS`, `POLIGONOS`, `figura()`),
  flechas que tocan el borde real (`salidaForma()`), gestos (mouse, dedo, pellizco),
  panel de propiedades, deshacer/rehacer, exportar PNG/JPG/WebP/SVG/PDF
  (`generarImagen()`, `crearPDF()` arma el PDF a mano, sin librerías), guardar/abrir `.json`.
- `js/ia.js` — conexión con Gemini (AI Studio) y OpenRouter: ajustes, instrucciones al modelo,
  reintento si la respuesta no es JSON y proveedor de respaldo. No toca la pantalla.
- `js/plantillas.js` — plantillas (`arnes` = diagrama "Arnés del agente", `blanco`).
- `manifest.webmanifest`, `sw.js`, `icons/` — instalación y modo sin conexión.
- **APK de Android (Capacitor)**: `package.json`, `capacitor.config.json`, `android/`, `scripts/preparar-www.mjs`
  y `scripts/armar-apk.ps1` (arma el APK firmado en la PC del usuario). La llave vive SOLO en su PC
  (`D:\VibeCoding\Llaves\OpenGravity`), nunca en el repo ni en GitHub.
  `.vercelignore` deja fuera de Vercel todo lo del APK.
  Al cambiar archivos de la app, subir la versión de `CACHE` en `sw.js`.

## Formato del diagrama (`doc`)
```json
{
  "version": 1, "name": "…",
  "bg": { "type": "gradient|solid", "c1": "#1d4f96", "c2": "#0a2350", "stars": true,
          "pattern": "none|grid|dots" },
  "nodes": [{ "id": "…", "type": "box|text|group", "x": 0, "y": 0, "w": 200, "h": 80,
              "shape": "round|rect|ellipse|diamond|triangle|hexagon|parallelogram|cylinder",
              "border": "solid|dashed|dotted",
              "title": "…", "subtitle": "línea1\nlínea2", "color": "#7fe3ff",
              "fill": "#1f78c8", "titleSize": 30, "subSize": 16, "glow": true }],
  "edges": [{ "id": "…", "from": "idNodo", "to": "idNodo", "label": "…",
              "style": "solid|dashed|dotted", "arrow": "end|start|both|none", "color": "#ffffff" }]
}
```
`x, y` es la esquina superior izquierda. Los grupos se dibujan detrás de todo.
Al mover un grupo se mueven también los elementos cuyo centro está dentro del marco (`contenidoDeGrupo()`).
`type: "box"` es la "Forma" en la interfaz; `shape` solo aplica a ella. `border` aplica a formas y grupos.
Fondo: `solid` usa solo `c1`. La galería de fondos es `FONDOS`. Con fondo claro (`fondoClaro()`),
los textos fijos usan `tinta()`, y `cambiarFondo()` pasa los elementos blancos a azul oscuro (y al revés).
Exportar con "Fondo transparente" (PNG, WebP, SVG) omite el fondo (`svgExportable(true)`).
**Mis diagramas** (varios diagramas por dispositivo, en localStorage): índice `opengravity.biblioteca.v1`
(`[{id, name, updated}]`), cada diagrama en `opengravity.diagrama.<id>`, el abierto en `opengravity.abierto`.
`iniciarBiblioteca()` migra la clave vieja `opengravity.diagrama.actual.v1`. Deshacer es por diagrama.
No se sincroniza entre dispositivos: para pasar uno se usa Guardar/Abrir archivo.
Archivos viejos con `"dashed": true` en flechas se convierten solos a `style` en `normalizar()`.

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
