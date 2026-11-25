// Copia los archivos de la app a la carpeta www/, que es la que Capacitor mete dentro del APK.
// La app web (Vercel) usa los mismos archivos desde la raíz del repositorio.
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'www');
const archivos = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const a of archivos) cpSync(join(raiz, a), join(destino, a), { recursive: true });
// armar-apk.ps1 pasa la versión (1.0.AAMMDD.HHmm) para que la app la muestre en el menú.
const version = /^[\d.]+$/.test(process.env.VERSION_APP || '') ? process.env.VERSION_APP : '';
writeFileSync(join(destino, 'js', 'version.js'), `window.VERSION_APK = '${version}';\n`);
console.log(`www/ lista con: ${archivos.join(', ')}${version ? ` (versión ${version})` : ''}`);
