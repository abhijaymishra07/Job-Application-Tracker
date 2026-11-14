#!/usr/bin/env python3
"""Builds the Word version of the Review 3 report from index.html (run build.py first).

    /tmp/docxenv/bin/python report/review3/build_docx.py
"""
import re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Mm, Pt, RGBColor
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / "Job_Application_Tracker_Review3.docx"

NAVY = RGBColor(0x0F, 0x17, 0x2A)
TEAL = RGBColor(0x0F, 0x76, 0x6E)
MUTED = RGBColor(0x47, 0x55, 0x69)
CONTENT_W_MM = 180

soup = BeautifulSoup((HERE / "index.html").read_text(), "html.parser")
doc = Document()

sec = doc.sections[0]
sec.page_width, sec.page_height = Mm(210), Mm(297)
for side in ("left_margin", "right_margin"):
    setattr(sec, side, Mm(15))
sec.top_margin, sec.bottom_margin = Mm(14), Mm(14)
sec.header_distance = sec.footer_distance = Mm(7)

normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
normal.paragraph_format.space_after = Pt(4)
normal.paragraph_format.line_spacing = 1.12


def shade(cell, hex_fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc_pr.append(shd)


def borders(table, color="E2E8F0"):
    tbl_pr = table._tbl.tblPr
    el = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "6")
        b.set(qn("w:color"), color)
        el.append(b)
    tbl_pr.append(el)


def bottom_rule(paragraph, color="CBD5E1"):
    p_pr = paragraph._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    b = OxmlElement("w:bottom")
    b.set(qn("w:val"), "single")
    b.set(qn("w:sz"), "6")
    b.set(qn("w:space"), "1")
    b.set(qn("w:color"), color)
    bdr.append(b)
    p_pr.append(bdr)


def page_field(run):
    for kind, text in (("begin", None), (None, "PAGE"), ("end", None)):
        if kind:
            fld = OxmlElement("w:fldChar")
            fld.set(qn("w:fldCharType"), kind)
            run._r.append(fld)
        else:
            instr = OxmlElement("w:instrText")
            instr.set(qn("xml:space"), "preserve")
            instr.text = text
            run._r.append(instr)


def styled(p, text, size=None, bold=False, italic=False, color=None, font=None):
    r = p.add_run(text)
    r.bold, r.italic = bold, italic
    if size:
        r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    if font:
        r.font.name = font
        r._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    return r


def para(text="", size=None, bold=False, italic=False, color=None, align=None, after=None, before=None, keep=False):
    p = doc.add_paragraph()
    if text:
        styled(p, text, size, bold, italic, color)
    if align is not None:
        p.alignment = align
    if after is not None:
        p.paragraph_format.space_after = Pt(after)
    if before is not None:
        p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.keep_with_next = keep
    return p


def rich(node, p, size=None):
    """Copy text with <b> runs from an HTML node into a paragraph."""
    for child in node.children:
        if isinstance(child, NavigableString):
            if str(child):
                styled(p, re.sub(r"\s+", " ", str(child)), size)
        elif child.name in ("b", "strong"):
            styled(p, child.get_text(), size, bold=True)
        elif child.name == "br":
            p.add_run().add_break()
        else:
            rich(child, p, size)


