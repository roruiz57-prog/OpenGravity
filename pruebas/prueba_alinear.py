"""Pruebas de guías magnéticas y selección múltiple (alinear, repartir, mover, borrar).

Uso (desde la carpeta del repo):
    python -m http.server 8765        (en otra terminal)
    python pruebas/prueba_alinear.py
"""
import json
import sys

from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/index.html'
ID = 'prueba'


def diagrama():
    caja = lambda i, x, y: {'id': i, 'type': 'box', 'shape': 'rect', 'x': x, 'y': y, 'w': 200, 'h': 80,
                            'title': '', 'subtitle': '', 'color': '#ffffff', 'fill': '#1f78c8',
                            'titleSize': 28, 'subSize': 16, 'glow': False}
    return {'version': 1, 'name': 'Prueba',
            'bg': {'type': 'solid', 'c1': '#1d4f96', 'c2': '#1d4f96', 'stars': False, 'pattern': 'none'},
            'nodes': [caja('a', 0, 3), caja('b', 400, 300), caja('c', 700, 150)],
            'edges': [{'id': 'e1', 'from': 'a', 'to': 'b', 'label': '', 'style': 'solid', 'arrow': 'end', 'color': '#ffffff'}]}


def abrir(navegador, **opciones):
    pagina = navegador.new_page(**opciones)
    errores = []
    pagina.on('pageerror', lambda e: errores.append(str(e)))
    pagina.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    pagina.goto(URL)
    pagina.evaluate("""([id, d]) => {
        localStorage.clear();
        localStorage.setItem('opengravity.biblioteca.v1', JSON.stringify([{ id, name: d.name, updated: Date.now() }]));
        localStorage.setItem('opengravity.diagrama.' + id, JSON.stringify(d));
        localStorage.setItem('opengravity.abierto', id);
    }""", [ID, diagrama()])
    pagina.reload()
    pagina.wait_for_timeout(500)
    return pagina, errores


def guardado(pagina):
    d = json.loads(pagina.evaluate(f"localStorage.getItem('opengravity.diagrama.{ID}')"))
    return {n['id']: n for n in d['nodes']}, d['edges']


def caja_pantalla(pagina, id_nodo):
    return pagina.locator(f'[data-node="{id_nodo}"]').first.bounding_box()


def escala(pagina):
    return caja_pantalla(pagina, 'a')['width'] / 200


fallas = []


def comprobar(condicion, texto):
    print(('OK   ' if condicion else 'FALLA') + ' ' + texto)
    if not condicion:
        fallas.append(texto)


