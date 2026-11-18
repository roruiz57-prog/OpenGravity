# RETOMAR — estado del proyecto y tareas pendientes

> Leer este archivo al empezar un chat nuevo. Junto con `CLAUDE.md` (decisiones, estructura del
> código y formato de los diagramas) alcanza para seguir sin la conversación anterior.
> Última actualización: 18 de noviembre de 2026.

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

### 3.2 App nativa de Android (APK) — LISTA PARA ARMAR, FALTA LA LLAVE DE FIRMA
**Ya está hecho, sin la llave:**
- Proyecto Capacitor 8.6.0 (`package.json`, `capacitor.config.json`, carpeta `android/`), con los íconos de la app.
- `npm run android:sync` copia la app a `www/` y la pasa a `android/`.
- `android/app/build.gradle` firma leyendo **variables de entorno**. No hay llaves ni contraseñas en el repo.
- `.github/workflows/apk.yml` arma el APK en GitHub en cada push a `main` (o a mano desde la pestaña Actions)
  y lo publica en **Releases** como `OpenGravity.apk`. **Sin la llave cargada termina en verde con el aviso
  "Falta la llave de firma" y no arma nada.**
- `.vercelignore` evita que Vercel publique lo del APK.

**Lo que falta: crear la llave EN LA PC DEL USUARIO** (decisión del usuario: que nunca pase por la nube de
Claude ni quede en el repo). En su PC, con el repo clonado y Claude Code abierto, pedir:
1. Comprobar que haya Java (`keytool -help`). Si no hay, instalar Temurin 21 (adoptium.net) o usar el de Android Studio.
2. Crear la llave **fuera de la carpeta del repositorio**, por ejemplo en Documentos. El usuario escribe las
   contraseñas en la terminal; **nunca en el chat**:
   `keytool -genkeypair -v -keystore opengravity.jks -alias opengravity -keyalg RSA -keysize 2048 -validity 10000`
3. Convertirla a texto base64. En Windows PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("opengravity.jks")) | Set-Clipboard`
4. En GitHub → repo OpenGravity → Settings → Secrets and variables → Actions → New repository secret, crear:
   - `ANDROID_KEYSTORE_BASE64`: pegar el texto del paso 3.
   - `ANDROID_KEYSTORE_PASSWORD`: la contraseña del almacén.
   - `ANDROID_KEY_ALIAS`: `opengravity`.
   - `ANDROID_KEY_PASSWORD`: la contraseña de la llave (si no pidió otra, es la misma).
5. Guardar `opengravity.jks` y las contraseñas en el **gestor de contraseñas**, como adjunto o nota segura.
   Después borrar el `.jks` de la PC y **vaciar el portapapeles**.
   **Si se pierde la llave no se puede actualizar el APK** (habría que exportar los diagramas, desinstalar y reinstalar).
6. GitHub → Actions → "APK de Android" → **Run workflow**. Al terminar, el APK queda en **Releases**.
7. En el celular: entrar a GitHub (el repo es privado, hay que iniciar sesión) → Releases → bajar
   `OpenGravity.apk` → permitir "instalar apps de orígenes desconocidos" → instalar.
   Los datos del APK van aparte de los de la app de Chrome: pasar los diagramas con Guardar archivo y
   Abrir archivo, y pegar de nuevo las claves de IA.

**Nunca se probó un armado real del APK.** Puede fallar la primera vez: revisar el registro en Actions.

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
- **Selección múltiple y alinear**: elegir varios elementos para moverlos, borrarlos o cambiarles el color juntos, y alinearlos o repartirlos parejos.
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
- En cada cambio a los archivos de la app, **subir la versión de `CACHE` en `sw.js`** (hoy `diagramas-v9`).
  Si no, el celular sigue mostrando la versión vieja.
- Después de publicar, recordarle: "cierra la app y ábrela dos veces".
- Probar en escritorio (1400×860) y celular (360×740) antes de proponer publicar.
