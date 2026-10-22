#!/usr/bin/env python3
"""Generate features.pdf: one page per PDF.js feature that loads extra assets.

  1. Japanese text in a non-embedded CID font -> lib/web/cmaps/
  2. DeviceCMYK fill                           -> lib/web/iccs/ + wasm/ (QCMS)
  3. JPEG 2000 image                           -> lib/web/wasm/ (OpenJPEG)

Needs Pillow built with JPEG 2000 support.
"""
import io
import pathlib

from PIL import Image


def jpx_bytes(size=64):
    img = Image.new("RGB", (size, size))
    img.putdata([(x * 4, y * 4, 128) for y in range(size) for x in range(size)])
    buf = io.BytesIO()
    img.save(buf, format="JPEG2000")
    return buf.getvalue(), size


def stream(dict_entries, data):
    return b"<< " + dict_entries + b" /Length %d >>\nstream\n" % len(data) + data + b"\nendstream"


def build():
    jpx, size = jpx_bytes()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R"
        b" /Resources << /Font << /F1 9 0 R >> >> >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R"
        b" /Resources << /XObject << /Im1 11 0 R >> >> >>",
        # "日本語" as UCS-2
        stream(b"", b"BT /F1 48 Tf 72 680 Td <65E5672C8A9E> Tj ET"),
        stream(b"", b"0 1 1 0 k 72 400 300 300 re f"),
        stream(b"", b"q 300 0 0 300 72 400 cm /Im1 Do Q"),
        b"<< /Type /Font /Subtype /Type0 /BaseFont /KozMinPr6N-Regular"
        b" /Encoding /UniJIS-UCS2-H /DescendantFonts [10 0 R] >>",
        b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /KozMinPr6N-Regular"
        b" /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >>"
        b" /FontDescriptor 12 0 R >>",
        stream(
            b"/Type /XObject /Subtype /Image /Width %d /Height %d /Filter /JPXDecode"
            % (size, size),
            jpx,
        ),
        b"<< /Type /FontDescriptor /FontName /KozMinPr6N-Regular /Flags 6"
        b" /FontBBox [0 -120 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120"
        b" /CapHeight 700 /StemV 80 >>",
    ]
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
    target = pathlib.Path(__file__).with_name("features.pdf")
    target.write_bytes(build())
    print(f"wrote {target}")
