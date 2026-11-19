# RETOMAR — estado del proyecto y tareas pendientes

> Leer este archivo al empezar un chat nuevo. Junto con `CLAUDE.md` (decisiones, estructura del
> código y formato de los diagramas) alcanza para seguir sin la conversación anterior.
> Última actualización: 19 de noviembre de 2026 (seguridad de claves).

## 1. Dónde está todo

| Qué | Dónde |
|---|---|
| Código | GitHub `roruiz57-prog/OpenGravity` (repositorio privado) |
| Rama de trabajo de Claude | `claude/diagram-app-android-windows-7uc7d9` |
| Rama publicada | `main`: Vercel publica solo lo que llega acá |
| App publicada | https://opengravity-seven.vercel.app |
| Proyecto en Vercel | `opengravity` en la cuenta personal "roruiz57-5623's projects" (plan Hobby, gratis) |
| Copia de la v1 | Google Drive → carpeta **OpenGravity** (zip de la primera versión, CLAUDE.md, README.md, vista previa). Está desactualizada. |

## 2. Qué ya funciona (publicado en `main`)
- Editor de diagramas PWA, instalable en Android y Windows, con modo sin conexión.
- Formas: 8 figuras, más texto con brillo y grupos. Bordes continuos, con rayas o con puntos. Flechas con etiqueta.
- Mover un grupo arrastra lo que tiene adentro.
- **Guías magnéticas** (19/11/2026): al arrastrar, la forma se pega a la altura o columna de otra (bordes o centro)
  y aparece una línea rosa. Alt en la PC lo desactiva.
- **Elegir varias** (19/11/2026): Shift + clic en la PC, o el botón "Elegir varias" en el celular. Permite alinear
  (izquierda, centro, derecha, arriba, medio, abajo), repartir parejo (3 o más), mover juntas y borrar.
- Fondos: galería de 8, color liso o degradado, textura y estrellas.
- Exportar a PNG, JPG, WebP, SVG y PDF, con opción de fondo transparente.
- **Mis diagramas**: varios diagramas guardados en el dispositivo.
- La app **no pierde lo escrito** si Android la cierra: las claves de IA se guardan al pegarlas, se
  reabre el cuadro que estaba abierto y el borrador del pedido se conserva. Hay botón "Pegar" y los campos
  de clave admiten el autocompletado del gestor de contraseñas.
- Recuadro "Protege tus claves" en Ajustes de IA: tope de gasto en OpenRouter y restricción por API en Google.
- **Generar con IA** (Gemini / OpenRouter), solo probado con respuestas simuladas: ver tarea 3.3.
- Adaptada a pantallas de celular, en vertical y en horizontal.

## 3. Tareas pendientes (en orden)

### 3.1 Publicar "Generar con IA" — HECHO (18/11/2026)
- Copiado a `main` con autorización del usuario. Vercel publica `diagramas-v7`.
- Falta que el usuario lo pruebe en su celular: cerrar y abrir la app dos veces.

### 3.2 App nativa de Android (APK) — PRIMER APK FIRMADO ARMADO (19/11/2026)
**Decisión del usuario (18/11/2026):** la llave nunca sale de su PC. Nada de secretos en GitHub (se borró
`.github/workflows/apk.yml`). El APK se arma en la PC, que tiene Java (Temurin 21) y el SDK de Android Studio.

**Hecho:**
- Proyecto Capacitor 8.6.0 (`package.json`, `capacitor.config.json`, carpeta `android/`), con los íconos.
- Llave creada con `scripts/crear-llave-firma.ps1` en `D:\VibeCoding\Llaves\OpenGravity\opengravity.jks`
  (alias `opengravity`, una sola contraseña). Copia del `.jks` y la contraseña en el gestor de contraseñas
  del usuario, entrada "OpenGravity – Llave de firma del APK". **Si se pierde, no se puede actualizar el APK.**
- `scripts/armar-apk.ps1`: pide la contraseña oculta, arma el APK firmado (~7 min) y lo deja en
  `D:\VibeCoding\Diagramas multiplataforma\APK\OpenGravity.apk`. El número de versión sale de la fecha y hora.
  **Lo corre el usuario en su PowerShell** (Claude no puede escribir la contraseña).
