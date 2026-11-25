"""Corre todas las pruebas automáticas de la app. Levanta solo el servidor local si hace falta.

Uso (desde la carpeta del repo):  python pruebas/correr_todas.py
Requisitos: Python con Playwright (pip install playwright && python -m playwright install chromium).
"""
import os
import subprocess
import sys
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(AQUI)
PRUEBAS = ['prueba_editor.py', 'prueba_alinear.py', 'prueba_biblioteca.py', 'prueba_ia.py', 'prueba_ia_reintento.py', 'prueba_guardar_como.py', 'prueba_color_contraste.py', 'prueba_flechas.py']


def servidor_listo():
    try:
        return urllib.request.urlopen('http://127.0.0.1:8765/index.html', timeout=2).status == 200
    except OSError:
        return False


servidor = None
if not servidor_listo():
    servidor = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'],
                                cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(20):
        if servidor_listo():
            break
        time.sleep(0.3)

entorno = dict(os.environ, PYTHONIOENCODING='utf-8')
resultados = {}
try:
    for prueba in PRUEBAS:
        print(f'\n===== {prueba} =====', flush=True)
        r = subprocess.run([sys.executable, os.path.join('pruebas', prueba)], cwd=REPO, env=entorno)
        resultados[prueba] = r.returncode == 0
finally:
    if servidor:
        servidor.terminate()

print('\n===== RESUMEN =====')
for prueba, ok in resultados.items():
    print(('OK    ' if ok else 'FALLA ') + prueba)
sys.exit(0 if all(resultados.values()) else 1)
