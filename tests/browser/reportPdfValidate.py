"""Validate report bytes independently of jsPDF, then render QA previews."""
import json
import sys
from pathlib import Path

import pymupdf
from pypdf import PdfReader, PdfWriter

path = Path(sys.argv[1])
fillable = sys.argv[2] == "fillable"
reader = PdfReader(path)
rendered = pymupdf.open(path)
if sys.argv[2] == "canvas":
    assert len(reader.pages) == 2, len(reader.pages)
    first = rendered[0].search_for("Canvas first page")
    second = rendered[1].search_for("Canvas second page")
    assert first and second
    factor = (595.28 - 72) / 1000
    assert abs(first[0].x0 - (36 + 80 * factor)) < 2
    assert abs(second[0].x0 - (36 + 160 * factor)) < 2
    assert first[0].y0 < 110 and second[0].y0 < 110
    for i, page in enumerate(rendered):
        page.get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(str(path.with_name(f"canvas-{i + 1}.png")))
    print(json.dumps({"pages": 2, "fields": 0}))
    sys.exit(0)
if sys.argv[2] == "wrapped":
    assert len(reader.pages) == 1
    page = rendered[0]
    header = page.search_for("END HEADER")
    body = page.search_for("BEGIN BODY")
    footer = page.search_for("BEGIN FOOTER")
    assert header and body and footer
    assert max(r.y1 for r in header) < min(r.y0 for r in body)
    assert max(r.y1 for r in body) < min(r.y0 for r in footer)
    page.get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(str(path.with_suffix(".png")))
    print(json.dumps({"pages": 1, "fields": 0}))
    sys.exit(0)
assert len(reader.pages) == 3, len(reader.pages)
text = "\n".join(page.extract_text() for page in reader.pages)
for value in ["Family archive", "\u00c9lodie", "\u5f20\u4f1f", "\u041c\u0430\u0440\u0438\u044f", "\u017deljko", "S\u00f8ren", "\u0141ukasz", "\ud83c\udf33".encode("utf-16", "surrogatepass").decode("utf-16"), "END OF REPORT"]:
    assert value in text, (value, text)
assert "Second section" not in reader.pages[0].extract_text()
assert "Second section" in reader.pages[1].extract_text()
assert "Third section starts" in reader.pages[2].extract_text()
for i, page in enumerate(reader.pages):
    assert abs(float(page.mediabox.width) - 792) < .1
    assert abs(float(page.mediabox.height) - 612) < .1
    assert "Archive header" in page.extract_text()
    assert "Archive footer" in page.extract_text()
    assert f"{i + 1} / 3" in page.extract_text()
    pix = rendered[i].get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25))
    pix.save(str(path.with_name(f"{path.stem}-{i + 1}.png")))
    assert len(set(pix.samples)) > 50

fields = reader.get_fields() or {}
widgets = [ref for page in reader.pages for ref in page.get("/Annots", []) if ref.get_object().get("/Subtype") == "/Widget"]
if fillable:
    expected = ["\u00c9lodie \u5f20\u4f1f", "\u041c\u0430\u0440\u0438\u044f", "Line one\nLine two (reviewed) \\ family", ""]
    assert len(fields) == len(widgets) == 4, (fields, widgets)
    canonical = reader.trailer["/Root"]["/AcroForm"]["/Fields"]
    assert not hasattr(reader.trailer["/Root"]["/AcroForm"], "get_data")
    assert {ref.idnum for ref in canonical} == {ref.idnum for ref in widgets}
    for i, ref in enumerate(widgets):
        widget = ref.get_object()
        assert not hasattr(widget, "get_data")
        name = f"report_field_{i + 1}"
        assert widget["/T"] == name
        assert widget["/V"] == fields[name]["/V"] == expected[i], (name, widget["/V"])
        assert widget["/FT"] == "/Tx"
        assert not widget.get("/Ff", 0) & 1
        assert bool(widget.get("/Ff", 0) & 4096) == (i == 2)
        assert widget["/AP"]["/N"].get_data()
        assert "/DA" in widget
        rect = widget["/Rect"]
        assert rect[0] >= 36 and rect[2] <= 756
        assert rect[1] >= 36 and rect[3] <= 576
    # Refill through a different PDF implementation. Reopening must see the new
    # canonical value and appearance, and the old value must not be baked in.
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    updated_name = "\u9648\u7f8e Chang"
    writer.update_page_form_field_values(None, {"report_field_1": updated_name, "report_field_2": "\u041c\u0430\u0440\u0438\u043d\u0430"}, auto_regenerate=False)
    edited = path.with_name("refilled.pdf")
    with edited.open("wb") as output:
        writer.write(output)
    reopened = PdfReader(edited)
    assert reopened.get_fields()["report_field_1"]["/V"] == updated_name
    for page in reopened.pages:
        for ref in page.get("/Annots", []):
            widget = ref.get_object()
            if widget.get("/T") == "report_field_1":
                assert widget["/V"] == updated_name
                assert widget["/AP"]["/N"].get_data()
    edited_doc = pymupdf.open(edited)
    edited_doc[0].get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(str(path.with_name("refilled-1.png")))
else:
    assert not widgets and not fields

print(json.dumps({"pages": len(reader.pages), "fields": len(fields), "characters": len(text)}))