- Armado de prueba sin firmar: funciona.
- **APK de prueba** (`assembleDebug`, llave de prueba de Android): es otra app, "OpenGravity (prueba)"
  (`app.opengravity.diagramas.prueba`), que convive con la definitiva. Copiado a Google Drive →
  OpenGravity → `OpenGravity-prueba.apk` (G:\Mi unidad\OpenGravity en la PC).

- Primer APK firmado (versión 1.0.261119.1255) armado y copiado a Google Drive → OpenGravity → `OpenGravity.apk`.

**Falta:**
1. Que el usuario instale `OpenGravity.apk` en el celular (Samsung A22, Firefox) y lo pruebe.
2. Para cada actualización: el usuario hace doble clic en `D:\VibeCoding\Diagramas multiplataforma\Armar APK.cmd`
   y escribe la contraseña; el script copia solo el APK a `G:\Mi unidad\OpenGravity` (desde el 19/11/2026).
   Decisión del usuario: NO guardar la contraseña (ni cifrada con Windows ni en archivo como Tareas y Finanzas).
3. Los datos del APK van aparte de los de la app del navegador: pasar diagramas con Guardar/Abrir archivo
   y pegar de nuevo las claves de IA.

### 3.3 Probar la IA con claves reales
- **19/11/2026:** el usuario cargó su clave de Google y "Probar y ver modelos" funcionó. Al generar, Google respondió
  error 5xx (servidor saturado). Se agregó: 2 reintentos automáticos (a los 3 s y 8 s) y el detalle de Google en el
  mensaje (`pruebas/prueba_ia_reintento.py`). Con el modelo **Gemini 3.1 Flash-Lite** generó bien un diagrama real
  (el modelo sugerido, un Flash sin "lite", estaba saturado). El usuario dice que el diagrama se ve bien.
- **19/11/2026, ideas tomadas de la app de Transcripciones:** si el modelo sigue saturado tras los reintentos,
  la app prueba sola hasta 2 modelos más de la lista en vivo (primero Flash-Lite, después Flash) y avisa cuál usó,
  sin cambiar el elegido en Ajustes. Si Google pide esperar poco (429 por minuto, ≤ 60 s) espera y reintenta;
  si pide más, es la cuota del día y muestra el error. El modelo sugerido de fábrica ahora es Flash-Lite.
  Varias claves que se turnan: descartado (un diagrama es un solo pedido; cambiar de clave no arregla la saturación).
- **19/11/2026, demora:** en el APK salió una vez "tardó demasiado en responder" (al reintentar funcionó). Ahora cada
  intento espera hasta 60 s; si se vence, reintenta una vez con el mismo modelo y después prueba un modelo más.
  Mientras espera, el estado muestra los segundos que van pasando.
