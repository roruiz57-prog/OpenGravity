"""Elegir dónde guardar: cuadro "Guardar como" en la PC (Chrome/Edge) y en el APK (simulado)."""
import json
import sys

from playwright.sync_api import sync_playwright

from comun import abrir, caja, comprobar, diagrama, resumen

D = diagrama([caja('a', 100, 100, title='Hola')], nombre='Mi diagrama')

# Reemplaza el cuadro de Windows: anota lo que se pidió y lo que se escribió, o simula que el usuario cancela.
PC = """
window.__guardados = [];
window.__cancelar = false;
window.showSaveFilePicker = async (opciones) => {
  if (window.__cancelar) throw new DOMException('cancelado', 'AbortError');
  return { createWritable: async () => {
    const partes = [];
    return { write: async (b) => partes.push(b), close: async () => {
      const blob = new Blob(partes);
      window.__guardados.push({ opciones, texto: await blob.text(), largo: blob.size });
    } };
  } };
};
"""

# Simula el APK: Capacitor nativo con el componente GuardarComo.
APK = """
window.__guardados = [];
window.__cancelar = false;
window.Capacitor = { isNativePlatform: () => true, Plugins: { GuardarComo: {
  guardar: async (o) => { if (window.__cancelar) return { cancelado: true }; window.__guardados.push(o); return { cancelado: false }; }
} } };
"""


def guardados(pagina):
    return pagina.evaluate('window.__guardados')


def aviso(pagina):
    pagina.wait_for_timeout(300)
    return pagina.inner_text('#aviso')


with sync_playwright() as p:
    nav = p.chromium.launch()

    # --- PC ---
    pagina, errores = abrir(nav, D, antes=PC)
    pagina.keyboard.press('Control+s')
    pagina.wait_for_timeout(500)
    g = guardados(pagina)
    comprobar(len(g) == 1 and g[0]['opciones']['suggestedName'] == 'mi-diagrama.diagrama.json',
              f'PC: Guardar archivo abre el cuadro con el nombre sugerido ({g and g[0]["opciones"]["suggestedName"]})')
    comprobar(bool(g) and json.loads(g[0]['texto'])['nodes'][0]['title'] == 'Hola', 'PC: escribe el diagrama en el archivo elegido')
    comprobar('donde elegiste' in aviso(pagina), 'PC: avisa que guardó donde eligió')

    pagina.click('#b-exportar')
    pagina.click('[data-formato="png"]')
    pagina.wait_for_timeout(1500)
    g = guardados(pagina)
    comprobar(len(g) == 2 and g[1]['opciones']['suggestedName'].endswith('.png') and g[1]['largo'] > 1000
              and g[1]['opciones']['types'][0]['accept'] == {'image/png': ['.png']},
              'PC: exportar PNG abre el cuadro y escribe la imagen')

    pagina.evaluate('window.__cancelar = true')
    pagina.keyboard.press('Control+s')
    comprobar(aviso(pagina) == 'No se guardó' and len(guardados(pagina)) == 2, 'PC: si cancela, avisa "No se guardó"')
    comprobar(not errores, f'PC: sin errores en la consola {errores}')
    pagina.close()

    # --- APK (simulado) ---
    pagina, errores = abrir(nav, D, antes=APK)
    pagina.keyboard.press('Control+s')
    pagina.wait_for_timeout(500)
    g = guardados(pagina)
    comprobar(len(g) == 1 and g[0]['nombre'] == 'mi-diagrama.diagrama.json' and g[0]['tipo'] == 'application/json',
              'APK: Guardar archivo abre el cuadro de Android con nombre y tipo')
    comprobar('donde elegiste' in aviso(pagina), 'APK: avisa que guardó donde eligió')

    pagina.click('#b-exportar')
    pagina.click('[data-formato="jpg"]')
    pagina.wait_for_timeout(1500)
    g = guardados(pagina)
    comprobar(len(g) == 2 and g[1]['nombre'].endswith('.jpg') and g[1]['tipo'] == 'image/jpeg' and len(g[1]['datos']) > 1000,
              'APK: exportar JPG abre el cuadro de Android con la imagen')

    pagina.evaluate('window.__cancelar = true')
    pagina.keyboard.press('Control+s')
    comprobar(aviso(pagina) == 'No se guardó', 'APK: si cancela, avisa "No se guardó"')
    comprobar(not errores, f'APK: sin errores en la consola {errores}')
    pagina.close()
    nav.close()

sys.exit(resumen())
