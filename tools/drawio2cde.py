#!/usr/bin/env python3
"""
drawio2cde.py — Convert a draw.io (.drawio, uncompressed XML) file into
DiagramForge `.cde` files, one per page.

Schema (see Web/SCHEMA.md):
    { "nodes": [ [ID, area, paint], ... ], "links": [ [[from, ends, to], paint], ... ] }

Mapping:
  - vertices -> nodes. drawio cell IDs are reused as node IDs (so links resolve).
  - geometry is resolved to absolute coords by walking the parent-vertex chain,
    then shifted into the canvas with a margin.
  - style -> type (ellipse / rhombus / rect[+radii]) and
    fill / stroke / lineWidth / lineDash.
  - value -> plain-text `html` label (tags stripped; DiagramForge escapes html).
  - edges with BOTH endpoints on kept nodes -> links. Free-floating / one-sided
    edges (and edge labels) are dropped — DiagramForge links are node-to-node only.

Usage:
    python3 tools/drawio2cde.py INPUT.drawio
    python3 tools/drawio2cde.py INPUT.drawio -o OUTDIR --strip 朝日 --strip 社外秘
"""
import argparse
import html as H
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

CANVAS = 4096


def style_dict(s):
    d = {}
    for part in (s or '').split(';'):
        part = part.strip()
        if not part:
            continue
        if '=' in part:
            k, v = part.split('=', 1)
            d[k.strip()] = v.strip()
        else:
            d[part] = True
    return d


def col(v):
    return None if (not v or v == 'none') else v


def strip_terms(text, terms):
    for t in terms:
        text = text.replace(t, '')
    return text


def text_of(value, terms):
    if not value:
        return None
    v = re.sub(r'<br\s*/?>', ' ', value, flags=re.I)
    v = re.sub(r'<[^>]+>', '', v)
    v = H.unescape(v)
    v = strip_terms(v, terms)
    v = re.sub(r'\s+', ' ', v).strip()
    return v or None


def shape_of(sd):
    if 'ellipse' in sd:
        return 'ellipse'
    if 'rhombus' in sd:
        return 'rhombus'
    return 'rect'


def sanitize(name):
    return re.sub(r'[\\/:*?"<>|]', '_', name)


