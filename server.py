"""Servidor local VoltCalc: python server.py --open (somente biblioteca padrão)."""
import argparse
import json
import mimetypes
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from engine import TABLES, calculate

WEB = Path(__file__).parent / 'VoltCalc_Guiado'


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
        if route == '/api/health':
            return self.json(200, {'status': 'ok', 'engine': 'python', 'reference': 'NBR 5410:1997'})
        if route == '/tables.js':
            return self.send(200, 'window.NBR1997=' + json.dumps(TABLES, ensure_ascii=False) + ';', 'text/javascript; charset=utf-8')
        name = 'index.html' if route in ('/', '/VoltCalc_Guiado_Abrir.html') else route.lstrip('/')
        if name not in ('index.html', 'app.js', 'styles.css', 'preview.png'):
            return self.json(404, {'error': 'Arquivo não encontrado.'})
        mime = mimetypes.guess_type(name)[0] or 'application/octet-stream'
        if name.endswith('.js'):
            mime = 'text/javascript'
        self.send(200, (WEB / name).read_bytes(), mime + ('; charset=utf-8' if mime.startswith('text/') else ''))

    def do_POST(self):
        if urlsplit(self.path).path != '/api/calculate':
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
            if not isinstance(payload, dict):
                raise ValueError('Envie um objeto JSON.')
            circuits = payload.get('circuits')
            if not isinstance(circuits, list) or not 1 <= len(circuits) <= 301:
                raise ValueError('Envie entre 1 e 301 circuitos.')
            results = [calculate(c, payload.get('reactance', 0.08)) for c in circuits]
            self.json(200, {'results': results})
        except (ValueError, TypeError, KeyError, OverflowError, RecursionError) as exc:
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
