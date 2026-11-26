#!/usr/bin/env python3
"""
Builds the PowerPoint fixtures of e2e/slides-pptx-import.spec.ts (CH-183):
small .pptx decks written part by part (OOXML), with only the Python standard
library and ffmpeg (for the 1 s MP4), so they rebuild the same anywhere.

    python3 -I app/apps/client/e2e/fixtures/pptx/scripts/make-fixtures.py

a-inheritance.pptx  title + bullets inheriting from master and layout, theme
                    colours and fonts, an autofit body, a cropped picture,
                    an empty placeholder, speaker notes
b-animations.pptx   click animations: a title fade, a by-paragraph fly from the
                    left, a zoom with the previous, an exit after the previous,
                    an emphasis spin (4 clicks); a Vortex transition
c-video.pptx        an embedded MP4 with a poster, playing by itself, a push
                    from the right with an automatic advance; a WMV video
d-group-smartart.pptx  a group with a rotated shape, a SmartArt drawing of 3
                    shapes, a chart with a fallback picture, a star, a table
"""

import os
import shutil
import struct
import subprocess
import tempfile
import zipfile
import zlib

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXED_TIME = (2026, 1, 1, 0, 0, 0)

NS = (
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
)
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'


# ---------------------------------------------------------------- pictures


def png(width, height, color, stripe=None):
    """A tiny PNG: one colour, with a stripe of another down the middle."""
    rows = b''
    for _ in range(height):
        row = b'\x00'
        for x in range(width):
            c = stripe if stripe and width // 3 <= x < 2 * width // 3 else color
            row += bytes(c)
        rows += row

    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

    header = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', header)
        + chunk(b'IDAT', zlib.compress(rows, 9))
        + chunk(b'IEND', b'')
    )


def mp4():
    """A 1 s, 160x90 H.264 test pattern."""
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 'clip.mp4')
        subprocess.run(
            [
                'ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
                'testsrc=duration=1:size=160x90:rate=10',
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast',
                '-fflags', '+bitexact', '-flags:v', '+bitexact',
                '-map_metadata', '-1', path,
            ],
            check=True,
        )
        with open(path, 'rb') as f:
            return f.read()


# ---------------------------------------------------------------- package


def rels(items):
    body = ''.join(
        f'<Relationship Id="{rid}" Type="{kind}" Target="{target}"'
        + (' TargetMode="External"' if external else '')
        + '/>'
        for rid, kind, target, external in items
    )
    return f'{DECL}<Relationships xmlns="{PKG_REL}">{body}</Relationships>'


def rel(kind):
    return f'{REL}/{kind}'


def content_types(parts):
    defaults = {
        'rels': 'application/vnd.openxmlformats-package.relationships+xml',
        'xml': 'application/xml',
        'png': 'image/png',
        'mp4': 'video/mp4',
        'wmv': 'video/x-ms-wmv',
    }
    body = ''.join(
        f'<Default Extension="{ext}" ContentType="{kind}"/>'
        for ext, kind in defaults.items()
    )
    body += ''.join(
        f'<Override PartName="/{name}" ContentType="{kind}"/>' for name, kind in parts
    )
    return (
        f'{DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        f'{body}</Types>'
    )


CT = 'application/vnd.openxmlformats-officedocument.'


def write_pptx(name, files):
    path = os.path.join(OUT, name)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for part, data in files:
            info = zipfile.ZipInfo(part, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data.encode('utf-8') if isinstance(data, str) else data)
    print(f'{name}: {os.path.getsize(path)} bytes')


# ---------------------------------------------------------------- theme, master, layout


