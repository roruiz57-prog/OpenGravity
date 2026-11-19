"""Editor: crear, conectar, mover, deshacer; las 8 formas y bordes; flechas que tocan el borde real;
grupos que arrastran su contenido; fondos; y exportar en todos los formatos (validando los archivos).

Uso: python pruebas/correr_todas.py   (o con el servidor ya levantado: python pruebas/prueba_editor.py)
"""
import re
import sys
import xml.etree.ElementTree as ET

from playwright.sync_api import sync_playwright

from comun import (CELULAR, abrir, arrastrar, caja, caja_pantalla, comprobar, descargar, diagrama, flecha,
                   guardado, indice, nodos, pdf_valido, png_info, resumen)


def editor_basico(nav, viewport, etiqueta):
    pagina, errores = abrir(nav, viewport=viewport)
    pagina.click('#b-menu')
    pagina.click('[data-accion="nuevo"]')
    comprobar(guardado(pagina)['nodes'] == [], f'{etiqueta}: diagrama nuevo vacío')

    for forma in ['round', 'rect']:
        pagina.click('#b-forma')
        pagina.click(f'[data-forma="{forma}"]')
        pagina.keyboard.press('Escape')
    ns = list(nodos(pagina).values())
    comprobar(len(ns) == 2, f'{etiqueta}: se crean 2 formas ({len(ns)})')
    a, b = ns
    # Separarlas: mover la segunda 300 unidades a la derecha arrastrándola.
    r = caja_pantalla(pagina, b['id'])
    k = r['width'] / b['w']
    arrastrar(pagina, r['x'] + 10, r['y'] + 10, 300 * k, 0)
    movida = nodos(pagina)[b['id']]
    comprobar(movida['x'] != b['x'], f'{etiqueta}: mover cambia la posición ({b["x"]} → {movida["x"]})')
    pagina.click('#b-deshacer')
    comprobar(nodos(pagina)[b['id']]['x'] == b['x'], f'{etiqueta}: deshacer la devuelve a su lugar')
    pagina.click('#b-rehacer')
    pagina.click('#b-ajustar')
    pagina.wait_for_timeout(200)

    # Conectar: elegir A y arrastrar su "+" hasta B.
    ra = caja_pantalla(pagina, a['id'])
    pagina.mouse.click(ra['x'] + 5, ra['y'] + 5)
    mas = pagina.locator(f'circle[data-handle="connect"][data-id="{a["id"]}"]').bounding_box()
    rb = caja_pantalla(pagina, b['id'])
    pagina.mouse.move(mas['x'] + mas['width'] / 2, mas['y'] + mas['height'] / 2)
    pagina.mouse.down()
    pagina.mouse.move(rb['x'] + rb['width'] / 2, rb['y'] + 8, steps=8)
    pagina.mouse.up()
    flechas = guardado(pagina)['edges']
    comprobar(len(flechas) == 1 and flechas[0]['from'] == a['id'] and flechas[0]['to'] == b['id'],
              f'{etiqueta}: arrastrar el + crea la flecha')

    pagina.click('#b-exportar')
    nombre, datos = descargar(pagina, lambda: pagina.click('[data-formato="png"]'))
    ancho, alto, _, _ = png_info(datos)
    comprobar(nombre.endswith('.png') and ancho > 300 and alto > 100, f'{etiqueta}: exporta PNG ({ancho}x{alto})')
    comprobar(not errores, f'{etiqueta}: sin errores en la consola {errores}')
    pagina.close()


# Dónde sale la flecha de cada forma si va horizontal hacia la derecha, desde el centro:
# fracción del ancho donde está el borde real a media altura.
BORDE_DERECHO = {'round': 1, 'rect': 1, 'ellipse': 1, 'diamond': 1, 'triangle': 0.75,
                 'hexagon': 1, 'parallelogram': 0.91, 'cylinder': 1}
BORDES = ['solid', 'dashed', 'dotted']


def formas_y_flechas(nav):
    ns, fs = [], []
    for i, forma in enumerate(BORDE_DERECHO):
        y = i * 260
        ns.append(caja(f'f{i}', 0, y, 200, 160, shape=forma, border=BORDES[i % 3]))
        ns.append(caja(f'd{i}', 500, y, 200, 160))
        fs.append(flecha(f'e{i}', f'f{i}', f'd{i}'))
    pagina, errores = abrir(nav, diagrama(ns, fs))
    svg = pagina.inner_html('#lienzo')
    for i, forma in enumerate(BORDE_DERECHO):
        d = pagina.get_attribute(f'[data-edge="e{i}"]', 'd')
        x_ini = float(re.match(r'M([-\d.]+),', d).group(1))
        esperado = 200 * BORDE_DERECHO[forma] + 6  # 6 = separación entre la flecha y el borde
        comprobar(abs(x_ini - esperado) < 1.5, f'flecha sale del borde real de {forma} (x={x_ini:.1f}, esperado {esperado:.1f})')
    rayas = svg.count('stroke-dasharray="12 8"')
    puntos = svg.count('stroke-dasharray="0.1 8"')
    comprobar(rayas >= 3 and puntos >= 2, f'bordes con rayas ({rayas}) y con puntos ({puntos})')
    comprobar(not errores, f'formas: sin errores en la consola {errores}')
    pagina.close()


