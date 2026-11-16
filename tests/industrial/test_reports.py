import copy
import csv
import io
import json
import unittest
from urllib.request import Request,urlopen
from industrial.test_voltage import fixture
from industrial.test_structure import IndustrialHttpTests
from voltcalc.industrial.contracts import create_entity
from voltcalc.industrial.reports import VERSION,build_report,report_request,csv_report,input_digest

def token(p):return dict(projectId=p['id'],inputRevision=p['revision'],domain='reports',version=VERSION)

class ReportTests(unittest.TestCase):
    def test_summary_preserves_every_pending_reason_and_origin(self):
        from industrial.audit_fixture import installation
        p=installation();before=copy.deepcopy(p);r=build_report(p)
        self.assertEqual(p,before)
        full=r['sections'][0]['blocks'][0]['rows']
        summary=next(s for s in r['summarySections'] if s['title'].startswith('Pendências'))['blocks'][0]['rows']
        grouped={reason:origins for origins,reason in summary}
        for origin,reason in full:
            self.assertIn(reason,grouped)
            if ' / ' in origin:
                domain,item=origin.rsplit(' / ',1)
                self.assertIn(domain,grouped[reason]);self.assertIn(item,grouped[reason])
            elif origin.startswith('Corrente '):
                self.assertIn('Corrente:',grouped[reason]);self.assertIn(origin[9:],grouped[reason])
            else:self.assertIn(origin,grouped[reason])
        self.assertLess(len(summary),len(full))
        self.assertEqual(len(r['summarySections'][0]['blocks'][0]['rows']),30)

    def test_summary_pdf_is_compact_and_keeps_all_consumers(self):
        try:
            from pypdf import PdfReader
            import reportlab
        except ImportError:self.skipTest('PDF: dependências ausentes.')
        from industrial.audit_fixture import installation
        from voltcalc.industrial.report_pdf import render_pdf
        p=installation();r=build_report(p);original=copy.deepcopy(r)
        reader=PdfReader(io.BytesIO(render_pdf(r,detail='summary')))
        text='\n'.join(page.extract_text() for page in reader.pages)
        self.assertEqual(r,original)
        self.assertLessEqual(len(reader.pages),20)
        for c in p['consumers']:self.assertIn(c['tag'],text)
        for term in ['Resumo do projeto','Memória completa','Proteção','não verificadas','Transformador','Placa','Versões e rastreabilidade']:
            self.assertIn(term,text)
        self.assertTrue(all('Verificação parcial' in page.extract_text() for page in reader.pages))

    def test_pdf_detail_contract_and_legacy_default(self):
        from unittest.mock import patch
        p=create_entity('Project',name='PDF vazio')
        with patch('voltcalc.industrial.report_pdf.render_pdf',return_value=b'%PDF-test') as render:
            for detail in ('summary','full'):
                result=report_request(dict(project=p,request=token(p),format='pdf',pdfDetail=detail))
                self.assertEqual(result['pdfDetail'],detail)
                self.assertEqual(render.call_args.kwargs,{'detail':detail})
            report_request(dict(project=p,request=token(p),format='pdf'))
            self.assertEqual(render.call_args.kwargs,{'detail':'full'})
        with self.assertRaises(ValueError):
            report_request(dict(project=p,request=token(p),format='pdf',pdfDetail='invalid'))

    def test_motor_catalog_source_and_parameters_are_in_report(self):
        from industrial.test_currents import fixture as motor_fixture
        p,c,m=motor_fixture()
        m['currentPreference']='catalog'
        r=build_report(p)
        motor_section=next(s for s in r['sections'] if s['title']=='Dados e fontes dos motores')
        self.assertEqual(motor_section['blocks'][0]['title'],'Motor / M1')
        text=json.dumps(r,ensure_ascii=False)
        for expected in ['Número de polos','Catálogo','30,4','WEG']:
            self.assertIn(expected,text)
        self.assertEqual(r['status'],'partial')

    def test_recompute_ignore_saved_results_and_keep_input(self):
        p=fixture();before=copy.deepcopy(p);r=build_report(p)
        self.assertEqual(p,before);self.assertEqual(r['status'],'partial');self.assertEqual(r['summary']['consumers'],3)
        saved=create_entity('CalculationResult',domain='currents',targetId=p['consumers'][0]['id'],inputRevision=p['revision'],engineVersion='fake',rulesVersion='fake',status='calculated')
        saved['measurements']=[create_entity('Measurement',code='selected_a',unit='A',value=999999)]
        p['results'].append(saved)
        self.assertEqual(input_digest(p),r['inputDigest']);new=build_report(p)
        self.assertNotIn('999999',json.dumps(new));self.assertEqual(new['summary'],r['summary'])
        p['segments'][0]['length']*=2
        self.assertNotEqual(input_digest(p),r['inputDigest'])
        self.assertGreater(build_report(p)['summary']['maxDrop'],0)

    def test_all_sections_sources_pending_and_positions(self):
        p=fixture();p['nodes'][0]['position']=dict(x=-123,y=456);r=build_report(p)
        self.assertEqual((r['diagram']['nodes'][0]['x'],r['diagram']['nodes'][0]['y']),(-123,456))
        for word in ['Quadros','Circuitos','Trechos físicos','Dimensionamento de condutores','Queda de tensão em regime permanente','Pendências e limites de cobertura']:
            self.assertIn(word,[s['title'] for s in r['sections']])
        text=json.dumps(r,ensure_ascii=False)
        self.assertIn('Fixture sintética',text);self.assertIn('confirme seção/material',text)
        self.assertIn('Comparação de seções',text);self.assertNotIn('Queda de tensão: não calculada (Etapa 8)',text)

    def test_csv_safe_formulas_quotes_and_newlines(self):
        p=fixture();p['name']='=WEBSERVICE("url")';p['description']='Primeira linha; "aspas"\nSegunda linha';r=build_report(p)
        data=csv_report(r);self.assertTrue(data.startswith('\ufeff'))
        rows=list(csv.reader(io.StringIO(data.removeprefix('\ufeff')),delimiter=';'))
        self.assertTrue(all(len(row)==7 for row in rows));self.assertTrue(rows[1][0].startswith("'="))
        self.assertIn('Primeira linha; "aspas"',[row[-1] for row in rows])

    def test_invalid_request_and_empty_project(self):
        p=create_entity('Project',name='Vazio');r=report_request(dict(project=p,request=token(p)))
        self.assertEqual(r['report']['diagram']['nodes'],[]);self.assertIsNone(r['report']['summary']['power'])
        for change in [dict(request={}),dict(format='exe'),dict(project={})]:
            with self.assertRaises(ValueError):report_request(dict(project=p,request=token(p))|change)

    def test_pdf_content_and_long_text(self):
        try:
            from pypdf import PdfReader
            import reportlab
        except ImportError:self.skipTest('PDF: instalar requirements-industrial.txt e pypdf para teste de extração.')
        from voltcalc.industrial.report_pdf import render_pdf
        p=fixture();p['name']='QA São José - revisão';p['description']='Texto longo com acentuação. '*70
        data=render_pdf(build_report(p));reader=PdfReader(io.BytesIO(data));text='\n'.join(page.extract_text() for page in reader.pages)
        self.assertTrue(data.startswith(b'%PDF-'));self.assertGreater(len(reader.pages),5)
        for expected in ['QA São José','Diagrama da instalação','Pendências e limites','Potências, correntes','Dimensionamento de condutores','Queda de tensão','Fixture sintética']:
            self.assertIn(expected,text)
        self.assertTrue(all('Verificação parcial' in page.extract_text() for page in reader.pages))

    def test_pdf_formula_glyphs_use_supported_font(self):
        try:
            from pypdf import PdfReader
            import reportlab
        except ImportError:self.skipTest('PDF: dependências de extração ausentes.')
        from voltcalc.industrial.report_pdf import render_pdf
        r=build_report(create_entity('Project',name='QA símbolos'))
        r['disclaimer']='ΔU = k × Ib × (R cosφ + X senφ); ΣP / η'
        reader=PdfReader(io.BytesIO(render_pdf(r)))
        text=reader.pages[0].extract_text()
        for symbol in 'ΔΣηφ':
            self.assertIn(symbol,text)
        fonts=[f.get_object() for f in reader.pages[0]['/Resources']['/Font'].values()]
        greek=next(f for f in fonts if 'NotoSans' in f['/BaseFont'])
        self.assertIn('/FontFile2',greek['/FontDescriptor'])

class ReportHttpTests(IndustrialHttpTests):
    def test_report_endpoint(self):
        p=fixture();request=Request(self.url+'/api/industrial/reports',data=json.dumps(dict(project=p,request=token(p),format='csv')).encode(),headers={'Content-Type':'application/json'})
        with urlopen(request) as response:
            data=json.load(response);self.assertEqual(data['report']['version'],VERSION);self.assertEqual(data['extension'],'csv');self.assertIn('Pendências',data['content'])