THEME = f'''{DECL}<a:theme {NS} name="Church">
<a:themeElements>
 <a:clrScheme name="Church">
  <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
  <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
  <a:dk2><a:srgbClr val="1F3864"/></a:dk2>
  <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
  <a:accent1><a:srgbClr val="C00000"/></a:accent1>
  <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
  <a:accent3><a:srgbClr val="70AD47"/></a:accent3>
  <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
  <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
  <a:accent6><a:srgbClr val="7030A0"/></a:accent6>
  <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
  <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
 </a:clrScheme>
 <a:fontScheme name="Church">
  <a:majorFont><a:latin typeface="Cambria"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
  <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
 </a:fontScheme>
 <a:fmtScheme name="Church">
  <a:fillStyleLst>
   <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
   <a:solidFill><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:solidFill>
   <a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:solidFill>
  </a:fillStyleLst>
  <a:lnStyleLst>
   <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
   <a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
   <a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
  </a:lnStyleLst>
  <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
  <a:bgFillStyleLst>
   <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
   <a:solidFill><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:solidFill>
   <a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:solidFill>
  </a:bgFillStyleLst>
 </a:fmtScheme>
</a:themeElements>
</a:theme>'''


def xfrm(x, y, w, h, extra=''):
    return f'<a:xfrm{extra}><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>'


def nv_sp(sid, name, ph=''):
    return (
        f'<p:nvSpPr><p:cNvPr id="{sid}" name="{name}"/><p:cNvSpPr/>'
        f'<p:nvPr>{ph}</p:nvPr></p:nvSpPr>'
    )


def text_body(paragraphs, body_pr='<a:bodyPr/>'):
    return f'<p:txBody>{body_pr}<a:lstStyle/>{"".join(paragraphs)}</p:txBody>'


def para(text, lvl=None, run_props='<a:rPr lang="ro-RO" dirty="0"/>'):
    ppr = f'<a:pPr lvl="{lvl}"/>' if lvl is not None else ''
    return f'<a:p>{ppr}<a:r>{run_props}<a:t>{text}</a:t></a:r></a:p>'


def master_xml(background):
    title = (
        f'<p:sp>{nv_sp(2, "Title Placeholder 1", "<p:ph type=\"title\"/>")}'
        f'<p:spPr>{xfrm(838200, 365125, 10515600, 1325563)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
        f'{text_body([para("Titlu")], "<a:bodyPr anchor=\"ctr\"/>")}</p:sp>'
    )
    body = (
        f'<p:sp>{nv_sp(3, "Text Placeholder 2", "<p:ph type=\"body\" idx=\"1\"/>")}'
        f'<p:spPr>{xfrm(838200, 1825625, 10515600, 4351338)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
        f'{text_body([para("Text", 0)])}</p:sp>'
    )
    bar = (
        f'<p:sp>{nv_sp(7, "Bottom bar")}'
        f'<p:spPr>{xfrm(0, 6629400, 12192000, 228600)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        f'<a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>'
    )
    return f'''{DECL}<p:sldMaster {NS}>
<p:cSld>{background}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>{title}{body}{bar}</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles>
 <p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="4400" b="1"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>
 <p:bodyStyle>
  <a:lvl1pPr marL="228600" indent="-228600"><a:spcBef><a:spcPts val="1000"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="2800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr>
  <a:lvl2pPr marL="685800" indent="-228600"><a:spcBef><a:spcPts val="500"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="&#8211;"/><a:defRPr sz="2400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl2pPr>
 </p:bodyStyle>
 <p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle>
</p:txStyles>
</p:sldMaster>'''


def layout_xml(background=''):
    title = f'<p:sp>{nv_sp(2, "Title 1", "<p:ph type=\"title\"/>")}<p:spPr/>{text_body([para("Titlu")])}</p:sp>'
    body = (
        f'<p:sp>{nv_sp(3, "Content Placeholder 2", "<p:ph idx=\"1\"/>")}'
        f'<p:spPr>{xfrm(838200, 1690688, 10515600, 4486275)}</p:spPr>{text_body([para("Text", 0)])}</p:sp>'
    )
    date = f'<p:sp>{nv_sp(4, "Date Placeholder 3", "<p:ph type=\"dt\" sz=\"half\" idx=\"10\"/>")}<p:spPr>{xfrm(838200, 6356350, 2743200, 365125)}</p:spPr>{text_body(["<a:p><a:endParaRPr lang=\"ro-RO\"/></a:p>"])}</p:sp>'
    return f'''{DECL}<p:sldLayout {NS} type="obj" preserve="1">
<p:cSld name="Title and Content">{background}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>{title}{body}{date}</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>'''


