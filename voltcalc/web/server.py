"""Servidor local VoltCalc: python server.py --open (somente biblioteca padrão)."""
import argparse
import csv
import json
import mimetypes
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from voltcalc.calculations.sizing import TABLES
from voltcalc.web.api import GET_ROUTES, POST_ROUTES, get_payload, post_payload
from voltcalc.web.assets import ASSETS, ALIASES


class Handler(BaseHTTPRequestHandler):
    def send(self, status, content, content_type='application/json; charset=utf-8'):
        if not isinstance(content, bytes):
            content = content.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(content)

    def json(self, status, payload):
        self.send(status, json.dumps(payload, ensure_ascii=False, allow_nan=False))

    def do_GET(self):
        route = urlsplit(self.path).path
        if route in GET_ROUTES:
            return self.json(200, get_payload(route))
        if route == '/tables.js':
            return self.send(200, 'window.NBR1997=' + json.dumps(TABLES, ensure_ascii=False) + ';', 'text/javascript; charset=utf-8')
        if route in ALIASES:
            self.send_response(302)
            self.send_header('Location', ALIASES[route])
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        asset = ASSETS.get(route)
        if asset is None or not asset.is_file():
            return self.json(404, {'error': 'Arquivo não encontrado.'})
        mime = 'text/javascript' if asset.suffix == '.js' else (mimetypes.guess_type(asset.name)[0] or 'application/octet-stream')
        self.send(200, asset.read_bytes(), mime + ('; charset=utf-8' if mime.startswith('text/') else ''))

    def do_POST(self):
        route = urlsplit(self.path).path
        if route not in POST_ROUTES:
            return self.json(404, {'error': 'Rota não encontrada.'})
        origin = self.headers.get('Origin')
        if origin and origin not in (f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'):
            return self.json(403, {'error': 'Origem não permitida.'})
        if self.headers.get_content_type() != 'application/json':
            return self.json(415, {'error': 'Envie application/json.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4_000_000:
                return self.json(413, {'error': 'Corpo vazio ou maior que 4 MB.'})
            payload = json.loads(self.rfile.read(length), parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Número inválido.')))
            self.json(200, post_payload(route, payload))
        except (ValueError, TypeError, KeyError, OverflowError, RecursionError, csv.Error) as exc:
            self.json(400, {'error': str(exc) or 'Dados inválidos.'})


def main():
    parser = argparse.ArgumentParser(description='VoltCalc — servidor local Python')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--open', action='store_true', help='Abrir o site no navegador')
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as exc:
        parser.exit(1, f'Não foi possível iniciar: {exc}\nTente --port 8001.\n')
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'VoltCalc Python em {url}\nUse Ctrl+C para encerrar.', flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
