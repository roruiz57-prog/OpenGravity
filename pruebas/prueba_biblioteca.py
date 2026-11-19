"""Mis diagramas: migración desde la versión de un solo diagrama, crear, abrir, renombrar, duplicar,
borrar, guardar archivo e importar.

Uso: python pruebas/correr_todas.py   (o con el servidor ya levantado: python pruebas/prueba_biblioteca.py)
"""
import json
import sys

from playwright.sync_api import sync_playwright

from comun import URL, abrir, caja, comprobar, descargar, diagrama, guardado, indice, resumen


def migracion(nav):
    pagina = nav.new_page()
    pagina.goto(URL)
    viejo = diagrama([caja('a', 0, 0, title='VIEJO')], nombre='Mi diagrama viejo')
    pagina.evaluate("d => { localStorage.clear(); localStorage.setItem('opengravity.diagrama.actual.v1', JSON.stringify(d)); }", viejo)
    pagina.reload()
    pagina.wait_for_timeout(300)
    ind = indice(pagina)
    comprobar(len(ind) == 1 and ind[0]['name'] == 'Mi diagrama viejo', f'migra el diagrama de la versión vieja {[x["name"] for x in ind]}')
    comprobar(pagina.evaluate("localStorage.getItem('opengravity.diagrama.actual.v1')") is None, 'borra la clave vieja después de migrar')
    comprobar(guardado(pagina)['nodes'][0]['title'] == 'VIEJO', 'el diagrama migrado queda abierto')
    pagina.close()


def tarjeta(pagina, nombre):
    return pagina.locator('.tarjeta', has=pagina.locator('.tarjeta-nombre', has_text=nombre))


def menu_de(pagina, nombre, opcion):
    t = tarjeta(pagina, nombre).first
    t.locator('[data-mas]').click()
    t.locator(f'[data-{opcion}]').click()


def operaciones(nav):
    pagina, errores = abrir(nav, diagrama([caja('a', 0, 0, title='PRIMERO')], nombre='Primero'))
    pagina.click('#nombre-doc')
    pagina.click('[data-bib="nuevo"]')
    ind = indice(pagina)
    comprobar(len(ind) == 2, f'crear: hay 2 diagramas ({len(ind)})')
    comprobar(guardado(pagina)['nodes'] == [], 'crear: el nuevo queda abierto y vacío')

    pagina.click('#nombre-doc')
    tarjeta(pagina, 'Primero').locator('[data-abrir]').click()
    comprobar(guardado(pagina)['nodes'][0]['title'] == 'PRIMERO', 'abrir: vuelve al primero')

    pagina.click('#nombre-doc')
    menu_de(pagina, 'Diagrama nuevo', 'renombrar')
    pagina.fill('#modal-entrada', 'Renombrado')
    pagina.click('#modal-si')
    nombres = [x['name'] for x in indice(pagina)]
    comprobar('Renombrado' in nombres and 'Diagrama nuevo' not in nombres, f'renombrar {nombres}')

    menu_de(pagina, 'Primero', 'duplicar')
    nombres = [x['name'] for x in indice(pagina)]
    comprobar('Primero (copia)' in nombres and len(nombres) == 3, f'duplicar {nombres}')
    copia = next(x for x in indice(pagina) if x['name'] == 'Primero (copia)')
    comprobar(guardado(pagina, copia['id'])['nodes'][0]['title'] == 'PRIMERO', 'la copia tiene el mismo contenido')

    menu_de(pagina, 'Renombrado', 'borrar')
    pagina.click('#modal-si')
    nombres = [x['name'] for x in indice(pagina)]
    comprobar('Renombrado' not in nombres and len(nombres) == 2, f'borrar {nombres}')
    pagina.click('#bib-cerrar')

    # Guardar archivo (Ctrl+S) y volver a importarlo.
    nombre, datos = descargar(pagina, lambda: pagina.keyboard.press('Control+s'))
    archivo = json.loads(datos)
    comprobar(nombre.endswith('.diagrama.json') and archivo['nodes'][0]['title'] == 'PRIMERO', f'guardar archivo ({nombre})')
    pagina.set_input_files('#archivo', files=[{'name': 'importado.diagrama.json', 'mimeType': 'application/json', 'buffer': datos}])
    pagina.wait_for_timeout(300)
    nombres = [x['name'] for x in indice(pagina)]
    comprobar(len(nombres) == 3 and 'Primero (2)' in nombres, f'importar agrega uno nuevo sin pisar el nombre {nombres}')
    pagina.set_input_files('#archivo', files=[{'name': 'malo.json', 'mimeType': 'application/json', 'buffer': b'{"hola": 1}'}])
    pagina.wait_for_timeout(300)
    comprobar(len(indice(pagina)) == 3 and 'no es un diagrama' in pagina.inner_text('#aviso'), 'importar un archivo que no es diagrama: avisa y no agrega')

    # Al borrar el que está abierto, se abre otro.
    abierto = pagina.evaluate("localStorage.getItem('opengravity.abierto')")
    nombre_abierto = next(x['name'] for x in indice(pagina) if x['id'] == abierto)
    pagina.click('#nombre-doc')
    menu_de(pagina, nombre_abierto, 'borrar')
    pagina.click('#modal-si')
    otro = pagina.evaluate("localStorage.getItem('opengravity.abierto')")
    comprobar(otro != abierto and any(x['id'] == otro for x in indice(pagina)), 'borrar el abierto: abre otro de la lista')
    comprobar(not errores, f'Mis diagramas: sin errores en la consola {errores}')
    pagina.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        nav = p.chromium.launch()
        migracion(nav)
        operaciones(nav)
        nav.close()
    sys.exit(resumen())
