"""Prueba: si Gemini responde 503 (saturado), la app reintenta sola y muestra el detalle si no puede.

Simula las respuestas de Google con page.route(); no usa ninguna clave real.
Uso: python -m http.server 8765  (en otra terminal) y  python pruebas/prueba_ia_reintento.py
"""
import json
import sys

from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/index.html'
SATURADO = {'error': {'code': 503, 'message': 'The model is overloaded. Please try again later.', 'status': 'UNAVAILABLE'}}
DIAGRAMA = {'name': 'Compra', 'nodes': [
    {'id': 'a', 'type': 'box', 'x': 0, 'y': 0, 'w': 220, 'h': 110, 'title': 'CARRITO'},
    {'id': 'b', 'type': 'box', 'x': 320, 'y': 0, 'w': 220, 'h': 110, 'title': 'PAGO'}],
    'edges': [{'id': 'e1', 'from': 'a', 'to': 'b'}]}
fallas = []


def comprobar(condicion, texto):
    print(('OK   ' if condicion else 'FALLA') + ' ' + texto)
    if not condicion:
        fallas.append(texto)


def probar(navegador, fallos_antes_de_andar):
    pagina = navegador.new_page(viewport={'width': 1400, 'height': 860})
    llamadas = []

    def responder(ruta):
        llamadas.append(1)
        if len(llamadas) <= fallos_antes_de_andar:
            ruta.fulfill(status=503, content_type='application/json', body=json.dumps(SATURADO))
        else:
            cuerpo = {'candidates': [{'content': {'parts': [{'text': json.dumps(DIAGRAMA)}]}, 'finishReason': 'STOP'}]}
            ruta.fulfill(status=200, content_type='application/json', body=json.dumps(cuerpo))

    pagina.route('**/v1beta/models/*:generateContent*', responder)
    pagina.goto(URL)
    pagina.evaluate("""localStorage.setItem('opengravity.ia.v1', JSON.stringify({
        principal: 'gemini', respaldo: false,
        gemini: { clave: 'clave-falsa-de-prueba', modelo: 'gemini-prueba-flash' },
        openrouter: { clave: '', modelo: '', soloGratis: true } }))""")
    pagina.reload()
    pagina.click('#b-ia')
    pagina.fill('#ia-pedido', 'proceso de compra')
    pagina.click('#ia-generar')
    pagina.wait_for_function("!document.querySelector('#ia-generar') || !document.querySelector('#ia-generar').disabled", timeout=30000)
    estado = pagina.locator('#ia-estado').inner_text()
    pagina.close()
    return len(llamadas), estado


with sync_playwright() as p:
    navegador = p.chromium.launch()

    n, estado = probar(navegador, 2)
    comprobar(n == 3, f'2 errores y luego bien: hace 3 intentos ({n})')
    comprobar('problemas' not in estado, f'2 errores y luego bien: no muestra error ("{estado[:80]}")')

    n, estado = probar(navegador, 99)
    comprobar(n == 3, f'siempre saturado: se rinde a los 3 intentos ({n})')
    comprobar('overloaded' in estado and 'otro modelo' in estado, f'siempre saturado: muestra el detalle ("{estado[:140]}")')

    navegador.close()

print('\n' + ('TODO BIEN' if not fallas else f'{len(fallas)} FALLA(S)'))
sys.exit(1 if fallas else 0)