def convert_page(diagram, page_index, terms):
    mg = diagram.find('mxGraphModel')
    cells = mg.findall('.//mxCell')
    by_id = {c.get('id'): c for c in cells}

    def is_edge(cid):
        c = by_id.get(cid)
        return c is not None and c.get('edge') == '1'

    def abs_geo(c):
        g = c.find('mxGeometry')
        if g is None or g.get('x') is None:
            return None
        x = float(g.get('x', 0))
        y = float(g.get('y', 0))
        w = float(g.get('width', 0))
        h = float(g.get('height', 0))
        p = by_id.get(c.get('parent'))
        while p is not None and p.get('vertex') == '1':
            pg = p.find('mxGeometry')
            if pg is not None and pg.get('x') is not None:
                x += float(pg.get('x', 0))
                y += float(pg.get('y', 0))
            p = by_id.get(p.get('parent'))
        return x, y, w, h

    kept = {}
    nodes = []
    for c in cells:
        if c.get('vertex') != '1':
            continue
        sd = style_dict(c.get('style'))
        if 'edgeLabel' in sd:                 # label belonging to a (dropped) edge
            continue
        if is_edge(c.get('parent')):
            continue
        geo = abs_geo(c)
        if geo is None or geo[2] <= 0 or geo[3] <= 0:
            continue
        x, y, w, h = geo
        area = {'type': shape_of(sd), 'cX': x + w / 2, 'cY': y + h / 2,
                'rH': w / 2, 'rV': h / 2}
        if sd.get('rounded') == '1':
            area['radii'] = 8
        label = text_of(c.get('value'), terms)
        if label:
            st = ';display: grid\n;place-items: center\n;text-align: center'
            if sd.get('fontColor'):
                st += f"\n;color: {sd['fontColor']}"
            if sd.get('fontSize'):
                st += f"\n;font-size: {sd['fontSize']}px"
            area['html'] = label
            area['style'] = st
        paint = {}
        if col(sd.get('fillColor')):
            paint['fill'] = sd['fillColor']
        if col(sd.get('strokeColor')):
            paint['stroke'] = sd['strokeColor']
        if sd.get('strokeWidth'):
            try:
                paint['lineWidth'] = float(sd['strokeWidth'])
            except ValueError:
                pass
        if sd.get('dashed') == '1':
            paint['lineDash'] = [6, 4]
        node = [c.get('id'), area, paint]
        kept[c.get('id')] = node
        nodes.append(node)

    links = []
    for c in cells:
        if c.get('edge') != '1':
            continue
        src, tgt = c.get('source'), c.get('target')
        if src not in kept or tgt not in kept:
            continue
        sd = style_dict(c.get('style'))
        ends = {
            'headF': sd.get('startArrow', 'none') not in ('none', 'false'),
            'headT': sd.get('endArrow', 'classic') not in ('none', 'false'),
        }
        paint = {'stroke': col(sd.get('strokeColor')) or '#111827'}
        try:
            paint['lineWidth'] = float(sd['strokeWidth']) if sd.get('strokeWidth') else 1.5
        except ValueError:
            paint['lineWidth'] = 1.5
        if sd.get('dashed') == '1':
            paint['lineDash'] = [6, 4]
        links.append([[src, ends, tgt], paint])

    # shift content into the canvas with a margin
    if nodes:
        minx = min(n[1]['cX'] - n[1]['rH'] for n in nodes)
        miny = min(n[1]['cY'] - n[1]['rV'] for n in nodes)
        dx, dy = 40 - minx, 40 - miny
        for n in nodes:
            n[1]['cX'] += dx
            n[1]['cY'] += dy
        maxx = max(n[1]['cX'] + n[1]['rH'] for n in nodes)
        maxy = max(n[1]['cY'] + n[1]['rV'] for n in nodes)
    else:
        maxx = maxy = 0

    page_name = strip_terms(diagram.get('name') or f'page{page_index}', terms).strip(' _')
    return {'nodes': nodes, 'links': links}, page_name, maxx, maxy


def main(argv=None):
    ap = argparse.ArgumentParser(description='Convert a .drawio file into DiagramForge .cde files (one per page).')
    ap.add_argument('input', help='Path to the .drawio file (uncompressed XML).')
    ap.add_argument('-o', '--outdir', help='Output directory (default: <dir>/cde/<basename>/).')
    ap.add_argument('--strip', action='append', default=[], metavar='TERM',
                    help='Proper noun / term to remove from labels and page names. Repeatable.')
    args = ap.parse_args(argv)

    base = os.path.splitext(os.path.basename(args.input))[0]
    outdir = args.outdir or os.path.join(os.path.dirname(args.input) or '.', 'cde', base)
    os.makedirs(outdir, exist_ok=True)

    tree = ET.parse(args.input)
    diagrams = tree.getroot().findall('diagram')
    if not diagrams:
        sys.exit('No <diagram> pages found.')

    print(f'{len(diagrams)} pages -> {outdir}/')
    print(f"{'file':46} {'nodes':>5} {'links':>5} {'maxX':>5} {'maxY':>5}")
    for i, d in enumerate(diagrams, 1):
        model, page_name, mx, my = convert_page(d, i, args.strip)
        fn = f'{i:02d}_{sanitize(page_name)}.cde'
        with open(os.path.join(outdir, fn), 'w', encoding='utf-8') as fp:
            fp.write(json.dumps(model, ensure_ascii=False, indent='\t') + '\n')
        flag = '  !! exceeds canvas' if mx > CANVAS or my > CANVAS else ''
        print(f'{fn[:46]:46} {len(model["nodes"]):5} {len(model["links"]):5} {int(mx):5} {int(my):5}{flag}')


if __name__ == '__main__':
    main()