def grupos(nav):
    g = caja('g', 0, 0, 600, 400, type='group', fill='none', border='dashed', title='GRUPO')
    adentro = caja('c', 100, 100)
    afuera = caja('x', 900, 100)
    pagina, _ = abrir(nav, diagrama([g, adentro, afuera]))
    r = pagina.locator('rect[data-node="g"][pointer-events="stroke"]').bounding_box()
    k = r['width'] / 600
    arrastrar(pagina, r['x'] + 1, r['y'] + r['height'] / 2, 0, 100 * k)
    n = nodos(pagina)
    dy_g, dy_c, dy_x = n['g']['y'], n['c']['y'] - 100, n['x']['y'] - 100
    comprobar(dy_g > 0 and dy_c == dy_g, f'mover el grupo arrastra lo de adentro ({dy_g}, {dy_c})')
    comprobar(dy_x == 0, f'lo de afuera no se mueve ({dy_x})')
    pagina.close()


def fondos(nav):
    pagina, errores = abrir(nav, diagrama([caja('a', 0, 0, color='#ffffff')], bg={
        'type': 'gradient', 'c1': '#1d4f96', 'c2': '#0a2350', 'stars': True, 'pattern': 'none'}))
    pagina.click('#b-fondo')
    claves = pagina.eval_on_selector_all('[data-fondo]', 'bs => bs.map(b => b.dataset.fondo)')
    comprobar(len(claves) == 8, f'hay 8 fondos en la galería ({len(claves)})')
    for clave in claves:
        pagina.click(f'[data-fondo="{clave}"]')
        bg = guardado(pagina)['bg']
        comprobar(pagina.locator(f'[data-fondo="{clave}"].activa').count() == 1, f'fondo {clave}: queda marcado ({bg["c1"]})')
    pagina.click('[data-fondo="noche"]')
    pagina.click('[data-fondo="blanco"]')
    comprobar(nodos(pagina)['a']['color'] == '#16243f', 'fondo claro: lo blanco pasa a azul oscuro')
    pagina.click('[data-fondo="noche"]')
    comprobar(nodos(pagina)['a']['color'] == '#ffffff', 'vuelta a fondo oscuro: vuelve a blanco')
    comprobar(not errores, f'fondos: sin errores en la consola {errores}')
    pagina.close()


def exportar(nav):
    d = diagrama([caja('a', 0, 0, title='UNO'), caja('b', 400, 0, title='DOS', shape='ellipse')], [flecha('e', 'a', 'b', label='va')])
    pagina, errores = abrir(nav, d)

    def bajar(formato, transparente=False):
        pagina.click('#b-exportar')
        if pagina.is_checked('#exp-transparente') != transparente:
            pagina.click('#exp-transparente')
        return descargar(pagina, lambda: pagina.click(f'[data-formato="{formato}"]'))

    _, png = bajar('png')
    _, _, _, pixel = png_info(png)
    comprobar(pixel[3] == 255 if len(pixel) == 4 else True, f'PNG normal: la esquina tiene fondo {pixel}')
    _, png_t = bajar('png', transparente=True)
    _, _, tipo, pixel = png_info(png_t)
    comprobar(tipo == 6 and pixel[3] == 0, f'PNG transparente: la esquina es transparente {pixel}')
    _, jpg = bajar('jpg')
    comprobar(jpg[:3] == b'\xff\xd8\xff', 'JPG válido')
    if pagina.locator('#f-webp:not([hidden])').count():
        _, webp = bajar('webp')
        comprobar(webp[:4] == b'RIFF' and webp[8:12] == b'WEBP', 'WebP válido')
    _, svg = bajar('svg')
    raiz = ET.fromstring(svg)
    comprobar(raiz.tag.endswith('svg') and b'UNO' in svg and b'DOS' in svg, 'SVG válido y con los textos')
    _, svg_t = bajar('svg', transparente=True)
    comprobar(len(svg_t) < len(svg), 'SVG transparente: sin el fondo')
    nombre, pdf = bajar('pdf')
    ok, detalle = pdf_valido(pdf)
    comprobar(nombre.endswith('.pdf') and ok, f'PDF válido ({detalle})')
    comprobar(not errores, f'exportar: sin errores en la consola {errores}')
    pagina.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        nav = p.chromium.launch()
        editor_basico(nav, {'width': 1400, 'height': 860}, 'escritorio')
        editor_basico(nav, CELULAR, 'celular')
        formas_y_flechas(nav)
        grupos(nav)
        fondos(nav)
        exportar(nav)
        nav.close()
    sys.exit(resumen())
