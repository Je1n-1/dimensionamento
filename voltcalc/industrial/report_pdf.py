"""PDF presentation only. Electrical results are supplied by the report service."""
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from .reports import scalar


def render_pdf(report):
    try:
        import reportlab
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, PageBreak
        from reportlab.graphics.shapes import Drawing, Rect, String, Line
    except ImportError as error:
        raise ValueError('PDF indisponível. Instale: python -m pip install -r requirements-industrial.txt. JSON e CSV continuam disponíveis.') from error
    fontdir=Path(reportlab.__file__).parent/'fonts'
    for name,file in [('VoltReport','Vera.ttf'),('VoltReportBold','VeraBd.ttf')]:
        if name not in pdfmetrics.getRegisteredFontNames():pdfmetrics.registerFont(TTFont(name,str(fontdir/file)))
    navy=colors.HexColor('#082346');blue=colors.HexColor('#075bff');light=colors.HexColor('#eef5ff')
    normal=ParagraphStyle('body',fontName='VoltReport',fontSize=8,leading=11,textColor=navy,spaceAfter=6,splitLongWords=True)
    title=ParagraphStyle('title',parent=normal,fontName='VoltReportBold',fontSize=22,leading=27,spaceAfter=16)
    heading=ParagraphStyle('heading',parent=normal,fontName='VoltReportBold',fontSize=14,leading=18,spaceBefore=12,spaceAfter=10,keepWithNext=True)
    sub=ParagraphStyle('sub',parent=normal,fontName='VoltReportBold',fontSize=10,leading=14,spaceBefore=10,keepWithNext=True)
    cell=ParagraphStyle('cell',parent=normal,spaceAfter=0)
    headcell=ParagraphStyle('headcell',parent=cell,fontName='VoltReportBold',spaceBefore=0,keepWithNext=False)
    def para(text,style=normal):
        value=str(text).replace('\u2011','-').replace('\u2013','-').replace('\u2014','-')
        return Paragraph(escape(value).replace('\n','<br/>'),style)
    def table(columns,rows):
        widths=[165,358] if len(columns)==2 else [523/len(columns)]*len(columns)
        if len(columns)==5:widths=[38,68,56,101,260]
        data=[[para(c,headcell) for c in columns]]+[[para(c,cell) for c in row] for row in rows]
        obj=LongTable(data,colWidths=widths,repeatRows=1,hAlign='LEFT',splitInRow=1)
        obj.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),light),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#fafcff')]),
            ('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#dce6f3')),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
        return obj
    stream=BytesIO();doc=SimpleDocTemplate(stream,pagesize=A4,rightMargin=36,leftMargin=36,topMargin=46,bottomMargin=46,
        title=report['projectName'],author='VoltCalc Industrial',pageCompression=1)
    story=[para('VoltCalc Industrial',sub),para(report['projectName'],title),para('Relatório técnico - verificação parcial',heading),para(report['disclaimer']),
        para(f"Emitido em {report['generatedAt']} (UTC) | Revisão elétrica {report['inputRevision']}"),para('Identificador das entradas (SHA-256): '+report['inputDigest'])]
    s=report['summary']
    story.append(table(['Indicador','Valor'],[['Consumidores / equipamentos',f"{s['consumers']} / {s['equipment']}"],['Quadros / trechos',f"{s['panels']} / {s['segments']}"],
        ['Potência ativa convertida (W)',scalar(s['power'])+f" ({s['powerKnown']} de {s['powerTotal']} registros; sem demanda)"],
        ['Maior ocupação calculada (%)',scalar(s['maxOccupancy'])],['Maior queda completa (%)',scalar(s['maxDrop'])],['Itens pendentes nas análises',str(s['pending'])]]))
    story.extend([PageBreak(),para('Diagrama da instalação',heading),para('Esquemático, sem escala física. Posições gráficas preservadas. Comprimentos são os valores cadastrados; a tabela identifica todas as conexões. Em grafos extensos, use o mapa interativo para ampliar.')])
    nodes=report['diagram']['nodes'];edges=report['diagram']['edges'];index={n['id']:n for n in nodes}
    if nodes:
        xmin=min(n['x'] for n in nodes)-25;ymin=min(n['y'] for n in nodes)-25
        xmax=max(n['x'] for n in nodes)+205;ymax=max(n['y'] for n in nodes)+105
        scale=min(523/(xmax-xmin),330/(ymax-ymin))
        drawing_height=(ymax-ymin)*scale+20
        drawing=Drawing(523,drawing_height)
        def pos(n):return ((n['x']-xmin)*scale,drawing_height-10-(n['y']-ymin+80)*scale)
        for e in edges:
            if e['fromId'] not in index or e['toId'] not in index:continue
            x,y=pos(index[e['fromId']]);u,v=pos(index[e['toId']]);x+=180*scale;y+=40*scale;v+=40*scale
            middle=(x+u)/2 if u>=x else max(x,u)+35*scale
            for a,b,c,d in [(x,y,middle,y),(middle,y,middle,v),(middle,v,u,v)]:drawing.add(Line(a,b,c,d,strokeColor=blue,strokeWidth=max(.4,scale)))
            drawing.add(String(middle,(y+v)/2+6*scale,(e['tag'][:18]+' / '+scalar(e['length'])+' m'),fontName='VoltReport',fontSize=max(3,8*scale),fillColor=navy,textAnchor='middle'))
        for n in nodes:
            x,y=pos(n);drawing.add(Rect(x,y,180*scale,80*scale,rx=5*scale,fillColor=light,strokeColor=blue,strokeWidth=.6))
            drawing.add(String(x+10*scale,y+45*scale,n['label'][:22],fontName='VoltReportBold',fontSize=max(3,11*scale),fillColor=navy))
            drawing.add(String(x+10*scale,y+22*scale,{'panel':'Quadro','consumer':'Consumidor','origin':'Origem','junction':'Derivação'}.get(n['kind'],'Ponto'),fontName='VoltReport',fontSize=max(3,9*scale),fillColor=navy))
        story.append(drawing)
    else:story.append(para('Nenhum ponto cadastrado. Diagrama pendente.'))
    story.append(table(['Trecho / comprimento físico','Origem > destino'],[[e['tag']+' / '+scalar(e['length'])+' m',index.get(e['fromId'],{}).get('label','Pendente')+' > '+index.get(e['toId'],{}).get('label','Pendente')] for e in edges] or [['Pendente','Sem trechos']]))
    for section in report['sections']:
        story.extend([Spacer(1,14),para(section['title'],heading)])
        if not section['blocks']:story.append(para('Sem registros nesta seção. Nenhuma verificação é presumida.'))
        for b in section['blocks']:story.extend([para(b['title'],sub),table(b['columns'],b['rows']),Spacer(1,8)])
    def footer(canvas,document):
        canvas.saveState();canvas.setFont('VoltReport',7);canvas.setFillColor(navy)
        canvas.drawString(36,25,'VoltCalc Industrial | Verificação parcial | Revisão '+str(report['inputRevision']))
        canvas.drawRightString(A4[0]-36,25,'Página '+str(document.page))
        canvas.setStrokeColor(blue);canvas.line(36,A4[1]-31,A4[0]-36,A4[1]-31);canvas.restoreState()
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return stream.getvalue()
