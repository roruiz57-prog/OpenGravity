# RETOMAR — estado del proyecto y tareas pendientes

> Leer este archivo al empezar un chat nuevo. Junto con `CLAUDE.md` (decisiones, estructura del
> código y formato de los diagramas) alcanza para seguir sin la conversación anterior.
> Última actualización: 18 de noviembre de 2026 (APK).

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
2. Para cada actualización: el usuario corre `armar-apk.ps1` y Claude copia el APK a `G:\Mi unidad\OpenGravity`.
3. Los datos del APK van aparte de los de la app del navegador: pasar diagramas con Guardar/Abrir archivo
   y pegar de nuevo las claves de IA.

### 3.3 Probar la IA con claves reales
- Hasta ahora solo se probó **simulando** las respuestas de Google y OpenRouter. Nunca se hizo una llamada real.
- El usuario tiene que:
  1. Crear una clave gratis en https://aistudio.google.com/apikey.
  2. Pegarla en la app: botón **IA** → **Ajustes de IA** → **Probar y ver modelos** → **Guardar**.
  3. Opcional: pegar también la clave de OpenRouter (https://openrouter.ai/keys) como respaldo.
- Si falla, pedirle **el texto exacto del mensaje de error** que muestra la app. Los mensajes dicen si la
  clave no es válida, si se agotó el límite, si faltan créditos, si el modelo no existe o si no hay conexión.
- Cosas para revisar con el uso real:
  - que la IA ubique bien los elementos, sin superponerlos;
  - que el modelo sugerido sea razonable;
  - si OpenRouter acepta `response_format` con el modelo gratuito elegido.

### 3.4 Guardar las pruebas automáticas en el repositorio
- Ya hay una: `pruebas/prueba_alinear.py` (Python + Playwright) para guías y selección múltiple.
  Se corre con `python -m http.server 8765` y `python pruebas/prueba_alinear.py`. Falta rehacer las demás.
- Las pruebas con Playwright se escribieron en una carpeta temporal de la sesión y **se perdieron**.
  Rehacerlas dentro del repo, por ejemplo en `pruebas/`. Lo que deben cubrir:
  - editor básico: crear, conectar, mover, deshacer y exportar PNG;
  - las 8 formas y los bordes; las flechas tocan el borde real de cada forma;
  - exportar en todos los formatos (validar el PDF con `pdfinfo`);
  - mover grupos con su contenido;
  - los 8 fondos, el cambio de colores en fondos claros y el PNG transparente;
  - Mis diagramas: migración desde la clave vieja, crear, renombrar, duplicar, borrar e importar;
  - IA simulada con `page.route()`: sin clave, lista de modelos, crear, reintento, respaldo y error.
- Cómo correrlas: levantar un servidor local (`python3 -m http.server 8765`) y, en el entorno de Claude,
  usar `NODE_PATH=$(npm root -g) node pruebas/<archivo>.js`.

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
- Trabajar en la rama de trabajo y **pedir autorización cada vez** antes de copiar a `main`.
  El usuario suele responder "Sí, copialo a main".
- En cada cambio a los archivos de la app, **subir la versión de `CACHE` en `sw.js`** (hoy `diagramas-v10`).
  Si no, el celular sigue mostrando la versión vieja.
- Después de publicar, recordarle: "cierra la app y ábrela dos veces".
- Probar en escritorio (1400×860) y celular (360×740) antes de proponer publicar.
