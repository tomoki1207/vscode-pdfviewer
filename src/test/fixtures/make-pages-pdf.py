#!/usr/bin/env python3
"""Generate pages.pdf: five numbered pages for navigation tests.

  - named destination "intro" -> page 4 (open as pages.pdf#nameddest=intro)
  - an open sticky note (Text annotation + Popup) on page 1, whose text must
    be readable in both light and dark VS Code themes
"""
import pathlib

PAGES = 5
INTRO_PAGE = 4


def stream(data):
    return b"<< /Length %d >>\nstream\n" % len(data) + data + b"\nendstream"


def build():
    # Objects 1-4 are fixed; each page n (1-based) is object 4 + 2n - 1 and
    # its content stream the object after it
    def page_ref(n):
        return b"%d 0 R" % (4 + 2 * n - 1)

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R"
        b" /Names << /Dests << /Names [(intro) [%s /XYZ null null null]] >> >> >>"
        % page_ref(INTRO_PAGE),
        b"<< /Type /Pages /Kids [%s] /Count %d >>"
        % (b" ".join(page_ref(n) for n in range(1, PAGES + 1)), PAGES),
        b"<< /Type /Annot /Subtype /Text /Rect [72 600 96 624] /Open true"
        b" /C [1 1 0] /T (Reviewer) /Contents (This note should be readable.)"
        b" /Popup 4 0 R >>",
        b"<< /Type /Annot /Subtype /Popup /Parent 3 0 R"
        b" /Rect [100 480 340 600] /Open true >>",
    ]
    for n in range(1, PAGES + 1):
        annots = b" /Annots [3 0 R 4 0 R]" if n == 1 else b""
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]"
            b" /Contents %d 0 R%s"
            b" /Resources << /Font << /F1 << /Type /Font /Subtype /Type1"
            b" /BaseFont /Helvetica >> >> >> >>" % (len(objects) + 2, annots)
        )
        objects.append(stream(b"BT /F1 96 Tf 72 360 Td (Page %d) Tj ET" % n))

    out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    return bytes(out)


if __name__ == "__main__":
    target = pathlib.Path(__file__).with_name("pages.pdf")
    target.write_bytes(build())
    print(f"wrote {target}")
