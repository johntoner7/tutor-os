"""
Extract graph/diagram images from past paper PDFs.

Two-step workflow:
  1. Render pages to PNGs so you can visually identify graphs:
       uv run python scripts/extract_images.py render path/to/paper.pdf

  2. Crop the graph region and save it under a question ID:
       uv run python scripts/extract_images.py crop path/to/paper.pdf \\
           --page 3 --x0 50 --y0 200 --x1 550 --y1 420 \\
           --out 2025_unit1_q1

     Coordinates are in PDF points (pt), measured from the top-left of the page.
     1 inch = 72 pt. A4 page is 595 × 842 pt.

  After cropping, add "image_path": "<question_id>.png" to the matching entry
  in data/question_chunks.json, then re-run:
       uv run python scripts/embed_and_index.py

Usage hints
-----------
  render  Saves every page as <pdf_stem>_p<N>.png in a temp dir and prints the paths.
          Open them in Preview / your image viewer to identify the graph coordinates.

  crop    Saves static/images/<out>.png and prints the absolute path.
          DPI defaults to 150 (good balance of size vs clarity); use --dpi 300 for print quality.
"""

import argparse
import sys
import tempfile
from pathlib import Path

import fitz  # PyMuPDF


STATIC_DIR = Path(__file__).parent.parent / "static" / "images"


def cmd_render(pdf_path: Path, dpi: int) -> None:
    doc = fitz.open(str(pdf_path))
    out_dir = Path(tempfile.mkdtemp(prefix="bio_pages_"))
    print(f"Rendering {len(doc)} page(s) from '{pdf_path.name}' at {dpi} DPI → {out_dir}\n")
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc):
        out = out_dir / f"{pdf_path.stem}_p{i + 1}.png"
        pix = page.get_pixmap(matrix=matrix)
        pix.save(str(out))
        w, h = page.rect.width, page.rect.height
        print(f"  Page {i + 1:>3}  {int(w)} × {int(h)} pt  →  {out}")
    print(f"\nOpen these files to identify graph coordinates.")
    print("Page dimensions in pt (1 inch = 72 pt). Top-left is (0, 0).")


def cmd_crop(
    pdf_path: Path,
    page_num: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    out_name: str,
    dpi: int,
    padding: int,
) -> None:
    doc = fitz.open(str(pdf_path))
    if page_num < 1 or page_num > len(doc):
        print(f"Error: page {page_num} out of range (PDF has {len(doc)} pages).")
        sys.exit(1)

    page = doc[page_num - 1]
    page_h = page.rect.height

    # PyMuPDF uses bottom-left origin internally; fitz.Rect uses top-left
    rect = fitz.Rect(x0 - padding, y0 - padding, x1 + padding, y1 + padding)

    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    clip = rect & page.rect  # clamp to page bounds

    pix = page.get_pixmap(matrix=matrix, clip=clip)

    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    out_path = STATIC_DIR / f"{out_name}.png"
    pix.save(str(out_path))

    print(f"Saved: {out_path}")
    print(f"  Cropped region: ({clip.x0:.0f}, {clip.y0:.0f}) → ({clip.x1:.0f}, {clip.y1:.0f}) pt")
    print(f"  Output size: {pix.width} × {pix.height} px at {dpi} DPI")
    print()
    print("Next steps:")
    print(f'  1. Add  "image_path": "{out_name}.png"  to the matching entry in data/question_chunks.json')
    print(f"  2. Re-run: uv run python scripts/embed_and_index.py")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract graph images from past paper PDFs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # render subcommand
    p_render = sub.add_parser("render", help="Render all pages as PNGs to identify coordinates.")
    p_render.add_argument("pdf", type=Path, help="Path to the PDF file.")
    p_render.add_argument("--dpi", type=int, default=150, help="Render DPI (default: 150).")

    # crop subcommand
    p_crop = sub.add_parser("crop", help="Crop a region and save as a question image.")
    p_crop.add_argument("pdf", type=Path, help="Path to the PDF file.")
    p_crop.add_argument("--page", type=int, required=True, help="1-based page number.")
    p_crop.add_argument("--x0", type=float, required=True, help="Left edge in pt.")
    p_crop.add_argument("--y0", type=float, required=True, help="Top edge in pt.")
    p_crop.add_argument("--x1", type=float, required=True, help="Right edge in pt.")
    p_crop.add_argument("--y1", type=float, required=True, help="Bottom edge in pt.")
    p_crop.add_argument("--out", required=True, help="Output filename stem (= question ID, e.g. 2025_unit1_q1).")
    p_crop.add_argument("--dpi", type=int, default=150, help="Output DPI (default: 150).")
    p_crop.add_argument("--padding", type=int, default=8, help="Extra padding in pt around the crop (default: 8).")

    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"Error: file not found: {args.pdf}")
        sys.exit(1)

    if args.cmd == "render":
        cmd_render(args.pdf, args.dpi)
    elif args.cmd == "crop":
        cmd_crop(args.pdf, args.page, args.x0, args.y0, args.x1, args.y1, args.out, args.dpi, args.padding)


if __name__ == "__main__":
    main()
