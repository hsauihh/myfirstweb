"""把 assets/fonts/genshin.ttf 切成按使用频率分层的 WOFF2 分片，并生成对应 CSS。

为什么按频率分层而不是按码点均分：中文常用字在 Unicode 里是散布的，按码点均分的分片
会让一段普通中文命中几乎所有分片（等于下载整份字体）。分层后普通中文只需
`basic + cjk1` 两个分片，其余分片只在真出现生僻字时才下载。

分层口径（优先级从高到低）：
    cjk1  —— GB2312 一级汉字（3755 个常用字），覆盖现代中文约 99.7% 的用字
    cjk2  —— GB2312 二级汉字（3008 个）
    basic —— ASCII / 拉丁 / 通用标点 / 全角形式
    cjk3  —— 其余全部字形（生僻字、扩展区）

分片之间必须严格不重叠：@font-face 的 unicode-range 一旦重叠，浏览器会为常用字
额外下载生僻分片。合并区间时只允许「生僻层被常用层吸收」，绝不允许反向。

用法：
    uv run --with fonttools --with brotli python scripts/subset_genshin.py
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "fonts" / "genshin.ttf"
OUT_DIR = ROOT / "public" / "fonts" / "genshin"
CSS_FILE = ROOT / "css" / "genshin-font.css"
FONT_FAMILY = "Genshin"
URL_PREFIX = "/fonts/genshin"

# GB2312 一级 / 二级汉字的字节区间（含端点）
GB2312_LEVEL1 = (0xB0A1, 0xD7F9)
GB2312_LEVEL2 = (0xD8A1, 0xF7FE)

# basic 层覆盖的码点区间（ASCII、拉丁扩展、常用标点、CJK 标点、全角形式）
BASIC_RANGES = (
    (0x0020, 0x2E7F),
    (0x3000, 0x303F),
    (0xFF00, 0xFFEF),
)

TIER_ORDER = ("cjk1", "cjk2", "basic", "cjk3")
TIER_NOTE = {
    "cjk1": "GB2312 一级汉字（常用字）",
    "cjk2": "GB2312 二级汉字（次常用字）",
    "basic": "ASCII / 拉丁 / 通用标点 / 全角形式",
    "cjk3": "其余字形（生僻字与扩展区）",
}


def gb2312_codepoints(start: int, end: int) -> set[int]:
    """把 GB2312 字节区间展开成 Unicode 码点集合。"""
    points: set[int] = set()
    for high in range(start >> 8, (end >> 8) + 1):
        for low in range(0xA1, 0xFF):
            code = (high << 8) | low
            if not start <= code <= end:
                continue
            try:
                points.add(ord(bytes((high, low)).decode("gb2312")))
            except UnicodeDecodeError:
                continue
    return points


def font_codepoints(path: Path) -> set[int]:
    font = TTFont(path, lazy=True)
    points = {code for table in font["cmap"].tables for code in table.cmap}
    font.close()
    return points


def assign_tiers(points: set[int]) -> dict[str, set[int]]:
    """按优先级把码点分进各层；优先级高的层先取走。"""
    tiers = {name: set() for name in TIER_ORDER}
    level1 = gb2312_codepoints(*GB2312_LEVEL1)
    level2 = gb2312_codepoints(*GB2312_LEVEL2)
    in_basic = lambda code: any(low <= code <= high for low, high in BASIC_RANGES)
    for code in points:
        if code in level1:
            tiers["cjk1"].add(code)
        elif code in level2:
            tiers["cjk2"].add(code)
        elif in_basic(code):
            tiers["basic"].add(code)
        else:
            tiers["cjk3"].add(code)
    return tiers


def to_ranges(codes: set[int]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for code in sorted(codes):
        if ranges and code == ranges[-1][1] + 1:
            ranges[-1] = (ranges[-1][0], code)
        else:
            ranges.append((code, code))
    return ranges


def format_ranges(ranges: list[tuple[int, int]]) -> str:
    return ", ".join(
        f"U+{low:04X}" if low == high else f"U+{low:04X}-{high:04X}"
        for low, high in ranges
    )


def build_slices(points: set[int]) -> dict[str, list[tuple[int, int]]]:
    """产出各层的码点区间。优先级高的层先取，保证各层互不重叠。"""
    tiers = assign_tiers(points)
    slices: dict[str, list[tuple[int, int]]] = {}
    unclaimed = set(points)
    for name in TIER_ORDER:
        codes = tiers[name] & unclaimed
        if not codes:
            continue
        unclaimed -= codes
        slices[name] = to_ranges(codes)
    # 最后一层吸收全部残余，避免任何字形漏网
    if unclaimed:
        slices["cjk3"] = to_ranges(unclaimed | set(tiers["cjk3"]))
    return slices


def write_slice(path: Path, ranges: list[tuple[int, int]]) -> int:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes={code for low, high in ranges for code in range(low, high + 1)})
    subsetter.subset(font)
    subset.save_font(font, str(path), options)
    font.close()
    return path.stat().st_size


def write_css(slices: dict[str, list[tuple[int, int]]]) -> None:
    blocks = [
        "/* 由 scripts/subset_genshin.py 生成，请勿手改。*/",
        f"/* 分层：{' / '.join(f'{name}={TIER_NOTE[name]}' for name in slices)} */",
    ]
    for name, ranges in slices.items():
        blocks.append(
            "\n".join(
                [
                    "@font-face {",
                    f'  font-family: "{FONT_FAMILY}";',
                    "  font-weight: 400;",
                    "  font-style: normal;",
                    "  font-display: swap;",
                    f'  src: url("{URL_PREFIX}/genshin-{name}.woff2") format("woff2");',
                    f"  unicode-range: {format_ranges(ranges)};",
                    "}",
                ]
            )
        )
    CSS_FILE.write_text("\n".join(blocks) + "\n", encoding="utf-8")


def main() -> int:
    if not SOURCE.is_file():
        print(f"找不到源字体：{SOURCE}", file=sys.stderr)
        return 1
    points = font_codepoints(SOURCE)
    slices = build_slices(points)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("genshin-*.woff2"):
        stale.unlink()
    total = 0
    for name, ranges in slices.items():
        size = write_slice(OUT_DIR / f"genshin-{name}.woff2", ranges)
        total += size
        covered = sum(high - low + 1 for low, high in ranges)
        print(f"  genshin-{name}.woff2  {size / 1024:7.1f}KB  {len(ranges):4d} 区间  {covered:6d} 码点")
    write_css(slices)
    print(
        f"源字体 {SOURCE.stat().st_size / 1024 / 1024:.2f}MB，"
        f"{len(points)} 个字形，分片合计 {total / 1024 / 1024:.2f}MB"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