def prueba_escritorio(navegador):
    pagina, errores = abrir(navegador, viewport={'width': 1400, 'height': 860})
    k = escala(pagina)
    b = caja_pantalla(pagina, 'b')
    sx, sy = b['x'] + 15, b['y'] + 15

    # Guía magnética: A está en y=3, fuera de la grilla. Llevar B a 4 px de pantalla de esa altura → se pega a y=3.
    pagina.mouse.move(sx, sy)
    pagina.mouse.down()
    pagina.mouse.move(sx + 20 * k, sy - 150 * k, steps=4)
    pagina.mouse.move(sx + 20 * k, sy + (-300 + 3) * k + 4, steps=4)
    hay_guia = pagina.locator('[data-guia]').count() > 0
    pagina.screenshot(path='pruebas/capturas/guia-escritorio.png')
    pagina.mouse.up()
    nodos, _ = guardado(pagina)
    comprobar(nodos['b']['y'] == 3, f"guía: B queda a la altura de A (y={nodos['b']['y']})")
    comprobar(hay_guia, 'guía: se dibuja la línea mientras se arrastra')
    comprobar(pagina.locator('[data-guia]').count() == 0, 'guía: desaparece al soltar')

    # Deshacer.
    pagina.keyboard.press('Control+z')
    nodos, _ = guardado(pagina)
    comprobar(nodos['b']['y'] == 300, f"deshacer devuelve B a su lugar (y={nodos['b']['y']})")

    # Lejos de otras formas no se pega: va a la grilla.
    b = caja_pantalla(pagina, 'b')
    sx, sy = b['x'] + 15, b['y'] + 15
    pagina.mouse.move(sx, sy)
    pagina.mouse.down()
    pagina.mouse.move(sx, sy + (-300 - 200) * k + 2, steps=6)
    pagina.mouse.up()
    nodos, _ = guardado(pagina)
    comprobar(nodos['b']['y'] == -200, f"lejos del imán no se pega (y={nodos['b']['y']})")
    pagina.keyboard.press('Control+z')

    # Shift + clic en las tres (empezando sin nada elegido).
    pagina.keyboard.press('Escape')
    for i in ['a', 'b', 'c']:
        r = caja_pantalla(pagina, i)
        pagina.keyboard.down('Shift')
        pagina.mouse.click(r['x'] + 15, r['y'] + 15)
        pagina.keyboard.up('Shift')
    titulo = pagina.locator('#panel h2').inner_text()
    comprobar('3 formas elegidas' in titulo.lower(), f'Shift+clic elige 3 formas ("{titulo.strip()[:20]}")')
    comprobar(pagina.locator('[data-elegida]').count() == 3, 'se marcan las 3 elegidas')
    pagina.screenshot(path='pruebas/capturas/varias-escritorio.png')

    pagina.click('[data-alinear="arriba"]')
    nodos, _ = guardado(pagina)
    comprobar(all(nodos[i]['y'] == 3 for i in 'abc'), 'Alinear arriba: las 3 con y=3')

    pagina.click('#p-repartir-h')
    nodos, _ = guardado(pagina)
    huecos = [nodos['b']['x'] - (nodos['a']['x'] + 200), nodos['c']['x'] - (nodos['b']['x'] + 200)]
    comprobar(abs(huecos[0] - huecos[1]) < 0.01, f'Repartir horizontal: huecos iguales {huecos}')

    pagina.click('[data-alinear="izquierda"]')
    pagina.keyboard.press('Control+z')
    nodos, _ = guardado(pagina)
    comprobar(nodos['c']['x'] != 0, 'deshacer revierte Alinear izquierda')

    # Arrastrar una mueve todas.
    antes = {i: (n['x'], n['y']) for i, n in nodos.items()}
    a = caja_pantalla(pagina, 'a')
    pagina.mouse.move(a['x'] + 15, a['y'] + 15)
    pagina.mouse.down()
    pagina.mouse.move(a['x'] + 15, a['y'] + 15 + 100 * k, steps=6)
    pagina.mouse.up()
    nodos, _ = guardado(pagina)
    dys = {i: nodos[i]['y'] - antes[i][1] for i in 'abc'}
    comprobar(len(set(dys.values())) == 1 and dys['a'] != 0, f'arrastrar una mueve las 3 igual {dys}')

    pagina.click('#p-eliminar')
    nodos, aristas = guardado(pagina)
    comprobar(not nodos and not aristas, 'Eliminar borra las 3 y su flecha')
    comprobar(not errores, f'sin errores en la consola {errores}')
    pagina.close()


def prueba_celular(navegador):
    pagina, errores = abrir(navegador, viewport={'width': 360, 'height': 740}, has_touch=True, is_mobile=True)
    r = caja_pantalla(pagina, 'a')
    pagina.mouse.click(r['x'] + 5, r['y'] + 5)
    pagina.click('#p-varias')
    # El panel tapa la mitad de abajo: subir el dibujo arrastrando el fondo vacío.
    pagina.mouse.move(180, 120)
    pagina.mouse.down()
    pagina.mouse.move(180, -80, steps=6)
    pagina.mouse.up()
    for i in ['b', 'c']:
        r = caja_pantalla(pagina, i)
        pagina.mouse.click(r['x'] + 3, r['y'] + 3)
    titulo = pagina.locator('#panel h2').inner_text()
    comprobar('3 formas elegidas' in titulo.lower(), f'celular: "Elegir varias" suma 3 formas ("{titulo.strip()[:20]}")')
    pagina.screenshot(path='pruebas/capturas/varias-celular.png')
    pagina.click('[data-alinear="medio"]')
    nodos, _ = guardado(pagina)
    medios = {nodos[i]['y'] + 40 for i in 'abc'}
    comprobar(len(medios) == 1, f'celular: Alinear medio deja el mismo centro {medios}')
    pagina.click('#p-listo')
    comprobar(pagina.locator('#p-listo').count() == 0, 'celular: "Listo" termina el modo')
    comprobar(not errores, f'celular: sin errores en la consola {errores}')
    pagina.close()


with sync_playwright() as p:
    navegador = p.chromium.launch()
    prueba_escritorio(navegador)
    prueba_celular(navegador)
    navegador.close()

print('\n' + ('TODO BIEN' if not fallas else f'{len(fallas)} FALLA(S)'))
sys.exit(1 if fallas else 0)
