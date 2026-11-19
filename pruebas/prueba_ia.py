"""IA con respuestas simuladas (sin claves reales): sin clave, lista de modelos, crear, modificar y deshacer,
reintento si la respuesta no es JSON, proveedor de respaldo y error de los dos.
Los casos de saturación, demora y límite están en prueba_ia_reintento.py.

Uso: python pruebas/correr_todas.py   (o con el servidor ya levantado: python pruebas/prueba_ia.py)
"""
import json
import re
import sys

from playwright.sync_api import sync_playwright

from comun import abrir, caja, comprobar, diagrama, guardado, indice, resumen

NUEVO = {'name': 'Compra', 'nodes': [
    {'id': 'c', 'type': 'box', 'x': 0, 'y': 0, 'w': 220, 'h': 110, 'title': 'CARRITO'},
    {'id': 'p', 'type': 'box', 'x': 320, 'y': 0, 'w': 220, 'h': 110, 'title': 'PAGO'}],
    'edges': [{'id': 'e1', 'from': 'c', 'to': 'p'}]}
MODELOS_GEMINI = ['gemini-9.0-flash-lite', 'gemini-9.0-flash']


def respuesta_gemini(texto):
    return {'candidates': [{'content': {'parts': [{'text': texto}]}, 'finishReason': 'STOP'}]}


def preparar(nav, ajustes=None, d=None, gemini=None, openrouter=None):
    """`gemini(n, cuerpo)` y `openrouter(n, cuerpo)` devuelven (estado, cuerpo) para la llamada número n."""
    pagina, errores = abrir(nav, d or diagrama([caja('a', 0, 0, title='ORIGINAL')], nombre='Abierto'))
    llamadas = {'gemini': [], 'openrouter': []}

    def lista_gemini(ruta):
        modelos = [{'name': 'models/' + m, 'displayName': m, 'supportedGenerationMethods': ['generateContent']} for m in MODELOS_GEMINI]
        ruta.fulfill(status=200, content_type='application/json', body=json.dumps({'models': modelos}))

    def generar_gemini(ruta):
        cuerpo = json.loads(ruta.request.post_data)
        llamadas['gemini'].append(cuerpo)
        estado, datos = gemini(len(llamadas['gemini']), cuerpo)
        ruta.fulfill(status=estado, content_type='application/json', body=json.dumps(datos))

    def chat_openrouter(ruta):
        cuerpo = json.loads(ruta.request.post_data)
        llamadas['openrouter'].append(cuerpo)
        estado, datos = openrouter(len(llamadas['openrouter']), cuerpo)
        ruta.fulfill(status=estado, content_type='application/json', body=json.dumps(datos))

    pagina.route(re.compile(r'.*/v1beta/models\?.*'), lista_gemini)
    pagina.route('**/v1beta/models/*:generateContent*', generar_gemini)
    pagina.route('**/api/v1/chat/completions', chat_openrouter)
    if ajustes:
        pagina.evaluate("a => localStorage.setItem('opengravity.ia.v1', JSON.stringify(a))", ajustes)
    return pagina, errores, llamadas


def generar(pagina, pedido='proceso de compra', modificar=False):
    pagina.click('#b-ia')
    pagina.fill('#ia-pedido', pedido)
    pagina.check('input[name="ia-modo"][value="modificar"]' if modificar else 'input[name="ia-modo"][value="nuevo"]')
    pagina.click('#ia-generar')
    pagina.wait_for_function("!document.querySelector('#ia-generar').disabled", timeout=60000)
    return pagina.inner_text('#ia-estado')


SOLO_GEMINI = {'principal': 'gemini', 'respaldo': False,
               'gemini': {'clave': 'clave-falsa', 'modelo': 'gemini-9.0-flash-lite'},
               'openrouter': {'clave': '', 'modelo': '', 'soloGratis': True}}
CON_RESPALDO = {'principal': 'gemini', 'respaldo': True,
                'gemini': {'clave': 'clave-falsa', 'modelo': 'gemini-9.0-flash-lite'},
                'openrouter': {'clave': 'clave-falsa-or', 'modelo': 'modelo/prueba:free', 'soloGratis': True}}
BIEN = lambda n, c: (200, respuesta_gemini(json.dumps(NUEVO)))


def sin_clave(nav):
    pagina, errores, _ = preparar(nav)
    pagina.click('#b-ia')
    pagina.fill('#ia-pedido', 'algo')
    pagina.click('#ia-generar')
    comprobar(not pagina.is_hidden('#ia-config') and 'clave' in pagina.inner_text('#ia-config-estado'),
              'sin clave: abre Ajustes de IA y pide una')
    comprobar(not errores, f'sin clave: sin errores {errores}')
    pagina.close()


