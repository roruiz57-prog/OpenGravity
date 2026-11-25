"""Versión al pie del menú: en la web, el número de la copia sin conexión; en el APK, fecha y hora del armado."""
import os
import subprocess
import sys

from playwright.sync_api import sync_playwright

from comun import CELULAR, abrir, comprobar, resumen

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def texto_version(pagina):
    pagina.click('#b-menu')
    el = pagina.locator('#version-app')
    el.wait_for(state='visible', timeout=10000)
    return el.inner_text()


def cache_actual():
    with open(os.path.join(REPO, 'sw.js'), encoding='utf-8') as f:
        return f.read().split("CACHE = 'diagramas-v")[1].split("'")[0]


def prueba_web(nav):
    pagina, errores = abrir(nav)
    t = texto_version(pagina)
    comprobar(t == f'Versión web {cache_actual()}', f'web: "{t}"')
    comprobar(not errores, f'web sin errores {errores}')
    pagina.close()


def prueba_apk(nav):
    # Sin la copia sin conexión: si no, version.js puede salir de ahí y no del armado simulado.
    pagina, errores = abrir(nav, viewport=CELULAR, has_touch=True, is_mobile=True, service_workers='block',
                           antes="window.Capacitor = { isNativePlatform: () => true, Plugins: {} };")
    pagina.route('**/js/version.js', lambda r: r.fulfill(body="window.VERSION_APK = '1.0.261125.1530';", content_type='text/javascript'))
    pagina.reload()
    t = texto_version(pagina)
    comprobar(t == 'Versión: APK del 25/11/2026 15:30', f'APK: "{t}"')
    caja = pagina.locator('#version-app').bounding_box()
    comprobar(caja and caja['y'] + caja['height'] <= CELULAR['height'], 'APK: la versión entra en la pantalla del celular')
    pagina.screenshot(path='pruebas/capturas/version-celular.png')
    comprobar(not errores, f'APK sin errores {errores}')
    pagina.close()


def prueba_preparar_www():
    entorno = dict(os.environ, VERSION_APP='1.0.261125.1530')
    r = subprocess.run(['node', 'scripts/preparar-www.mjs'], cwd=REPO, env=entorno, capture_output=True, text=True)
    with open(os.path.join(REPO, 'www', 'js', 'version.js'), encoding='utf-8') as f:
        comprobar(r.returncode == 0 and "'1.0.261125.1530'" in f.read(), 'preparar-www escribe la versión en el APK')
    entorno['VERSION_APP'] = "x'; alert(1); '"
    subprocess.run(['node', 'scripts/preparar-www.mjs'], cwd=REPO, env=entorno, capture_output=True)
    with open(os.path.join(REPO, 'www', 'js', 'version.js'), encoding='utf-8') as f:
        comprobar(f.read().strip() == "window.VERSION_APK = '';", 'una versión con formato raro se ignora')


with sync_playwright() as p:
    nav = p.chromium.launch()
    prueba_web(nav)
    prueba_apk(nav)
    nav.close()
prueba_preparar_www()
sys.exit(resumen())
