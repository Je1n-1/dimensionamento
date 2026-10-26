"""API routing and payload validation, independent from HTTP transport."""
from voltcalc.calculations.sizing import calculate
from voltcalc.calculations.panel import build_panel
from voltcalc.calculations.planning import propose_circuits
from voltcalc.calculations.residential import residential_preview
from voltcalc.importers.csv_import import import_csv
from voltcalc.paths import EXAMPLES

GET_ROUTES = frozenset(('/api/health', '/api/example'))
POST_ROUTES = frozenset(('/api/calculate', '/api/panel', '/api/import-csv', '/api/propose', '/api/residential', '/api/industrial/currents', '/api/industrial/topology'))


def get_payload(route):
    if route == '/api/health':
        return {'status': 'ok', 'engine': 'python', 'version': 3, 'reference': 'NBR 5410:1997'}
    if route == '/api/example':
        return import_csv((EXAMPLES / 'residencia.csv').read_text(encoding='utf-8-sig'),
                          'Residência — 8 circuitos.csv')
    raise ValueError('Rota não encontrada.')


def post_payload(route, payload):
    if not isinstance(payload, dict):
        raise ValueError('Envie um objeto JSON.')
    if route == '/api/industrial/topology':
        from voltcalc.industrial.topology import topology_request
        return topology_request(payload)
    if route == '/api/industrial/currents':
        from voltcalc.industrial.currents import current_request
        return current_request(payload)
    if route == '/api/import-csv':
        return import_csv(payload.get('text'), payload.get('filename', 'Quadro.csv'))
    if route == '/api/residential':
        return residential_preview(payload)
    if route == '/api/propose':
        return propose_circuits(payload)
    if route not in POST_ROUTES:
        raise ValueError('Rota não encontrada.')
    circuits = payload.get('circuits')
    if not isinstance(circuits, list) or not (0 if route == '/api/panel' else 1) <= len(circuits) <= 301:
        raise ValueError('Envie entre 1 e 301 circuitos.')
    if route == '/api/panel':
        return build_panel(circuits, payload.get('supply'))
    return {'results': [calculate(c, payload.get('reactance', 0.08), payload.get('supply')) for c in circuits]}