def presentation_xml(slide_count):
    slides = ''.join(
        f'<p:sldId id="{256 + i}" r:id="rId{i + 3}"/>' for i in range(slide_count)
    )
    return f'''{DECL}<p:presentation {NS} saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>{slides}</p:sldIdLst>
<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>
<p:defaultTextStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle>
</p:presentation>'''


def slide_xml(shapes, background='', transition='', timing='', mc=False):
    extra = f' xmlns:mc="{MC}" xmlns:p14="{P14}" mc:Ignorable="p14"' if mc else ''
    return f'''{DECL}<p:sld {NS}{extra}>
<p:cSld>{background}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>{"".join(shapes)}</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>{transition}{timing}
</p:sld>'''


def notes_xml(text):
    return f'''{DECL}<p:notes {NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp>{nv_sp(2, "Slide Image", "<p:ph type=\"sldImg\"/>")}<p:spPr/></p:sp>
<p:sp>{nv_sp(3, "Notes", "<p:ph type=\"body\" idx=\"1\"/>")}<p:spPr/>{text_body([para(text)])}</p:sp>
</p:spTree></p:cSld></p:notes>'''


def build_deck(name, slides, master_background, layout_background=''):
    """slides: list of dicts with xml, rels (list of (rid, kind, target)), notes, media {path: bytes}."""
    files = []
    overrides = [
        ('ppt/presentation.xml', CT + 'presentationml.presentation.main+xml'),
        ('ppt/slideMasters/slideMaster1.xml', CT + 'presentationml.slideMaster+xml'),
        ('ppt/slideLayouts/slideLayout1.xml', CT + 'presentationml.slideLayout+xml'),
        ('ppt/theme/theme1.xml', CT + 'theme+xml'),
    ]
    pres_rels = [
        ('rId1', rel('slideMaster'), 'slideMasters/slideMaster1.xml', False),
        ('rId2', rel('theme'), 'theme/theme1.xml', False),
    ]
    media = {}
    for i, slide in enumerate(slides, start=1):
        overrides.append((f'ppt/slides/slide{i}.xml', CT + 'presentationml.slide+xml'))
        pres_rels.append((f'rId{i + 2}', rel('slide'), f'slides/slide{i}.xml', False))
        slide_rels = [('rId1', rel('slideLayout'), '../slideLayouts/slideLayout1.xml', False)]
        slide_rels += [(rid, kind, target, False) for rid, kind, target in slide.get('rels', [])]
        if slide.get('notes'):
            overrides.append(
                (f'ppt/notesSlides/notesSlide{i}.xml', CT + 'presentationml.notesSlide+xml')
            )
            slide_rels.append(('rIdNotes', rel('notesSlide'), f'../notesSlides/notesSlide{i}.xml', False))
            files.append((f'ppt/notesSlides/notesSlide{i}.xml', notes_xml(slide['notes'])))
            files.append(
                (
                    f'ppt/notesSlides/_rels/notesSlide{i}.xml.rels',
                    rels([('rId1', rel('slide'), f'../slides/slide{i}.xml', False)]),
                )
            )
        files.append((f'ppt/slides/slide{i}.xml', slide['xml']))
        files.append((f'ppt/slides/_rels/slide{i}.xml.rels', rels(slide_rels)))
        for path, (data, kind) in slide.get('parts', {}).items():
            files.append((path, data))
            if kind:
                overrides.append((path, kind))
        media.update(slide.get('media', {}))
    for path, data in media.items():
        files.append((path, data))
    files = [
        ('[Content_Types].xml', content_types(overrides)),
        ('_rels/.rels', rels([('rId1', rel('officeDocument'), 'ppt/presentation.xml', False)])),
        ('ppt/presentation.xml', presentation_xml(len(slides))),
        ('ppt/_rels/presentation.xml.rels', rels(pres_rels)),
        ('ppt/theme/theme1.xml', THEME),
        ('ppt/slideMasters/slideMaster1.xml', master_xml(master_background)),
        (
            'ppt/slideMasters/_rels/slideMaster1.xml.rels',
            rels(
                [
                    ('rId1', rel('slideLayout'), '../slideLayouts/slideLayout1.xml', False),
                    ('rId2', rel('theme'), '../theme/theme1.xml', False),
                ]
            ),
        ),
        ('ppt/slideLayouts/slideLayout1.xml', layout_xml(layout_background)),
        (
            'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
            rels([('rId1', rel('slideMaster'), '../slideMasters/slideMaster1.xml', False)]),
        ),
    ] + files
    write_pptx(name, files)


