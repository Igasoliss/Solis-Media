"""Arma la página índice de las demos: python3 demos/indice.py ../../demos/index.html"""
import json, glob, html, os, sys, base64
AQUI = os.path.dirname(os.path.abspath(__file__))
ORDEN = ['barberia', 'peluqueria', 'unas', 'masajes', 'matrona', 'armonizacion-facial', 'kinesiologa',
         'enfermera', 'medico', 'psicologa', 'nutricionista', 'podologa']
items = [json.load(open(f)) for f in glob.glob(os.path.join(AQUI, 'rubros', '*.json'))]
items.sort(key=lambda c: ORDEN.index(c['id']) if c['id'] in ORDEN else 99)

def foto(c):
    b = c['business']
    if b.get('photo_file'):
        return 'data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(AQUI, 'rubros', b['photo_file']), 'rb').read()).decode()
    return b.get('photo', '').replace('w=320&h=320', 'w=160&h=160')

cards = ''.join(
    f'''<a class="c" href="{c['id']}/" style="--ink:{c['business']['ink']};--ac:{c['business']['accent']};--bg:{c['business']['bg']}"><img src="{html.escape(foto(c))}" alt="" loading="lazy"><span><b>{html.escape(c['rubro'])}</b><small>{html.escape(c['business']['name'])}</small></span><i>→</i></a>'''
    for c in items)

open(sys.argv[1], 'w').write(f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demos de agenda online · Solís Media</title><meta name="robots" content="noindex"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;800&family=Cormorant+Garamond:wght@700&display=swap" rel="stylesheet"><style>body{{margin:0;background:#FFF8EE;font-family:Poppins,system-ui,sans-serif;color:#1A1217}}main{{max-width:780px;margin:0 auto;padding:40px 16px 60px}}.tag{{display:inline-block;background:#E4F062;font-weight:600;padding:4px 14px;border-radius:999px;font-size:14px}}h1{{font-size:clamp(30px,6vw,44px);line-height:1.08;margin:14px 0 8px;color:#4E2145}}p{{color:#6E5A66;margin:0 0 26px}}.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}}.c{{display:flex;align-items:center;gap:14px;background:var(--bg);border:1px solid rgba(0,0,0,.07);border-radius:20px;padding:12px;text-decoration:none;color:var(--ink)}}.c:hover{{box-shadow:0 8px 24px rgba(0,0,0,.08)}}.c img{{width:58px;height:58px;border-radius:18px;object-fit:cover;flex:none;background:var(--ac)}}.c b{{display:block;font-size:15px}}.c small{{font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:17px;color:var(--ink);opacity:.85}}.c i{{margin-left:auto;font-style:normal}}footer{{margin-top:34px;font-size:14px;color:#6E5A66}}footer a{{color:inherit}}</style></head><body><main><span class="tag">Agenda online</span><h1>Elige tu rubro y pruébala</h1><p>Cada demo funciona de verdad: reserva una hora como cliente y luego entra al panel (cualquier clave) para verla. Los datos son de ejemplo y quedan solo en tu teléfono.</p><div class="g">{cards}</div><footer>Desarrollada por <a href="https://solismedia.cl"><b>www.solismedia.cl</b></a></footer></main></body></html>''')
print('ok', len(items))
