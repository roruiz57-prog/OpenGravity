"""Mis diagramas: migración desde la versión de un solo diagrama, crear, abrir, renombrar, duplicar,
borrar, guardar archivo e importar.

Uso: python pruebas/correr_todas.py   (o con el servidor ya levantado: python pruebas/prueba_biblioteca.py)
"""
import json
import sys

from playwright.sync_api import sync_playwright

from comun import CELULAR, ESCRITORIO, URL, abrir, caja, comprobar, descargar, diagrama, guardado, indice, resumen


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


def subir(pagina, datos, nombre='respaldo.json'):
    pagina.set_input_files('#archivo', files=[{'name': nombre, 'mimeType': 'application/json', 'buffer': datos}])
    pagina.wait_for_timeout(300)


def respaldo(nav, viewport):
    primero = diagrama([caja('a', 0, 0, title='PRIMERO')], nombre='Primero')
    pagina, errores = abrir(nav, primero, viewport=viewport)
    otro = diagrama([caja('b', 0, 0, title='OTRO')], nombre='Otro')
    copia_igual = diagrama([caja('a', 0, 0, title='PRIMERO')], nombre='Primero (copia)')
    pagina.evaluate("""([otro, copia]) => {
        const ind = JSON.parse(localStorage.getItem('opengravity.biblioteca.v1'));
        ind.push({ id: 'otro', name: otro.name, updated: 1000 }, { id: 'copia', name: copia.name, updated: 2000 });
        localStorage.setItem('opengravity.biblioteca.v1', JSON.stringify(ind));
        localStorage.setItem('opengravity.diagrama.otro', JSON.stringify(otro));
        localStorage.setItem('opengravity.diagrama.copia', JSON.stringify(copia));
        localStorage.setItem('opengravity.ia.v1', JSON.stringify({ claveGemini: 'CLAVE-SECRETA-DE-PRUEBA' }));
    }""", [otro, copia_igual])
    pagina.reload()
    pagina.wait_for_timeout(300)
    pagina.click('#b-menu')  # en el celular el nombre del diagrama no se muestra: se entra por el menú
    pagina.click('[data-accion="biblioteca"]')

    nombre, datos = descargar(pagina, lambda: pagina.click('[data-bib="respaldar"]'))
    archivo = json.loads(datos)
    comprobar(nombre.startswith('OpenGravity-respaldo-') and len(archivo['diagramas']) == 3, f'respaldo: guarda los 3 ({nombre})')
    comprobar(b'CLAVE-SECRETA' not in datos and b'claveGemini' not in datos, 'respaldo: no incluye las claves de IA')

    subir(pagina, datos)
    comprobar(len(indice(pagina)) == 3 and '3 ya estaban' in pagina.inner_text('#aviso'), 'recuperar sin cambios: no duplica')

    menu_de(pagina, 'Otro', 'borrar')
    pagina.click('#modal-si')
    menu_de(pagina, 'Primero (copia)', 'borrar')
    pagina.click('#modal-si')
    subir(pagina, datos)
    nombres = sorted(x['name'] for x in indice(pagina))
    comprobar(nombres == ['Otro', 'Primero', 'Primero (copia)'], f'recuperar: vuelven los borrados, aun con igual contenido {nombres}')
    comprobar(guardado(pagina)['nodes'][0]['title'] == 'PRIMERO', 'recuperar: no cambia el diagrama abierto')
    recuperado = next(x for x in indice(pagina) if x['name'] == 'Otro')
    comprobar(recuperado['updated'] == 1000, 'recuperar: conserva la fecha')

    pagina.evaluate("""id => {
        const d = JSON.parse(localStorage.getItem('opengravity.diagrama.' + id));
        d.nodes[0].title = 'CAMBIADO';
        localStorage.setItem('opengravity.diagrama.' + id, JSON.stringify(d));
    }""", recuperado['id'])
    subir(pagina, datos)
    nombres = [x['name'] for x in indice(pagina)]
    comprobar('Otro (2)' in nombres and len(nombres) == 4, f'mismo nombre y otro contenido: agrega sin pisar {nombres}')
    comprobar(guardado(pagina, recuperado['id'])['nodes'][0]['title'] == 'CAMBIADO', 'no pisa el que ya estaba')
    subir(pagina, datos)
    comprobar(len(indice(pagina)) == 4, 'recuperar otra vez: no vuelve a duplicar')

    subir(pagina, b'{"tipo": "opengravity-respaldo", "diagramas": "roto"}')
    comprobar(len(indice(pagina)) == 4 and 'no es un diagrama' in pagina.inner_text('#aviso'), 'respaldo roto: avisa y no agrega')
    parcial = json.dumps({'tipo': 'opengravity-respaldo', 'diagramas': [None, {'name': 'Malo', 'doc': {'nodes': 'x'}}]}).encode()
    subir(pagina, parcial)
    comprobar(len(indice(pagina)) == 4 and '2 dañados' in pagina.inner_text('#aviso'), 'entradas dañadas: las cuenta y no las agrega')

    boton = pagina.locator('[data-bib="respaldar"]').bounding_box()
    comprobar(boton is not None and boton['x'] >= 0 and boton['x'] + boton['width'] <= viewport['width'], 'el botón Respaldar entra en pantalla')
    comprobar(not errores, f'respaldo: sin errores en la consola {errores}')
    pagina.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        nav = p.chromium.launch()
        migracion(nav)
        operaciones(nav)
        respaldo(nav, ESCRITORIO)
        respaldo(nav, CELULAR)
        nav.close()
    sys.exit(resumen())