def picture(pid, name, rid, box, crop='', extra_nv='', ext_lst=''):
    x, y, w, h = box
    return (
        f'<p:pic><p:nvPicPr><p:cNvPr id="{pid}" name="{name}"/><p:cNvPicPr/><p:nvPr>{extra_nv}{ext_lst}</p:nvPr></p:nvPicPr>'
        f'<p:blipFill><a:blip r:embed="{rid}"/>{crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill>'
        f'<p:spPr>{xfrm(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    )


# ---------------------------------------------------------------- (a) inheritance

MASTER_BG = (
    '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg2"><a:lumMod val="75000"/></a:schemeClr>'
    '</a:solidFill><a:effectLst/></p:bgPr></p:bg>'
)


def deck_a():
    title = f'<p:sp>{nv_sp(2, "Title 1", "<p:ph type=\"title\"/>")}<p:spPr/>{text_body([para("Bine ați venit")])}</p:sp>'
    body_pr = '<a:bodyPr><a:normAutofit fontScale="85000" lnSpcReduction="10000"/></a:bodyPr>'
    red = '<a:rPr lang="ro-RO" b="1"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:rPr>'
    body = (
        f'<p:sp>{nv_sp(3, "Content Placeholder 2", "<p:ph idx=\"1\"/>")}<p:spPr/>'
        + text_body(
            [
                para('Primul punct', 0),
                para('Al doilea punct', 0),
                para('Un subpunct', 1),
                f'<a:p><a:r><a:rPr lang="ro-RO"/><a:t>Cuvânt </a:t></a:r><a:r>{red}<a:t>important</a:t></a:r></a:p>',
            ],
            body_pr,
        )
        + '</p:sp>'
    )
    date = f'<p:sp>{nv_sp(4, "Date Placeholder 3", "<p:ph type=\"dt\" sz=\"half\" idx=\"10\"/>")}<p:spPr/>{text_body(["<a:p><a:endParaRPr lang=\"ro-RO\"/></a:p>"])}</p:sp>'
    crop = '<a:srcRect l="10000" t="20000" r="5000"/>'
    pic = picture(5, 'Picture 4', 'rId2', (8000000, 4000000, 3000000, 2000000), crop)
    slide = {
        'xml': slide_xml([title, body, date, pic]),
        'rels': [('rId2', rel('image'), '../media/image1.png')],
        'media': {'ppt/media/image1.png': png(40, 30, (30, 90, 200), (250, 250, 250))},
        'notes': 'Notă pentru predicator',
    }
    build_deck('a-inheritance.pptx', [slide], MASTER_BG)


# ---------------------------------------------------------------- (b) animations

_ids = iter(range(3, 1000))


def behaviour(spid, dur, paragraph=None, kind='anim'):
    target = f'<p:spTgt spid="{spid}">'
    if paragraph is not None:
        target += f'<p:txEl><p:pRg st="{paragraph}" end="{paragraph}"/></p:txEl>'
    target += '</p:spTgt>'
    if kind == 'set':
        return (
            f'<p:set><p:cBhvr><p:cTn id="{next(_ids)}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl>{target}</p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:to><p:strVal val="visible"/></p:to></p:set>'
        )
    return (
        f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{next(_ids)}" dur="{dur}"/>'
        f'<p:tgtEl>{target}</p:tgtEl></p:cBhvr></p:animEffect>'
    )


def effect(preset_class, preset_id, subtype, node_type, spid, dur, paragraph=None, delay=0):
    """One effect: a set (entrances) and a timed behaviour on its shape."""
    inner = (
        behaviour(spid, 1, paragraph, 'set') if preset_class == 'entr' else ''
    ) + behaviour(spid, dur, paragraph)
    return (
        f'<p:par><p:cTn id="{next(_ids)}" presetID="{preset_id}" presetClass="{preset_class}" '
        f'presetSubtype="{subtype}" fill="hold" grpId="0" nodeType="{node_type}">'
        f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>{inner}</p:childTnLst></p:cTn></p:par>'
    )


def chunk(effects, delay=0):
    """Effects starting together (an "after previous" starts a new chunk)."""
    return (
        f'<p:par><p:cTn id="{next(_ids)}" fill="hold"><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst>'
        f'<p:childTnLst>{"".join(effects)}</p:childTnLst></p:cTn></p:par>'
    )


def click(chunks, automatic=False):
    cond = '<p:cond delay="indefinite"/>'
    if automatic:
        cond += '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>'
    return (
        f'<p:par><p:cTn id="{next(_ids)}" fill="hold"><p:stCondLst>{cond}</p:stCondLst>'
        f'<p:childTnLst>{"".join(chunks)}</p:childTnLst></p:cTn></p:par>'
    )


def timing(clicks, extra_nodes='', build=''):
    return (
        '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        f'{"".join(clicks)}</p:childTnLst></p:cTn>'
        '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        f'{extra_nodes}</p:childTnLst></p:cTn></p:par></p:tnLst>{build}</p:timing>'
    )


LAYOUT_BG_REF = '<p:bg><p:bgRef idx="1001"><a:schemeClr val="accent5"/></p:bgRef></p:bg>'


def deck_b():
    title = f'<p:sp>{nv_sp(2, "Title 1", "<p:ph type=\"title\"/>")}<p:spPr/>{text_body([para("Cântarea zilei")])}</p:sp>'
    body = (
        f'<p:sp>{nv_sp(3, "Content Placeholder 2", "<p:ph idx=\"1\"/>")}<p:spPr/>'
        f'{text_body([para("Prima strofă", 0), para("A doua strofă", 0)])}</p:sp>'
    )
    pic = picture(4, 'Picture 3', 'rId2', (8500000, 4200000, 2400000, 1600000))
    shape = (
        f'<p:sp>{nv_sp(5, "Rectangle 4")}<p:spPr>{xfrm(838200, 5400000, 3000000, 800000)}'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
        '<p:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:lnRef>'
        '<a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>'
        '<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>'
        f'{text_body([para("Dispare")], "<a:bodyPr anchor=\"ctr\"/>")}</p:sp>'
    )
    clicks = [
        # Click 1: the title fades in.
        click([chunk([effect('entr', 10, 0, 'clickEffect', 2, 500)])]),
        # Click 2: the first verse flies in from the left.
        click([chunk([effect('entr', 2, 8, 'clickEffect', 3, 500, paragraph=0)])]),
        # Click 3: the second verse flies in, the picture zooms in with it,
        # then the rectangle fades out after them.
        click(
            [
                chunk(
                    [
                        effect('entr', 2, 8, 'clickEffect', 3, 500, paragraph=1),
                        effect('entr', 23, 16, 'withEffect', 4, 500),
                    ]
                ),
                chunk([effect('exit', 10, 0, 'afterEffect', 5, 500)], delay=500),
            ]
        ),
        # Click 4: the title spins.
        click([chunk([effect('emph', 8, 0, 'clickEffect', 2, 2000)])]),
    ]
    build = (
        '<p:bldLst><p:bldP spid="2" grpId="0"/><p:bldP spid="3" grpId="0" build="p"/>'
        '<p:bldP spid="5" grpId="0" animBg="1"/></p:bldLst>'
    )
    vortex = (
        f'<mc:AlternateContent xmlns:mc="{MC}"><mc:Choice xmlns:p14="{P14}" Requires="p14">'
        '<p:transition spd="slow" p14:dur="2000"><p14:vortex dir="r"/></p:transition></mc:Choice>'
        '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'
    )
    first = {
        'xml': slide_xml([title, body, pic, shape], transition=vortex, timing=timing(clicks, build=build), mc=True),
        'rels': [('rId2', rel('image'), '../media/image1.png')],
        'media': {'ppt/media/image1.png': png(30, 20, (0, 150, 80))},
    }
    second_title = f'<p:sp>{nv_sp(2, "Title 1", "<p:ph type=\"title\"/>")}<p:spPr/>{text_body([para("Amin")])}</p:sp>'
    second = {
        'xml': slide_xml([second_title], transition='<p:transition spd="med"><p:wipe dir="d"/></p:transition>'),
    }
    build_deck('b-animations.pptx', [first, second], MASTER_BG, LAYOUT_BG_REF)


# ---------------------------------------------------------------- (c) video


def video_picture(pid, name, poster_rid, link_rid, media_rid, box):
    nv = f'<a:videoFile r:link="{link_rid}"/>'
    ext = (
        '<p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DA1CEB79B1F}">'
        f'<p14:media xmlns:p14="{P14}" r:embed="{media_rid}"/></p:ext></p:extLst>'
    )
    return picture(pid, name, poster_rid, box, extra_nv=nv, ext_lst=ext)


def deck_c():
    title = f'<p:sp>{nv_sp(2, "Title 1", "<p:ph type=\"title\"/>")}<p:spPr/>{text_body([para("Anunțuri")])}</p:sp>'
    first = {'xml': slide_xml([title])}
    video = video_picture(4, 'Clip 1', 'rId2', 'rId3', 'rId4', (1524000, 857250, 6096000, 3429000))
    old = video_picture(5, 'Old clip', 'rId5', 'rId6', 'rId7', (8000000, 4500000, 3000000, 1687500))
    play = (
        '<p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect">'
        '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
        '<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="1000" fill="hold"/>'
        '<p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>'
    )
    clicks = [
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
        '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        f'<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{play}'
        '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
    ]
    media_node = (
        '<p:video><p:cMediaNode vol="80000"><p:cTn id="7" fill="hold" display="0"><p:stCondLst>'
        '<p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="4"/></p:tgtEl>'
        '</p:cMediaNode></p:video>'
    )
    push = (
        f'<mc:AlternateContent xmlns:mc="{MC}"><mc:Choice xmlns:p14="{P14}" Requires="p14">'
        '<p:transition spd="slow" p14:dur="1200" advTm="5000"><p:push dir="r"/></p:transition></mc:Choice>'
        '<mc:Fallback><p:transition spd="slow" advTm="5000"><p:push dir="r"/></p:transition></mc:Fallback>'
        '</mc:AlternateContent>'
    )
    second = {
        'xml': slide_xml(
            [video, old],
            background='<p:bg><p:bgPr><a:solidFill><a:srgbClr val="101820"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>',
            transition=push,
            timing=timing(clicks, extra_nodes=media_node),
            mc=True,
        ),
        'rels': [
            ('rId2', rel('image'), '../media/image1.png'),
            ('rId3', rel('video'), '../media/media1.mp4'),
            ('rId4', 'http://schemas.microsoft.com/office/2007/relationships/media', '../media/media1.mp4'),
            ('rId5', rel('image'), '../media/image2.png'),
            ('rId6', rel('video'), '../media/media2.wmv'),
            ('rId7', 'http://schemas.microsoft.com/office/2007/relationships/media', '../media/media2.wmv'),
        ],
        'media': {
            'ppt/media/image1.png': png(32, 18, (200, 30, 30)),
            'ppt/media/media1.mp4': mp4(),
            'ppt/media/image2.png': png(32, 18, (30, 30, 200)),
            # Not a real WMV: the import only looks at its extension.
            'ppt/media/media2.wmv': b'0&\xb2u\x8ef\xcf\x11 not a real wmv',
        },
    }
    build_deck('c-video.pptx', [first, second], MASTER_BG)


# ---------------------------------------------------------------- (d) group, SmartArt, chart

DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
DSP = 'http://schemas.microsoft.com/office/drawing/2008/diagram'
CHART = 'http://schemas.openxmlformats.org/drawingml/2006/chart'


def dsp_shape(model, x, text, accent):
    return (
        f'<dsp:sp modelId="{{{model}}}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr>'
        f'<dsp:spPr>{xfrm(x, 0, 1500000, 1000000)}<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>'
        f'<a:solidFill><a:schemeClr val="{accent}"/></a:solidFill></dsp:spPr>'
        '<dsp:style><a:lnRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef>'
        '<a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></dsp:style>'
        f'<dsp:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="ro-RO" sz="2000"/><a:t>{text}</a:t></a:r></a:p></dsp:txBody>'
        f'<dsp:txXfrm><a:off x="{x}" y="0"/><a:ext cx="1500000" cy="1000000"/></dsp:txXfrm></dsp:sp>'
    )


def deck_d():
    group = (
        '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="Group 1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        '<p:grpSpPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="4000000" cy="2000000"/>'
        '<a:chOff x="0" y="0"/><a:chExt cx="2000000" cy="1000000"/></a:xfrm></p:grpSpPr>'
        f'<p:sp>{nv_sp(3, "Rotated")}<p:spPr>{xfrm(0, 0, 1000000, 500000, " rot=\"2700000\"")}'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="00B050"/></a:solidFill></p:spPr></p:sp>'
        f'<p:sp>{nv_sp(4, "Oval")}<p:spPr>{xfrm(1000000, 500000, 1000000, 500000)}'
        '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFC000"/></a:solidFill></p:spPr></p:sp>'
        '</p:grpSp>'
    )
    smartart = (
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Diagram 4"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
        '<p:xfrm><a:off x="6000000" y="1000000"/><a:ext cx="5000000" cy="1000000"/></p:xfrm>'
        f'<a:graphic><a:graphicData uri="{DGM}"><dgm:relIds xmlns:dgm="{DGM}" r:dm="rId3" r:lo="rId4" r:qs="rId5" r:cs="rId6"/>'
        '</a:graphicData></a:graphic></p:graphicFrame>'
    )
    chart = (
        f'<mc:AlternateContent xmlns:mc="{MC}"><mc:Choice xmlns:c14="http://schemas.microsoft.com/office/drawing/2007/8/2/chart" Requires="c14">'
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="6" name="Chart 5"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
        '<p:xfrm><a:off x="1000000" y="3800000"/><a:ext cx="4000000" cy="2500000"/></p:xfrm>'
        f'<a:graphic><a:graphicData uri="{CHART}"><c:chart xmlns:c="{CHART}" r:id="rId8"/></a:graphicData></a:graphic>'
        '</p:graphicFrame></mc:Choice><mc:Fallback>'
        + picture(6, 'Chart 5', 'rId9', (1000000, 3800000, 4000000, 2500000))
        + '</mc:Fallback></mc:AlternateContent>'
    )
    star = (
        f'<p:sp>{nv_sp(7, "Star 6")}<p:spPr>{xfrm(6000000, 3800000, 1500000, 1500000)}'
        '<a:prstGeom prst="star5"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="7030A0"/></a:solidFill></p:spPr></p:sp>'
    )
    cell = lambda text: f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ro-RO"/><a:t>{text}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>'
    table = (
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8" name="Table 7"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
        '<p:xfrm><a:off x="8000000" y="3800000"/><a:ext cx="3500000" cy="740000"/></p:xfrm>'
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/>'
        '<a:tblGrid><a:gridCol w="1750000"/><a:gridCol w="1750000"/></a:tblGrid>'
        f'<a:tr h="370000">{cell("Ziua")}{cell("Ora")}</a:tr><a:tr h="370000">{cell("Duminică")}{cell("10:00")}</a:tr>'
        '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>'
    )
    drawing = (
        f'{DECL}<dsp:drawing xmlns:dgm="{DGM}" xmlns:dsp="{DSP}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>'
        + dsp_shape('A1B2C3D4-0000-0000-0000-000000000001', 0, 'Unu', 'accent1')
        + dsp_shape('A1B2C3D4-0000-0000-0000-000000000002', 1750000, 'Doi', 'accent2')
        + dsp_shape('A1B2C3D4-0000-0000-0000-000000000003', 3500000, 'Trei', 'accent3')
        + '</dsp:spTree></dsp:drawing>'
    )
    data = (
        f'{DECL}<dgm:dataModel xmlns:dgm="{DGM}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<dgm:ptLst><dgm:pt modelId="{A1B2C3D4-0000-0000-0000-000000000000}" type="doc"><dgm:prSet/><dgm:spPr/></dgm:pt></dgm:ptLst>'
        '<dgm:cxnLst/><dgm:bg/><dgm:whole/><dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram">'
        f'<dsp:dataModelExt xmlns:dsp="{DSP}" relId="rId7" minVer="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>'
        '</a:ext></dgm:extLst></dgm:dataModel>'
    )
    stub = lambda tag: f'{DECL}<dgm:{tag} xmlns:dgm="{DGM}"/>'
    chart_part = f'{DECL}<c:chartSpace xmlns:c="{CHART}"><c:chart><c:plotArea><c:layout/></c:plotArea></c:chart></c:chartSpace>'
    slide = {
        'xml': slide_xml([group, smartart, chart, star, table], mc=True),
        'rels': [
            ('rId3', rel('diagramData'), '../diagrams/data1.xml'),
            ('rId4', rel('diagramLayout'), '../diagrams/layout1.xml'),
            ('rId5', rel('diagramQuickStyle'), '../diagrams/quickStyle1.xml'),
            ('rId6', rel('diagramColors'), '../diagrams/colors1.xml'),
            ('rId7', 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing', '../diagrams/drawing1.xml'),
            ('rId8', rel('chart'), '../charts/chart1.xml'),
            ('rId9', rel('image'), '../media/image1.png'),
        ],
        'parts': {
            'ppt/diagrams/data1.xml': (data, CT + 'drawingml.diagramData+xml'),
            'ppt/diagrams/layout1.xml': (stub('layoutDef'), CT + 'drawingml.diagramLayout+xml'),
            'ppt/diagrams/quickStyle1.xml': (stub('styleDef'), CT + 'drawingml.diagramStyle+xml'),
            'ppt/diagrams/colors1.xml': (stub('colorsDef'), CT + 'drawingml.diagramColors+xml'),
            'ppt/diagrams/drawing1.xml': (drawing, 'application/vnd.ms-office.drawingml.diagramDrawing+xml'),
            'ppt/charts/chart1.xml': (chart_part, CT + 'drawingml.chart+xml'),
        },
        'media': {'ppt/media/image1.png': png(40, 25, (240, 240, 240), (200, 60, 60))},
    }
    build_deck('d-group-smartart.pptx', [slide], MASTER_BG)


if __name__ == '__main__':
    if not shutil.which('ffmpeg'):
        raise SystemExit('ffmpeg is needed for the MP4 of c-video.pptx')
    deck_a()
    deck_b()
    deck_c()
    deck_d()
