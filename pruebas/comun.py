"""Herramientas compartidas por las pruebas automáticas (Playwright + Python, sin otras dependencias)."""
import json
import struct
import zlib

URL = 'http://localhost:8765/index.html'
ESCRITORIO = {'width': 1400, 'height': 860}
CELULAR = {'width': 360, 'height': 740}

fallas = []


def comprobar(condicion, texto):
    print(('OK   ' if condicion else 'FALLA') + ' ' + texto)
    if not condicion:
        fallas.append(texto)
    return condicion


def resumen():
    print('\n' + ('TODO BIEN' if not fallas else f'{len(fallas)} FALLA(S)'))
    return 1 if fallas else 0


def caja(i, x, y, w=200, h=80, **extra):
    n = {'id': i, 'type': 'box', 'shape': 'rect', 'x': x, 'y': y, 'w': w, 'h': h, 'title': '', 'subtitle': '',
         'color': '#ffffff', 'fill': '#1f78c8', 'titleSize': 28, 'subSize': 16, 'glow': False, 'border': 'solid'}
    n.update(extra)
    return n


def flecha(i, desde, hasta, **extra):
    e = {'id': i, 'from': desde, 'to': hasta, 'label': '', 'style': 'solid', 'arrow': 'end', 'color': '#ffffff'}
    e.update(extra)
    return e


def diagrama(nodos, flechas=(), nombre='Prueba', bg=None):
    return {'version': 1, 'name': nombre,
            'bg': bg or {'type': 'solid', 'c1': '#1d4f96', 'c2': '#1d4f96', 'stars': False, 'pattern': 'none'},
            'nodes': list(nodos), 'edges': list(flechas)}


def abrir(navegador, d=None, viewport=ESCRITORIO, **opciones):
    """Abre la app limpia. Con `d`, ese diagrama queda guardado y abierto (id 'prueba')."""
    pagina = navegador.new_page(viewport=viewport, accept_downloads=True, **opciones)
    errores = []
    pagina.on('pageerror', lambda e: errores.append(str(e)))
    pagina.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    pagina.goto(URL)
    pagina.evaluate("""d => {
        localStorage.clear();
        if (d) {
            localStorage.setItem('opengravity.biblioteca.v1', JSON.stringify([{ id: 'prueba', name: d.name, updated: Date.now() }]));
            localStorage.setItem('opengravity.diagrama.prueba', JSON.stringify(d));
            localStorage.setItem('opengravity.abierto', 'prueba');
        }
    }""", d)
    pagina.reload()
    pagina.wait_for_timeout(400)
    return pagina, errores


def indice(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('opengravity.biblioteca.v1') || '[]'"))


def guardado(pagina, id_diagrama=None):
    """Diagrama guardado (el abierto, si no se indica otro)."""
    id_diagrama = id_diagrama or pagina.evaluate("localStorage.getItem('opengravity.abierto')")
    return json.loads(pagina.evaluate(f"localStorage.getItem('opengravity.diagrama.{id_diagrama}')"))


def nodos(pagina):
    return {n['id']: n for n in guardado(pagina)['nodes']}


def caja_pantalla(pagina, id_nodo):
    return pagina.locator(f'[data-node="{id_nodo}"]').first.bounding_box()


def arrastrar(pagina, x, y, dx, dy, pasos=8):
    pagina.mouse.move(x, y)
    pagina.mouse.down()
    pagina.mouse.move(x + dx, y + dy, steps=pasos)
    pagina.mouse.up()


def descargar(pagina, accion):
    """Ejecuta `accion` y devuelve (nombre, bytes) del archivo descargado."""
    with pagina.expect_download() as info:
        accion()
    d = info.value
    with open(d.path(), 'rb') as f:
        return d.suggested_filename, f.read()


# ---------- Validación de archivos, sin librerías externas ----------
def png_info(datos):
    """(ancho, alto, tipo_de_color, primer_pixel) de un PNG. Sirve para ver si la esquina es transparente."""
    assert datos[:8] == b'\x89PNG\r\n\x1a\n', 'no es PNG'
    pos, idat = 8, b''
    ancho = alto = tipo = None
    while pos < len(datos):
        largo, nombre = struct.unpack('>I4s', datos[pos:pos + 8])
        cuerpo = datos[pos + 8:pos + 8 + largo]
        if nombre == b'IHDR':
            ancho, alto, _, tipo = struct.unpack('>IIBB', cuerpo[:10])
        elif nombre == b'IDAT':
            idat += cuerpo
        pos += 12 + largo
    crudo = zlib.decompress(idat)
    canales = {6: 4, 2: 3}[tipo]
    # En la primera fila, con cualquier filtro, el primer píxel queda igual (no hay vecinos).
    return ancho, alto, tipo, tuple(crudo[1:1 + canales])


def pdf_valido(datos):
    """Revisa que el PDF esté bien armado: cabecera, tabla xref con posiciones correctas y la imagen JPG adentro."""
    texto = datos.decode('latin-1')
    if not texto.startswith('%PDF-') or not texto.rstrip().endswith('%%EOF'):
        return False, 'falta cabecera o final'
    inicio_xref = int(texto[texto.rindex('startxref') + 9:].split()[0])
    if not texto.startswith('xref', inicio_xref):
        return False, 'startxref no apunta a la tabla'
    lineas = texto[inicio_xref:].split('\n')
    cantidad = int(lineas[1].split()[1])
    for k in range(1, cantidad):
        pos = int(lineas[2 + k][:10])
        if not texto.startswith(f'{k} 0 obj', pos):
            return False, f'el objeto {k} no está donde dice la tabla'
    i = texto.index('/Subtype /Image')
    largo = int(texto[texto.index('/Length', i) + 7:].split()[0])
    inicio = texto.index('stream\n', i) + 7
    if datos[inicio:inicio + 2] != b'\xff\xd8' or datos[inicio + largo:inicio + largo + 1] != b'\n':
        return False, 'la imagen JPG adentro no coincide con su largo'
    return True, f'{cantidad - 1} objetos'