def lista_de_modelos(nav):
    pagina, errores, _ = preparar(nav)
    pagina.click('#b-menu')
    pagina.click('[data-accion="ia-ajustes"]')
    pagina.fill('#ia-clave-gemini', 'clave-falsa')
    pagina.click('#ia-cargar-gemini')
    pagina.wait_for_function("document.querySelectorAll('#ia-modelo-gemini option').length >= 2")
    opciones = pagina.eval_on_selector_all('#ia-modelo-gemini option', 'os => os.map(o => o.value)')
    comprobar(set(MODELOS_GEMINI) <= set(opciones), f'Probar y ver modelos: trae la lista en vivo {opciones}')
    pagina.click('#ia-guardar')
    a = json.loads(pagina.evaluate("localStorage.getItem('opengravity.ia.v1')"))
    comprobar(a['gemini']['clave'] == 'clave-falsa' and a['gemini']['modelo'] in MODELOS_GEMINI, 'Guardar: queda la clave y el modelo en el dispositivo')
    comprobar(not errores, f'lista de modelos: sin errores {errores}')
    pagina.close()


def crear_y_modificar(nav):
    pagina, errores, llamadas = preparar(nav, SOLO_GEMINI, gemini=BIEN)
    estado = generar(pagina)
    ind = indice(pagina)
    abierto = guardado(pagina)
    comprobar(not estado and len(ind) == 2 and abierto['nodes'][0]['title'] == 'CARRITO', f'crear: agrega un diagrama nuevo a Mis diagramas ({len(ind)})')
    comprobar('Diagrama creado' in pagina.inner_text('#aviso'), 'crear: avisa')
    comprobar(llamadas['gemini'][0]['generationConfig']['responseMimeType'] == 'application/json', 'pide la respuesta en JSON')

    pagina.click('#nombre-doc')
    pagina.locator('.tarjeta', has=pagina.locator('.tarjeta-nombre', has_text='Abierto')).locator('[data-abrir]').click()
    estado = generar(pagina, 'agregá un paso', modificar=True)
    d = guardado(pagina)
    comprobar(not estado and len(indice(pagina)) == 2 and d['name'] == 'Abierto' and d['nodes'][0]['title'] == 'CARRITO',
              'modificar: cambia el abierto, conserva el nombre y no crea otro')
    comprobar('ORIGINAL' in json.dumps(llamadas['gemini'][1]), 'modificar: le manda a la IA el diagrama actual')
    pagina.click('#b-deshacer')
    comprobar(guardado(pagina)['nodes'][0]['title'] == 'ORIGINAL', 'modificar se puede deshacer')
    comprobar(not errores, f'crear y modificar: sin errores {errores}')
    pagina.close()


def reintento_formato(nav):
    respuestas = lambda n, c: (200, respuesta_gemini('esto no es un diagrama' if n == 1 else json.dumps(NUEVO)))
    pagina, errores, llamadas = preparar(nav, SOLO_GEMINI, gemini=respuestas)
    estado = generar(pagina)
    segundo = json.dumps(llamadas['gemini'][-1], ensure_ascii=False)
    comprobar(len(llamadas['gemini']) == 2 and 'no era un JSON válido' in segundo and not estado,
              f'respuesta rota: le pide de nuevo y sale bien ({len(llamadas["gemini"])} llamadas)')
    comprobar(not errores, f'reintento: sin errores {errores}')
    pagina.close()


def respaldo_y_error(nav):
    clave_mala = lambda n, c: (400, {'error': {'code': 400, 'message': 'API key not valid.', 'status': 'INVALID_ARGUMENT'}})
    or_bien = lambda n, c: (200, {'choices': [{'message': {'content': json.dumps(NUEVO)}}]})
    pagina, errores, llamadas = preparar(nav, CON_RESPALDO, gemini=clave_mala, openrouter=or_bien)
    estado = generar(pagina)
    comprobar(not estado and len(llamadas['openrouter']) == 1 and 'OpenRouter' in pagina.inner_text('#aviso'),
              'si Gemini falla, usa OpenRouter de respaldo')
    comprobar(llamadas['openrouter'][0]['response_format'] == {'type': 'json_object'}, 'a OpenRouter también le pide JSON')
    pagina.close()

    or_mal = lambda n, c: (402, {'error': {'code': 402, 'message': 'Insufficient credits'}})
    pagina, errores2, _ = preparar(nav, CON_RESPALDO, gemini=clave_mala, openrouter=or_mal)
    estado = generar(pagina)
    comprobar('no es válida' in estado and 'créditos' in estado, f'fallan los dos: explica ambos errores ("{estado[:120]}")')
    comprobar(len(indice(pagina)) == 1, 'fallan los dos: no crea ningún diagrama')
    # Las respuestas fallidas simuladas aparecen como "Failed to load resource": son esperables.
    propios = [e for e in errores + errores2 if 'Failed to load resource' not in e]
    comprobar(not propios, f'respaldo: sin errores de la app {propios}')
    pagina.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        nav = p.chromium.launch()
        sin_clave(nav)
        lista_de_modelos(nav)
        crear_y_modificar(nav)
        reintento_formato(nav)
        respaldo_y_error(nav)
        nav.close()
    sys.exit(resumen())
