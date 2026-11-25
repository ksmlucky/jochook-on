"""Build role-specific user guides from one JSON source.

Requires reportlab and Korean TrueType fonts. Windows defaults to Malgun Gothic;
other hosts may pass --font and --bold-font. No network or app/database access.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "guides"
W, H, M = 420, 740, 30
INK, GREEN, MUTED = "#233c33", "#28634e", "#52695d"


def build_pdf(guide, data, target):
    c = canvas.Canvas(str(target), pagesize=(W, H), invariant=1)
    c.setTitle(f"조축ON {guide['audience']} 사용 가이드")
    c.setAuthor("조축ON")
    release_label = data.get('releaseLabel', f"{data['publishedOn']} 기준")
    c.setSubject(f"{release_label} · 가이드 {data['guideVersion']}")
    styles = {
        "body": ParagraphStyle("body", fontName="Guide", fontSize=11.5, leading=18.2, textColor=colors.HexColor(INK), wordWrap="CJK"),
        "small": ParagraphStyle("small", fontName="Guide", fontSize=10, leading=15.5, textColor=colors.HexColor(MUTED), wordWrap="CJK"),
        "section": ParagraphStyle("section", fontName="GuideBold", fontSize=13, leading=20, textColor=colors.HexColor(GREEN), wordWrap="CJK"),
        "lead": ParagraphStyle("lead", fontName="Guide", fontSize=12, leading=19.2, textColor=colors.HexColor(MUTED), wordWrap="CJK"),
    }
    widths = W - 2 * M
    layouts = []
    for n, page in enumerate(guide["pages"], 1):
        c.setFillColor(colors.HexColor("#f6f8f3")); c.rect(0, 0, W, H, stroke=0, fill=1)
        c.setFillColor(colors.HexColor(GREEN)); c.rect(0, H - 7, W, 7, stroke=0, fill=1)
        c.setFont("GuideBold", 12); c.drawString(M, H - 35, "조축ON")
        c.setFont("Guide", 9); c.setFillColor(colors.HexColor(MUTED)); c.drawRightString(W - M, H - 35, f"{guide['audience']} 가이드  {data['guideVersion']}")
        y = H - 66

        def p(text, style="body", gap=7, inset=0):
            nonlocal y
            para = Paragraph(text, styles[style])
            _, ph = para.wrap(widths - inset * 2, H)
            if y - ph < 49:
                raise ValueError(f"Page overflow: {guide['id']} page {n}, {text[:35]}")
            para.drawOn(c, M + inset, y - ph)
            y -= ph + gap

        c.setFillColor(colors.HexColor(GREEN)); c.setFont("GuideBold", 10)
        c.drawString(M, y, page["kicker"]); y -= 32
        c.setFillColor(colors.HexColor(INK)); c.setFont("GuideBold", 23)
        c.drawString(M, y, page["title"]); y -= 20
        p(page["lead"], "lead", 16)
        if page.get("openApp"):
            c.setFillColor(colors.HexColor(GREEN)); c.roundRect(M, y - 36, widths, 36, 9, stroke=0, fill=1)
            c.setFillColor(colors.white); c.setFont("GuideBold", 11.5)
            c.drawCentredString(W / 2, y - 23, "조축ON 열기  >" if data["publicUrl"].startswith(("https://", "http://")) else "접속 주소: **** · 운영진에게 문의")
            if data["publicUrl"].startswith(("https://", "http://")):
                c.linkURL(data["publicUrl"], (M, y - 36, W - M, y), relative=0)
            y -= 49
        for section in page["sections"]:
            p(section["title"], "section", 5)
            for i, text in enumerate(section.get("steps", []), 1):
                p(f'<b>{i}.</b> {text}', gap=6)
            for text in section.get("body", []):
                p(text)
            y -= 7
        if note := page.get("note"):
            para = Paragraph(note, styles["small"])
            _, ph = para.wrap(widths - 24, H)
            box_h = ph + 22
            if y - box_h < 49:
                raise ValueError(f"Note overflow: {guide['id']} page {n}, bottom {y - box_h:.1f}")
            c.setFillColor(colors.HexColor("#e7efe8")); c.roundRect(M, y - box_h, widths, box_h, 9, stroke=0, fill=1)
            para.drawOn(c, M + 12, y - 11 - ph)
            y -= box_h
        c.setStrokeColor(colors.HexColor("#d7e2d8")); c.line(M, 38, W - M, 38)
        c.setFont("Guide", 8.5); c.setFillColor(colors.HexColor(MUTED))
        c.drawString(M, 23, f"{release_label}  |  인터넷 연결 필요")
        c.drawRightString(W - M, 23, f"{n:02} / {len(guide['pages']):02}")
        layouts.append({"page": n, "title": page["title"], "contentBottom": round(y, 1)})
        c.showPage()
    c.save()
    return layouts


def build_html(guide, data):
    release_label = html.escape(data.get('releaseLabel', f"{data['publishedOn']} 기준"))
    pages = []
    for n, page in enumerate(guide["pages"], 1):
        sections = []
        for s in page["sections"]:
            body = ''.join(f'<p>{t}</p>' for t in s.get("body", []))
            steps = '<ol>' + ''.join(f'<li>{t}</li>' for t in s["steps"]) + '</ol>' if s.get("steps") else ''
            sections.append(f'<section><h3>{html.escape(s["title"])}</h3>{steps}{body}</section>')
        action = ""
        if page.get("openApp"):
            if data["publicUrl"].startswith(("https://", "http://")):
                action = f'<a class="open-app" href="{html.escape(data["publicUrl"], quote=True)}">조축ON 열기 →</a>'
            else:
                action = '<div class="open-app">접속 주소: **** · 운영진에게 문의</div>'
        note = f'<aside>{page["note"]}</aside>' if page.get("note") else ''
        pages.append(f'<article id="page-{n}"><header><strong>조축ON</strong><span>{guide["audience"]} 가이드 {data["guideVersion"]}</span></header><p class="kicker">{page["kicker"]}</p><h2>{page["title"]}</h2><p class="lead">{page["lead"]}</p>{action}{"".join(sections)}{note}<footer>{release_label} · {n} / {len(guide["pages"])}</footer></article>')
    return f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>조축ON {guide["audience"]} 사용 가이드</title>
<style>*{{box-sizing:border-box}}body{{margin:0;background:#eaf0e9;color:{INK};font:16px/1.75 system-ui,'Malgun Gothic',sans-serif;word-break:keep-all;overflow-wrap:anywhere}}main{{max-width:640px;margin:auto}}article{{padding:28px 26px;background:#f6f8f3;border-top:6px solid {GREEN};margin:20px 0;box-shadow:0 4px 18px #203b3312;border-radius:12px}}header{{display:flex;justify-content:space-between;gap:16px;color:{GREEN};font-size:14px}}h1{{font-size:17px;margin:24px 20px 0}}h2{{font-size:30px;line-height:1.3;margin:10px 0}}h3{{font-size:19px;color:{GREEN};margin:25px 0 8px}}p{{margin:8px 0}}.lead{{color:{MUTED}}}.kicker{{margin-top:25px;font-size:13px;font-weight:700;color:{GREEN}}}.open-app{{display:block;padding:11px;text-align:center;border-radius:10px;background:{GREEN};color:white;text-decoration:none;margin:20px 0}}aside{{background:#e7efe8;padding:16px;border-radius:10px;margin:24px 0;font-size:14px}}footer{{border-top:1px solid #d7e2d8;padding-top:14px;margin-top:24px;font-size:12px;color:{MUTED}}}li{{margin:6px 0}}ol{{padding-left:24px}}a:focus-visible{{outline:3px solid #c88c25;outline-offset:4px}}@media(max-width:480px){{article{{margin:10px;border-radius:10px;padding:24px 20px}}h2{{font-size:27px}}header span{{font-size:12px}}}}@media print{{article{{box-shadow:none;break-after:page;margin:0}}h1{{display:none}}}}</style>
<main><h1>조축ON {guide["audience"]} 사용 가이드</h1>{''.join(pages)}</main></html>'''


def main():
    parser = argparse.ArgumentParser()
    fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    parser.add_argument("--font", type=Path, default=fonts / "malgun.ttf")
    parser.add_argument("--bold-font", type=Path, default=fonts / "malgunbd.ttf")
    args = parser.parse_args()
    for name, path in [("Guide", args.font), ("GuideBold", args.bold_font)]:
        pdfmetrics.registerFont(TTFont(name, str(path)))
    pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold")
    data = json.loads((OUT / "content.json").read_text(encoding="utf-8"))
    guide_text = html.unescape(re.sub(r"<[^>]+>", "", json.dumps(data["guides"], ensure_ascii=False)))
    for name in ("Guide", "GuideBold"):
        supported = pdfmetrics.getFont(name).face.charToGlyph
        missing = sorted({char for char in guide_text if ord(char) > 32 and ord(char) not in supported})
        if missing:
            raise ValueError(f"Unsupported glyphs in {name}: {missing}")
    delivery = ROOT / "outputs"
    delivery.mkdir(exist_ok=True)
    checks = []
    for guide in data["guides"]:
        stem = f"jochook-on-{guide['id']}-guide"
        pdf = OUT / f"{stem}.pdf"
        layouts = build_pdf(guide, data, pdf)
        (OUT / f"{stem}.html").write_text(build_html(guide, data), encoding="utf-8")
        shutil.copy2(pdf, delivery / pdf.name)
        checks.append({"guide": guide["id"], "layouts": layouts})
    print(json.dumps(checks, ensure_ascii=False))


if __name__ == "__main__":
    main()
