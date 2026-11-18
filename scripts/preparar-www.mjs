// Copia los archivos de la app a la carpeta www/, que es la que Capacitor mete dentro del APK.
// La app web (Vercel) usa los mismos archivos desde la raíz del repositorio.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'www');
const archivos = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const a of archivos) cpSync(join(raiz, a), join(destino, a), { recursive: true });
console.log(`www/ lista con: ${archivos.join(', ')}`);
