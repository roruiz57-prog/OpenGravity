# RETOMAR — estado del proyecto y tareas pendientes

> Leer este archivo al empezar un chat nuevo. Junto con `CLAUDE.md` (decisiones, estructura del
> código y formato de los diagramas) alcanza para seguir sin la conversación anterior.
> Última actualización: 20 de noviembre de 2026 (trabajo en nube y PC; APK: elegir dónde guardar y exportar).

## 1. Dónde está todo

| Qué | Dónde |
|---|---|
| Código | GitHub `roruiz57-prog/OpenGravity` (repositorio privado) |
| Rama de trabajo de Claude | `claude/diagram-app-android-windows-7uc7d9` (la nube y la PC; las sesiones en la nube suben ahí sin preguntar) |
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
- **Generar con IA** (Gemini / OpenRouter), probado con llamadas reales con los dos proveedores (19/11/2026).
- Adaptada a pantallas de celular, en vertical y en horizontal.

## 3. Tareas pendientes (en orden)

### 3.1 Publicar "Generar con IA" — HECHO (18/11/2026)
- Copiado a `main` con autorización del usuario. Vercel publica `diagramas-v7`.
- Falta que el usuario lo pruebe en su celular: cerrar y abrir la app dos veces.

### 3.2 App nativa de Android (APK) — INSTALADO EN EL CELULAR (19/11/2026)
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
1. **HECHO (19/11/2026):** el usuario instaló `OpenGravity.apk` en el celular (Samsung A22) y lo usa.
2. Para cada actualización: el usuario hace doble clic en `D:\VibeCoding\Diagramas multiplataforma\Armar APK.cmd`
   y escribe la contraseña; el script copia solo el APK a `G:\Mi unidad\OpenGravity` (desde el 19/11/2026).
   Decisión del usuario: NO guardar la contraseña (ni cifrada con Windows ni en archivo como Tareas y Finanzas).
3. **Guardar y exportar en el APK (19/11/2026):** antes no guardaba nada (Android ignora las descargas del
   navegador dentro de una app; el usuario lo comprobó). Ahora usa los componentes oficiales Filesystem y Share
   de Capacitor: guarda en **Documentos/OpenGravity** del celular y el botón Compartir funciona. Si Android no
   deja escribir ahí, abre la lista de compartir. Probado solo **simulando** el APK; **falta armar el APK nuevo en
   la PC** (el script ya reinstala los componentes si cambió la lista) **y probarlo en el celular**.
   - **20/11/2026 14:01:** se armó un APK en la PC pero salió **SIN el arreglo** (la PC no había traído lo
     último de GitHub). En el celular, Guardar archivo muestra el aviso viejo "Archivo guardado" y no guarda.
     **Para volver a armarlo:** en la PC, pedirle a Claude Code "trae lo último de GitHub" → confirmar que el
     último cambio es "APK: guardar y exportar con Android (Documentos/OpenGravity) y compartir" → doble clic en
     `D:\VibeCoding\Diagramas multiplataforma\Armar APK.cmd` (esta vez tiene que **instalar componentes**) →
     instalar desde Drive → Guardar archivo tiene que decir "**en Documentos/OpenGravity**".
   - **Cómo ver la versión instalada:** en el celular, Ajustes → Aplicaciones → OpenGravity Diagramas (abajo).
     Formato `1.0.AAMMDD.HHmm` (fecha y hora del armado en la PC).
   - **20/11/2026: `Armar APK` ahora trae solo lo último de GitHub** (`scripts/armar-apk.ps1`). Antes de pedir la
     contraseña: si hay archivos cambiados o cambios guardados en la PC sin subir, **no arma** y avisa; si no hay
     internet, pregunta si arma igual; si el propio script cambió, corre la versión nueva. Muestra en la ventana el
     **último cambio con fecha** con el que va a armar. Trae la rama en la que está la PC (no cambia de rama).
     **No se pudo probar en la nube** (no hay PowerShell): la primera prueba real es en la PC.
   - **20/11/2026, pedido del usuario: elegir dónde guardar.** Guardar archivo y Exportar (PNG, JPG, WebP, SVG, PDF)
     ya no van fijos a Documentos/OpenGravity: abren el cuadro **"Guardar como" de Android** (carpeta y nombre),
     con un componente propio de la app (`GuardarComoPlugin.java`, sin dependencias nuevas). Si el usuario cancela,
     avisa "No se guardó"; si el cuadro falla, abre la lista de compartir. El código de Android compila y las
     pruebas pasan; **falta armar el APK y probarlo en el celular** (Guardar tiene que abrir el cuadro de carpetas).
   - **20/11/2026, también en la PC:** en Chrome y Edge, Guardar y Exportar abren el cuadro "Guardar como" de
     Windows (función del navegador, sin dependencias). En otros navegadores sigue bajando a Descargas.
     Prueba: `pruebas/prueba_guardar_como.py` (PC y APK simulados).
   - **20/11/2026, contraseña del armado:** `Armar APK` la pide en un cuadrito de Windows (tapada con puntos) que
     **admite pegar** con Ctrl+V o clic derecho; el viejo `Read-Host -AsSecureString` no dejaba pegar. Si se pegó,
     la borra del portapapeles. Probado el cuadro solo; la primera prueba real es el próximo armado.
