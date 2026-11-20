"""Color de varias formas a la vez y contraste de los colores claros sobre fondos claros."""
import sys

from playwright.sync_api import sync_playwright

from comun import CELULAR, abrir, caja, comprobar, diagrama, flecha, nodos, resumen

CLARO = {'type': 'solid', 'c1': '#ffffff', 'c2': '#ffffff', 'stars': False, 'pattern': 'none'}


def luminancia(h):
    v = int(h.lstrip('#'), 16)
    def canal(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * canal(v >> 16 & 255) + 0.7152 * canal(v >> 8 & 255) + 0.0722 * canal(v & 255)


def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def centro(pagina, id_nodo):
    # La app redibuja el lienzo seguido: si la forma se reemplazó justo al medirla, esperar y volver a medir.
    for _ in range(20):
        b = pagina.locator(f'[data-node="{id_nodo}"]').first.bounding_box()
        if b:
            return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
        pagina.wait_for_timeout(100)
    raise RuntimeError(f'no encuentro la forma {id_nodo} en pantalla')


def color_titulo(pagina, texto):
    return pagina.evaluate("""t => [...document.querySelectorAll('#lienzo text')].find(e => e.textContent === t).getAttribute('fill')""", texto)


def prueba_varias_escritorio(navegador):
    d = diagrama([caja('a', 0, 0), caja('b', 300, 0),
                  caja('t', 0, 200, type='text', title='Texto', fill='none', color='#7fe3ff')])
    pagina, errores = abrir(navegador, d)
    pagina.mouse.click(*centro(pagina, 'a'))
    for i in ('b', 't'):
        x, y = centro(pagina, i)
        pagina.keyboard.down('Shift'); pagina.mouse.click(x, y); pagina.keyboard.up('Shift')
    panel = pagina.locator('#panel')
    comprobar('3 formas elegidas' in panel.inner_text().lower(), 'escritorio: panel de 3 elegidas')
    comprobar(panel.locator('.muestra[data-grupo="p-color"]').count() == 8, 'hay muestras de color en el panel de varias')
    comprobar('(solo las formas)' in panel.inner_text().lower(), 'el relleno avisa que va solo a las formas')
    comprobar(panel.locator('.muestra.activa[data-grupo="p-color"]').count() == 0, 'con colores distintos no se marca ninguno')

    panel.locator('.muestra[data-grupo="p-color"][data-color="#ff6b9a"]').click()
    n = nodos(pagina)
    comprobar(all(n[i]['color'] == '#ff6b9a' for i in 'abt'), 'cambia el color de las 3')
    panel.locator('.muestra[data-grupo="p-relleno"][data-color="#7a1f4a"]').click()
    n = nodos(pagina)
    comprobar(n['a']['fill'] == n['b']['fill'] == '#7a1f4a', 'cambia el relleno de las formas')
    comprobar(n['t']['fill'] == 'none', 'el texto no recibe relleno')
    comprobar('3 formas elegidas' in panel.inner_text().lower(), 'la selección sigue después de cambiar el color')

    pagina.keyboard.press('Control+z')
    n = nodos(pagina)
    comprobar(n['a']['fill'] == n['b']['fill'] == '#1f78c8', 'deshacer devuelve el relleno de las dos en un paso')
    comprobar(n['a']['color'] == '#ff6b9a', 'deshacer no toca el cambio anterior')
    pagina.screenshot(path='pruebas/capturas/color-varias-escritorio.png')
    comprobar(not errores, f'escritorio sin errores {errores}')
    pagina.close()


def prueba_varias_celular(navegador):
    d = diagrama([caja('a', 0, 0), caja('b', 250, 0)])
    pagina, errores = abrir(navegador, d, viewport=CELULAR, has_touch=True, is_mobile=True)
    x, y = centro(pagina, 'a'); pagina.touchscreen.tap(x, y)
    pagina.wait_for_timeout(200)
    pagina.locator('#p-varias').click()
    x, y = centro(pagina, 'b'); pagina.touchscreen.tap(x, y)
    pagina.wait_for_timeout(200)
    panel = pagina.locator('#panel')
    comprobar('2 formas elegidas' in panel.inner_text().lower(), 'celular: 2 elegidas con "Elegir varias"')
    m = panel.locator('.muestra[data-grupo="p-color"][data-color="#7dffb2"]')
    m.scroll_into_view_if_needed(); m.click()
    n = nodos(pagina)
    comprobar(n['a']['color'] == n['b']['color'] == '#7dffb2', 'celular: cambia el color de las dos')
    comprobar(panel.locator('.muestra.activa[data-grupo="p-color"][data-color="#7dffb2"]').count() == 1, 'celular: marca el color en común')
    pagina.screenshot(path='pruebas/capturas/color-varias-celular.png')
    comprobar(not errores, f'celular sin errores {errores}')
    pagina.close()


def prueba_contraste(navegador):
    d = diagrama([caja('t', 0, 0, type='text', title='CONTEXTO', fill='none', color='#7fe3ff', w=300),
                  caja('g', 0, 200, w=300, h=150, type='group', title='GRUPO', fill='none', color='#ffe36e', border='dashed'),
                  caja('f', 400, 0, title='CON RELLENO', color='#7fe3ff', w=300),
                  caja('h', 400, 200, title='SIN RELLENO', color='#7dffb2', fill='none', w=300)],
                 [flecha('e', 't', 'f', color='#7fe3ff')], bg=CLARO)
    pagina, errores = abrir(navegador, d)
    for titulo in ('CONTEXTO', 'GRUPO', 'SIN RELLENO'):
        c = color_titulo(pagina, titulo)
        comprobar(contraste(c, '#ffffff') >= 3, f'fondo claro: "{titulo}" se distingue ({c}, {contraste(c, "#ffffff"):.1f}:1)')
    comprobar(color_titulo(pagina, 'CON RELLENO') == '#7fe3ff', 'el título sobre relleno azul no se oscurece')
    trazo = pagina.evaluate("""() => [...document.querySelectorAll('#lienzo path[stroke-width="3"]')].map(p => p.getAttribute('stroke'))[0]""")
    comprobar(trazo and contraste(trazo, '#ffffff') >= 3, f'la flecha celeste se distingue ({trazo})')
    n = nodos(pagina)
    comprobar(n['t']['color'] == '#7fe3ff', 'el color guardado no cambia')
    pagina.screenshot(path='pruebas/capturas/contraste-claro.png')

    # Volver a un fondo oscuro: se ve el celeste original.
    pagina.evaluate("""() => {
        const id = localStorage.getItem('opengravity.abierto');
        const d = JSON.parse(localStorage.getItem('opengravity.diagrama.' + id));
        d.bg = { type: 'solid', c1: '#1d4f96', c2: '#1d4f96', stars: false, pattern: 'none' };
        localStorage.setItem('opengravity.diagrama.' + id, JSON.stringify(d));
    }""")
    pagina.reload(); pagina.wait_for_timeout(400)
    comprobar(color_titulo(pagina, 'CONTEXTO') == '#7fe3ff', 'en fondo oscuro se ve el color original')
    comprobar(not errores, f'contraste sin errores {errores}')
    pagina.close()


with sync_playwright() as p:
    nav = p.chromium.launch()
    prueba_varias_escritorio(nav)
    prueba_varias_celular(nav)
    prueba_contraste(nav)
    nav.close()
sys.exit(resumen())
