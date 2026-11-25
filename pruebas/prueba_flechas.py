"""Flechas rectas, curvas y en ángulo recto."""
import re
import sys

from playwright.sync_api import sync_playwright

from comun import CELULAR, abrir, caja, comprobar, descargar, diagrama, flecha, guardado, resumen


def camino(pagina, id_flecha):
    return pagina.locator(f'[data-edge="{id_flecha}"]').get_attribute('d')


def puntos(d):
    return [(float(x), float(y)) for x, y in re.findall(r'(-?[\d.]+),(-?[\d.]+)', d)]


def ruta(pagina, id_flecha):
    return {e['id']: e for e in guardado(pagina)['edges']}[id_flecha].get('route')


def organigrama():
    # Jefe arriba, dos abajo; una flecha vieja sin "route" y una curva con etiqueta.
    return diagrama([caja('jefe', 300, 0), caja('a', 0, 250), caja('b', 600, 250), caja('c', 0, 500)],
                    [flecha('e1', 'jefe', 'a', route='elbow', label='manda'), flecha('e2', 'jefe', 'b', route='elbow'),
                     flecha('e3', 'a', 'b', route='curve', label='avisa'), flecha('e4', 'a', 'c')])


def prueba_escritorio(nav):
    pagina, errores = abrir(nav, organigrama())
    p = puntos(camino(pagina, 'e1'))
    comprobar(len(p) == 4, f'en ángulo: 3 tramos ({len(p)} puntos)')
    rectos = all(abs(p[i][0] - p[i + 1][0]) < 0.01 or abs(p[i][1] - p[i + 1][1]) < 0.01 for i in range(len(p) - 1))
    comprobar(rectos, 'en ángulo: todos los tramos son horizontales o verticales')
    comprobar(p[0][1] >= 80 and p[-1][1] <= 250, 'en ángulo: sale por abajo del jefe y entra por arriba del otro')
    comprobar(abs(p[0][0] - 400) < 1 and abs(p[-1][0] - 100) < 1, 'en ángulo: sale y entra por el centro de cada cara')
    comprobar(pagina.locator('#lienzo text', has_text='manda').count() == 1, 'en ángulo: se ve la etiqueta')

    d3 = camino(pagina, 'e3')
    comprobar(' Q' in d3, 'curva: el trazo es curvo')
    comprobar(pagina.locator('#lienzo text', has_text='avisa').count() == 1, 'curva: se ve la etiqueta')
    d4 = camino(pagina, 'e4')
    comprobar(' Q' not in d4 and len(puntos(d4)) == 2, 'una flecha sin trazo elegido sigue recta')
    pagina.screenshot(path='pruebas/capturas/flechas-escritorio.png')

    # Cambiar el trazo desde el panel y deshacer.
    caja_e4 = pagina.locator('[data-edge="e4"]').bounding_box()
    pagina.mouse.click(caja_e4['x'] + caja_e4['width'] / 2, caja_e4['y'] + caja_e4['height'] / 2)
    comprobar(pagina.locator('#p-trazo').count() == 1, 'el panel de la flecha tiene "Trazo"')
    comprobar(pagina.locator('#p-trazo').input_value() == 'straight', 'el panel marca "Recta"')
    pagina.select_option('#p-trazo', 'curve')
    comprobar(ruta(pagina, 'e4') == 'curve', 'elegir "Curva" se guarda')
    comprobar(' Q' in camino(pagina, 'e4'), 'y se dibuja curva')
    pagina.select_option('#p-trazo', 'elbow')
    comprobar(ruta(pagina, 'e4') == 'elbow', 'elegir "En ángulo recto" se guarda')
    p = puntos(camino(pagina, 'e4'))
    comprobar(len(p) == 2 and abs(p[0][0] - p[1][0]) < 0.01, 'en ángulo con las dos alineadas: una sola línea vertical')
    pagina.keyboard.press('Control+z')
    comprobar(ruta(pagina, 'e4') == 'curve', 'deshacer vuelve al trazo anterior')

    # Exportar a SVG conserva las curvas.
    pagina.keyboard.press('Escape')
    pagina.click('#b-exportar')
    nombre, datos = descargar(pagina, lambda: pagina.click('[data-formato="svg"]'))
    texto = datos.decode('utf-8')
    comprobar(nombre.endswith('.svg') and ' Q' in texto, 'el SVG exportado tiene las curvas')
    comprobar(not errores, f'escritorio sin errores {errores}')
    pagina.close()


def prueba_celular(nav):
    pagina, errores = abrir(nav, organigrama(), viewport=CELULAR, has_touch=True, is_mobile=True)
    comprobar(len(puntos(camino(pagina, 'e2'))) == 4, 'celular: se dibuja en ángulo')
    pagina.screenshot(path='pruebas/capturas/flechas-celular.png')
    comprobar(not errores, f'celular sin errores {errores}')
    pagina.close()


def prueba_archivo_raro(nav):
    pagina, errores = abrir(nav, diagrama([caja('a', 0, 0), caja('b', 400, 0)], [flecha('e', 'a', 'b', route='zigzag')]))
    comprobar(' Q' not in camino(pagina, 'e') and len(puntos(camino(pagina, 'e'))) == 2, 'un trazo desconocido se dibuja recto')
    comprobar(not errores, f'archivo raro sin errores {errores}')
    pagina.close()


with sync_playwright() as p:
    nav = p.chromium.launch()
    prueba_escritorio(nav)
    prueba_celular(nav)
    prueba_archivo_raro(nav)
    nav.close()
sys.exit(resumen())