4. Los datos del APK van aparte de los de la app del navegador: pasar diagramas con Guardar/Abrir archivo
   y pegar de nuevo las claves de IA.

### 3.3 Probar la IA con claves reales — HECHO (19/11/2026)
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
- **HECHO (19/11/2026):** el usuario generó diagramas reales con **Gemini** y con **OpenRouter** (respaldo) y funcionan bien.
- Para configurar en otro dispositivo, el usuario tiene que:
  1. Crear una clave gratis en https://aistudio.google.com/apikey.
  2. Pegarla en la app: botón **IA** → **Ajustes de IA** → **Probar y ver modelos** → **Guardar**.
  3. Opcional: pegar también la clave de OpenRouter (https://openrouter.ai/keys) como respaldo.
- Si falla, pedirle **el texto exacto del mensaje de error** que muestra la app. Los mensajes dicen si la
  clave no es válida, si se agotó el límite, si faltan créditos, si el modelo no existe o si no hay conexión.
- Cosas para revisar con el uso real:
  - que la IA ubique bien los elementos, sin superponerlos;
  - que el modelo sugerido sea razonable;
  - si OpenRouter acepta `response_format` con el modelo gratuito elegido (con el modelo que usó el usuario, funcionó).

### 3.4 Pruebas automáticas — HECHO (19/11/2026)
- **19/11/2026, en la sesión en la nube:** `prueba_alinear.py` falló en distintos pasos de una corrida a otra.
  **20/11/2026: en la PC pasa** (dos corridas seguidas, las 5 pruebas en verde). Era cosa del entorno de la nube.
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
- **HECHO (19/11/2026):** la misma regla, resumida, está en sus **preferencias personales de claude.ai**
  (reemplazó la versión corta que tenía), para la web y el celular.

### 3.6 Acceso remoto desde la nube a la notebook (20/11/2026)
- Idea: que una sesión en la nube traiga lo último de GitHub en la PC, así el usuario solo hace doble clic en
  Armar APK y escribe la contraseña. **La firma igual se hace en la PC**: la llave y la contraseña no salen de ahí.
- Estado: la notebook **NOTEBOOK-LOCAL** tiene la carpeta **VibeCoding** en su lista de Remote Control, pero
  **no la ofrece a sesiones en la nube** (sin motivo informado). Causa probable: la app de Claude de escritorio
  desactualizada en Windows, o la función todavía no habilitada para la cuenta.
- **20/11/2026:** el usuario cerró y reabrió la app de Claude en la PC; **sigue sin ofrecerla**. Probablemente la
  función no está habilitada todavía para la cuenta. Volver a probar más adelante, sin insistir.
- Mientras tanto ya no hace tanta falta: desde el 20/11/2026 `Armar APK` trae solo lo último de GitHub.
- **Decisión del usuario (20/11/2026): trabajar en los dos lados, la nube y VS Code en la PC**, con GitHub como
  puente (no hace falta que la nube entre a la PC). Detalle en `CLAUDE.md` → "Ramas y forma de trabajar en dos lados".
  No volver a proponer Remote Control salvo que el usuario lo pida.

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
- **Antes de trabajar, traer lo último de GitHub; al terminar, subir.** El usuario trabaja en la nube y en VS Code
  en su PC, en la misma rama. Las sesiones en la nube suben también a la rama de trabajo sin preguntar.
- **Pedir autorización cada vez** antes de copiar a `main`.
  El usuario suele responder "Sí, copialo a main".
- En cada cambio a los archivos de la app, **subir la versión de `CACHE` en `sw.js`** (hoy `diagramas-v16`).
  Si no, el celular sigue mostrando la versión vieja.
- Después de publicar, recordarle: "cierra la app y ábrela dos veces".
- Probar en escritorio (1400×860) y celular (360×740) antes de proponer publicar.
