"""Prueba de cómo la IA maneja los errores de Google, con respuestas simuladas (sin claves reales).

Cubre: reintento si el modelo está saturado (503), cambio automático a otro modelo si sigue saturado,
espera si Google pide unos segundos (429 por minuto), error claro si se acabó la cuota del día, y que
el modelo sugerido de fábrica sea un Flash-Lite.

Uso: python -m http.server 8765  (en otra terminal) y  python pruebas/prueba_ia_reintento.py
"""
import json
import re
import sys
import time

from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/index.html'
ELEGIDO = 'gemini-prueba-flash'
MODELOS = [ELEGIDO, 'gemini-8.0-flash-lite', 'gemini-9.0-flash', 'gemini-9.0-flash-lite',
           'gemini-9.0-flash-lite-preview', 'gemini-9.0-pro']
SATURADO = {'error': {'code': 503, 'message': 'The model is overloaded. Please try again later.', 'status': 'UNAVAILABLE'}}


def limite(segundos):
    return {'error': {'code': 429, 'message': 'Quota exceeded.', 'status': 'RESOURCE_EXHAUSTED',
                      'details': [{'@type': 'type.googleapis.com/google.rpc.RetryInfo', 'retryDelay': f'{segundos}s'}]}}


DIAGRAMA = {'name': 'Compra', 'nodes': [
    {'id': 'a', 'type': 'box', 'x': 0, 'y': 0, 'w': 220, 'h': 110, 'title': 'CARRITO'},
    {'id': 'b', 'type': 'box', 'x': 320, 'y': 0, 'w': 220, 'h': 110, 'title': 'PAGO'}],
    'edges': [{'id': 'e1', 'from': 'a', 'to': 'b'}]}
fallas = []


def comprobar(condicion, texto):
    print(('OK   ' if condicion else 'FALLA') + ' ' + texto)
    if not condicion:
        fallas.append(texto)


def probar(navegador, decidir):
    """`decidir(modelo, numero_de_llamada)` devuelve (estado_http, cuerpo) o None si anda bien."""
    pagina = navegador.new_page(viewport={'width': 1400, 'height': 860})
    llamadas = []

    def generar(ruta):
        modelo = re.search(r'/models/([^:]+):generateContent', ruta.request.url).group(1)
        llamadas.append(modelo)
        falla = decidir(modelo, len(llamadas))
        if falla:
            ruta.fulfill(status=falla[0], content_type='application/json', body=json.dumps(falla[1]))
        else:
            cuerpo = {'candidates': [{'content': {'parts': [{'text': json.dumps(DIAGRAMA)}]}, 'finishReason': 'STOP'}]}
            ruta.fulfill(status=200, content_type='application/json', body=json.dumps(cuerpo))

    def lista(ruta):
        modelos = [{'name': 'models/' + m, 'displayName': m, 'supportedGenerationMethods': ['generateContent']} for m in MODELOS]
        ruta.fulfill(status=200, content_type='application/json', body=json.dumps({'models': modelos}))

    pagina.route('**/v1beta/models/*:generateContent*', generar)
    pagina.route(re.compile(r'.*/v1beta/models\?.*'), lista)
    pagina.goto(URL)
    pagina.evaluate("""m => localStorage.setItem('opengravity.ia.v1', JSON.stringify({
        principal: 'gemini', respaldo: false,
        gemini: { clave: 'clave-falsa-de-prueba', modelo: m },
        openrouter: { clave: '', modelo: '', soloGratis: true } }))""", ELEGIDO)
    pagina.reload()
    pagina.click('#b-ia')
    pagina.fill('#ia-pedido', 'proceso de compra')
    inicio = time.time()
    pagina.click('#ia-generar')
    pagina.wait_for_function("!document.querySelector('#ia-generar').disabled", timeout=90000)
    demora = time.time() - inicio
    estado = pagina.locator('#ia-estado').inner_text()
    aviso = pagina.locator('#aviso').inner_text() if pagina.locator('#aviso').count() else ''
    pagina.close()
    return llamadas, estado, aviso, demora


with sync_playwright() as p:
    navegador = p.chromium.launch()

    llamadas, estado, _, _ = probar(navegador, lambda m, n: (503, SATURADO) if n <= 2 else None)
    comprobar(llamadas == [ELEGIDO] * 3, f'saturado 2 veces: reintenta con el mismo modelo {llamadas}')
    comprobar(not estado, f'saturado 2 veces: termina bien ("{estado[:60]}")')

    llamadas, estado, aviso, _ = probar(navegador, lambda m, n: (503, SATURADO) if m == ELEGIDO else None)
    comprobar(llamadas == [ELEGIDO] * 3 + ['gemini-9.0-flash-lite'], f'elegido siempre saturado: pasa a Flash-Lite más nuevo {llamadas}')
    comprobar(not estado, f'elegido siempre saturado: termina bien ("{estado[:60]}")')
    comprobar('usé gemini-9.0-flash-lite' in aviso, f'avisa qué modelo usó ("{aviso[:120]}")')

    llamadas, estado, _, _ = probar(navegador, lambda m, n: (503, SATURADO))
    comprobar(len(llamadas) == 9 and llamadas[3] == 'gemini-9.0-flash-lite' and llamadas[6] == 'gemini-8.0-flash-lite',
              f'todo saturado: prueba 2 modelos más y se rinde ({len(llamadas)} llamadas)')
    comprobar('overloaded' in estado, f'todo saturado: muestra el detalle ("{estado[:100]}")')

    llamadas, estado, _, demora = probar(navegador, lambda m, n: (429, limite(2)) if n == 1 else None)
    comprobar(len(llamadas) == 2 and not estado, f'límite por minuto: espera y reintenta ({len(llamadas)} llamadas, "{estado[:60]}")')
    comprobar(demora >= 3, f'límite por minuto: esperó lo que pidió Google ({demora:.1f} s)')

    llamadas, estado, _, _ = probar(navegador, lambda m, n: (429, limite(3600)))
    comprobar(len(llamadas) == 1 and 'límite' in estado, f'cuota del día: no insiste y avisa ({len(llamadas)} llamada, "{estado[:70]}")')

    pagina = navegador.new_page()
    pagina.goto(URL)
    lista = [{'id': m} for m in MODELOS]
    sugerido = pagina.evaluate("l => window.IA.modeloSugerido('gemini', l)", lista)
    comprobar(sugerido == 'gemini-9.0-flash-lite', f'modelo sugerido: Flash-Lite estable más nuevo ({sugerido})')
    pagina.close()

    navegador.close()

print('\n' + ('TODO BIEN' if not fallas else f'{len(fallas)} FALLA(S)'))
sys.exit(1 if fallas else 0)