- Gemini ya se probó con llamadas reales (ver arriba). **OpenRouter** todavía solo se probó simulando las respuestas.
- Para configurar en otro dispositivo, el usuario tiene que:
  1. Crear una clave gratis en https://aistudio.google.com/apikey.
  2. Pegarla en la app: botón **IA** → **Ajustes de IA** → **Probar y ver modelos** → **Guardar**.
  3. Opcional: pegar también la clave de OpenRouter (https://openrouter.ai/keys) como respaldo.
- Si falla, pedirle **el texto exacto del mensaje de error** que muestra la app. Los mensajes dicen si la
  clave no es válida, si se agotó el límite, si faltan créditos, si el modelo no existe o si no hay conexión.
- Cosas para revisar con el uso real:
  - que la IA ubique bien los elementos, sin superponerlos;
  - que el modelo sugerido sea razonable;
  - si OpenRouter acepta `response_format` con el modelo gratuito elegido.

### 3.4 Pruebas automáticas — HECHO (19/11/2026)
- Todas en `pruebas/` (Python + Playwright, sin otras dependencias). Un solo comando, que levanta el servidor solo:
  `python pruebas/correr_todas.py`. **Correrlo antes de proponer publicar.**
- `prueba_editor.py`: crear, conectar, mover, deshacer y exportar PNG (escritorio y celular); las 8 formas, bordes y
  flechas que salen del borde real; grupos; los 8 fondos y el cambio de colores; exportar PNG (normal y
  transparente), JPG, WebP, SVG y PDF (el PDF se valida por dentro, sin `pdfinfo`).
- `prueba_biblioteca.py`: migración desde la clave vieja, crear, abrir, renombrar, duplicar, borrar, guardar e importar.
- `prueba_ia.py`: sin clave, lista de modelos, crear, modificar y deshacer, respuesta rota, respaldo y error.
- `prueba_ia_reintento.py`: saturación, demora, límite por minuto, cuota del día y modelo sugerido.
- `prueba_alinear.py`: guías magnéticas y selección múltiple.
- `comun.py`: funciones compartidas. Las capturas van a `pruebas/capturas/` (ignorada por git).

### 3.5 Proteger las claves de IA
- **HECHO (19/11/2026):** el usuario puso un tope de gasto mínimo en sus claves de **OpenRouter**.
- **HECHO (19/11/2026):** las dos claves de **Google AI Studio** (proyecto "Gemini Project",
  `gen-lang-client-0591703445`; "Gemini API Key" del 2/4/2026 y "Gemini API Key 2" del 27/10/2026) ya estaban
  restringidas a **Gemini API** y vinculadas a una cuenta de servicio (sistema nuevo de Google). "Restricciones de
  aplicaciones" queda en **Ninguno** a propósito: por sitio web rompería el APK. La app usa una de esas dos claves,
  compartida con la app de Transcripciones. No se modificó nada.
- **HECHO (19/11/2026):** la regla ya está en el `CLAUDE.md` de usuario de la PC (sección "Credenciales",
  unificada con las reglas que ya había). Vale para todos sus proyectos de Claude Code.
- **PENDIENTE (lo hace el usuario):** copiarla en sus **preferencias personales de claude.ai**
  (Configuración → General/Perfil), para la web y el celular.

## 4. Ideas que el usuario vio y todavía no eligió
- Cambiar el color de varias formas elegidas a la vez (la selección múltiple ya existe).
- **Flechas curvas o en ángulo recto**, como en los organigramas.
- **Respaldo o sincronización con Google Drive**: hoy cada dispositivo tiene su propia lista y se pasan diagramas con Guardar/Abrir archivo `.json`.
- Más plantillas.
- Botón "Instalar app" dentro del menú.

## 5. Detalles conocidos (no son errores urgentes)
- Los diagramas viven **en cada dispositivo**: el celular y la PC no se sincronizan.
- Borrar un grupo borra solo el marco; lo de adentro queda. Es a propósito.
- En fondos claros, los textos celestes (por ejemplo CONTEXTO o ACCIÓN de la plantilla) tienen poco contraste.
- En el celular vertical, un diagrama ancho se ve chico; se agranda con dos dedos.
- La protección de Vercel ("Vercel Authentication") quedó en el valor por defecto. El usuario abre la app
  sin problema; si algún día le pide iniciar sesión, es por esa protección.

## 6. Forma de trabajar con el usuario
- No es programador (practica *vibecoding*). Responder en español latinoamericano, directo y sin jerga.
- **Antes de ejecutar algo, confirmar en una frase lo que se entendió.**
- **Seguridad de credenciales es prioridad:** ver la regla en `CLAUDE.md`. Nada de secretos en GitHub ni en el chat.
- **Antes de trabajar, traer lo último de GitHub:** el usuario también trabaja con Claude Code en su PC y
  sube a la misma rama.
- Trabajar en la rama de trabajo y **pedir autorización cada vez** antes de copiar a `main`.
  El usuario suele responder "Sí, copialo a main".
- En cada cambio a los archivos de la app, **subir la versión de `CACHE` en `sw.js`** (hoy `diagramas-v13`).
  Si no, el celular sigue mostrando la versión vieja.
- Después de publicar, recordarle: "cierra la app y ábrela dos veces".
- Probar en escritorio (1400×860) y celular (360×740) antes de proponer publicar.