def code(fn, text):
    t = doc.add_table(rows=2, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    borders(t)
    head, body = t.rows[0].cells[0], t.rows[1].cells[0]
    shade(head, "F8FAFC")
    hp = head.paragraphs[0]
    hp.paragraph_format.space_after = Pt(0)
    styled(hp, fn, 8, bold=True, color=TEAL, font="Courier New")
    bp = body.paragraphs[0]
    bp.paragraph_format.space_after = Pt(0)
    bp.paragraph_format.line_spacing = 1.0
    for i, line in enumerate(text.split("\n")):
        if i:
            bp.add_run().add_break()
        styled(bp, line, 8, color=NAVY, font="Courier New")
    for row in t.rows:
        tr_pr = row._tr.get_or_add_trPr()
        cant = OxmlElement("w:cantSplit")
        tr_pr.append(cant)
    para(after=2)


def shot(card):
    label = card.find("p", class_="shot-label").get_text()
    img = card.find("img")
    caption = card.find("p", class_="caption").get_text()
    src = HERE / img["src"]
    max_h = float(re.search(r"max-height:([\d.]+)mm", img.get("style", "")).group(1))
    with Image.open(src) as im:
        w, h = im.size
    width_mm = min(CONTENT_W_MM, max_h * w / h)

    para(label, 10, bold=True, color=NAVY, after=2, before=6, keep=True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(src), width=Mm(width_mm))
    para(caption, 8.5, italic=True, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, after=6)


# ---------- Cover (own section, no header/footer) ----------
cover = soup.find("div", class_="cover")
para(after=10)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run().add_picture(str(HERE / "assets/vit-logo.png"), width=Mm(62))
para(cover.find("h1").get_text(), 24, bold=True, color=NAVY, align=WD_ALIGN_PARAGRAPH.CENTER, before=14, after=6)
para(cover.find("div", class_="sub").get_text(), 13, italic=True, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, after=8)
para("   ·   ".join(b.get_text() for b in cover.find_all("span", class_="badge")), 10, bold=True, color=TEAL, align=WD_ALIGN_PARAGRAPH.CENTER, after=8)
bottom_rule(para(after=14))
para("Review 3", 18, bold=True, color=NAVY, align=WD_ALIGN_PARAGRAPH.CENTER, after=10)
para("Submitted by", 11.5, align=WD_ALIGN_PARAGRAPH.CENTER, after=4)
for name, reg in (("Abhijay Mishra", "24BCE2016"), ("Naman Gupta", "24BCE0768")):
    para(name, 12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=0)
    para(f"Registration No: {reg}", 11.5, align=WD_ALIGN_PARAGRAPH.CENTER, after=8)
bottom_rule(para(after=12))
para("School of Computer Science and Engineering (Core)", 11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=0)
para("SCOPE", 11.5, align=WD_ALIGN_PARAGRAPH.CENTER, after=8)
para("Subject: Database Systems (BCSE302L)", 11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=0)
para("Professor: Dr. Rajeshkannan R", 11.5, align=WD_ALIGN_PARAGRAPH.CENTER, after=80)
para("Vellore Institute of Technology", 10, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER)

body_sec = doc.add_section(WD_SECTION.NEW_PAGE)
sec.different_first_page_header_footer = True
body_sec.different_first_page_header_footer = False
body_sec.header.is_linked_to_previous = False
body_sec.footer.is_linked_to_previous = False

def two_column(part, left, right, rule):
    """Left/right aligned running line; a table avoids the header style's default tab stops."""
    t = part.add_table(rows=1, cols=2, width=Mm(CONTENT_W_MM))
    t.autofit = False
    lp, rp = t.rows[0].cells[0].paragraphs[0], t.rows[0].cells[1].paragraphs[0]
    rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for p in (lp, rp):
        p.paragraph_format.space_after = Pt(0)
        if rule:
            bottom_rule(p)
    styled(lp, left, 8, color=MUTED)
    styled(rp, right, 8, color=MUTED)
    trailing = part.paragraphs[0]
    trailing._p.addprevious(t._tbl)
    trailing.paragraph_format.space_after = Pt(0)
    trailing.paragraph_format.line_spacing = Pt(1)
    return rp


two_column(body_sec.header, "Abhijay Mishra 24BCE2016 · Naman Gupta 24BCE0768", "Review 3 · BCSE302L", True)
page_field(styled(two_column(body_sec.footer, "Job Application Tracker Using MongoDB", "Page ", False), "", 8, color=MUTED))

# ---------- Body: walk the report in document order ----------
first_feature = True
for page in soup.find_all("div", class_="page")[1:]:
    main = page.find("div", class_="main")
    for node in main.find_all(recursive=False):
        blocks = node.find_all(recursive=False) if node.name == "section" else [node]
        for el in blocks:
            classes = el.get("class", [])
            if "feature-sep" in classes:
                continue
            if "part" in classes:
                text = el.get_text()
                if text.startswith("Part") and ":" in text and not first_feature:
                    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
                para(text, 10, bold=True, color=TEAL, after=2, keep=True, before=0 if first_feature else 10)
                first_feature = False
            elif el.name == "h2":
                p = para(el.get_text(), 15, bold=True, color=NAVY, after=2, keep=True)
                p.style = doc.styles["Heading 2"]
                for r in p.runs:
                    r.font.color.rgb = NAVY
                    r.font.size = Pt(15)
                    r.font.name = "Calibri"
            elif el.name == "h3":
                para(el.get_text(), 11, bold=True, color=NAVY, before=6, after=3, keep=True)
            elif el.name == "p" and "source" in classes:
                para(el.get_text(), 9, italic=True, color=TEAL, after=6, keep=True)
            elif el.name == "p":
                p = para(after=6)
                rich(el, p)
            elif "codewrap" in classes:
                code(el.find("div", class_="fn").get_text(), el.find("pre").get_text())
            elif "shot" in classes:
                shot(el)

doc.core_properties.title = "Job Application Tracker Using MongoDB — Review 3"
doc.core_properties.author = "Abhijay Mishra, Naman Gupta"
doc.save(OUT)
print(f"Wrote {OUT}")
