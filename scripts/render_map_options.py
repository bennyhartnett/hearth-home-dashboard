import json
import math
import random
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "map-options"
CENTER_LAT = 38.8838248
CENTER_LON = -77.0904684
WIDTH = 2400
HEIGHT = 800

SOUTH = CENTER_LAT - 0.0032
NORTH = CENTER_LAT + 0.0032
WEST = CENTER_LON - 0.0105
EAST = CENTER_LON + 0.0105

QUERY = f"""
[out:json][timeout:90];
(
  way["highway"]({SOUTH},{WEST},{NORTH},{EAST});
  way["building"]({SOUTH},{WEST},{NORTH},{EAST});
  way["leisure"="park"]({SOUTH},{WEST},{NORTH},{EAST});
  way["landuse"~"grass|recreation_ground|commercial|retail"]({SOUTH},{WEST},{NORTH},{EAST});
  way["natural"="water"]({SOUTH},{WEST},{NORTH},{EAST});
  way["waterway"]({SOUTH},{WEST},{NORTH},{EAST});
);
out geom;
"""


STYLES = [
    {"name": "OLED Minimal", "bg": "#050505", "road": "#f7f7f7", "casing": "#292929", "building": "#262626", "outline": "#555555", "park": "#111111", "water": "#181818", "pin_bg": "#ffffff", "pin_fg": "#050505", "road_scale": 0.78, "glow": True, "minimal": True},
    {"name": "Swiss Modern", "bg": "#f5f5f2", "road": "#101010", "casing": "#ffffff", "building": "#a8a8a5", "outline": "#777777", "park": "#e8e8e4", "water": "#d8d8d4", "pin_bg": "#101010", "pin_fg": "#ffffff", "road_scale": 0.88, "grid": True},
    {"name": "Dark Glass", "bg": "#0c0f11", "road": "#dfe4e6", "casing": "#30363a", "building": "#242a2e", "outline": "#60686d", "park": "#151a1d", "water": "#1b2226", "pin_bg": "#e9edef", "pin_fg": "#080a0b", "road_scale": 0.72, "shadow": 7, "glow": True},
    {"name": "Spatial White", "bg": "#e9e9e7", "road": "#ffffff", "casing": "#242424", "building": "#f8f8f7", "outline": "#9b9b98", "park": "#d9d9d6", "water": "#cfcfcd", "pin_bg": "#111111", "pin_fg": "#ffffff", "road_scale": 0.82, "shadow": 9, "emboss": True},
    {"name": "Neo Brutalist", "bg": "#ffffff", "road": "#050505", "casing": "#050505", "building": "#d5d5d5", "outline": "#050505", "park": "#eeeeee", "water": "#bbbbbb", "pin_bg": "#050505", "pin_fg": "#ffffff", "road_scale": 1.14, "minimal": True},
    {"name": "Luxury Editorial", "bg": "#101010", "road": "#dedede", "casing": "#383838", "building": "#202020", "outline": "#777777", "park": "#181818", "water": "#242424", "pin_bg": "#dedede", "pin_fg": "#101010", "road_scale": 0.58, "hairline": True},
    {"name": "Technical Draft", "bg": "#111417", "road": "#d9dde0", "casing": "#394047", "building": "#171b1f", "outline": "#6b747c", "park": "#14181b", "water": "#20262b", "pin_bg": "#dfe3e6", "pin_fg": "#111417", "road_scale": 0.62, "grid": True, "centerlines": True},
    {"name": "Automotive HUD", "bg": "#07090a", "road": "#f0f2f3", "casing": "#242a2e", "building": "#181c1f", "outline": "#3d454a", "park": "#101315", "water": "#151a1d", "pin_bg": "#ffffff", "pin_fg": "#07090a", "road_scale": 0.67, "glow": True, "centerlines": True},
    {"name": "Black Chrome", "bg": "#080808", "road": "#858585", "casing": "#171717", "building": "#202020", "outline": "#9a9a9a", "park": "#101010", "water": "#181818", "pin_bg": "#d7d7d7", "pin_fg": "#080808", "road_scale": 0.9, "emboss": True, "shadow": 6},
    {"name": "Contour Minimal", "bg": "#f6f6f4", "road": "#171717", "casing": "#f6f6f4", "building": "#e4e4e0", "outline": "#a8a8a2", "park": "#ededeb", "water": "#dadad6", "pin_bg": "#171717", "pin_fg": "#ffffff", "road_scale": 0.48, "contours": True, "minimal": True},
    {"name": "Circuit Grid", "bg": "#090b0c", "road": "#eceff0", "casing": "#31363a", "building": "#24282b", "outline": "#4d555a", "park": "#121517", "water": "#1b2023", "pin_bg": "#f2f4f5", "pin_fg": "#090b0c", "road_scale": 0.5, "grid": True, "nodes": True},
    {"name": "Soft Clay", "bg": "#d8d8d5", "road": "#eeeeec", "casing": "#a2a2a0", "building": "#c4c4c1", "outline": "#a6a6a3", "park": "#cececa", "water": "#bbbbB8", "pin_bg": "#292929", "pin_fg": "#ffffff", "road_scale": 0.92, "shadow": 12, "emboss": True},
    {"name": "Paper Cut", "bg": "#f3f3f0", "road": "#1b1b1b", "casing": "#ffffff", "building": "#d0d0cc", "outline": "#a4a4a0", "park": "#e6e6e2", "water": "#c1c1bd", "pin_bg": "#1b1b1b", "pin_fg": "#ffffff", "road_scale": 0.82, "shadow": 10, "paper": True},
    {"name": "Architect Model", "bg": "#111111", "road": "#2e2e2e", "casing": "#080808", "building": "#eeeeeb", "outline": "#bcbcb8", "park": "#181818", "water": "#252525", "pin_bg": "#ffffff", "pin_fg": "#111111", "road_scale": 0.86, "shadow": 11, "emboss": True},
    {"name": "Data Grid", "bg": "#eeeeec", "road": "#202020", "casing": "#eeeeec", "building": "#b9b9b6", "outline": "#8e8e8a", "park": "#dededb", "water": "#c8c8c5", "pin_bg": "#202020", "pin_fg": "#ffffff", "road_scale": 0.62, "grid": True, "nodes": True},
    {"name": "Cinematic Matte", "bg": "#030303", "road": "#f5f5f5", "casing": "#1e1e1e", "building": "#151515", "outline": "#444444", "park": "#0c0c0c", "water": "#111111", "pin_bg": "#ffffff", "pin_fg": "#030303", "road_scale": 0.8, "vignette": True, "car_trails": True},
    {"name": "Silver Layer", "bg": "#17191a", "road": "#bfc3c5", "casing": "#313537", "building": "#2c3032", "outline": "#747b7e", "park": "#202325", "water": "#282d2f", "pin_bg": "#d9dcdd", "pin_fg": "#17191a", "road_scale": 0.72, "shadow": 6, "hairline": True},
    {"name": "Minimal Ink", "bg": "#ffffff", "road": "#161616", "casing": "#ffffff", "building": "#f0f0ed", "outline": "#b8b8b3", "park": "#f7f7f4", "water": "#e4e4df", "pin_bg": "#161616", "pin_fg": "#ffffff", "road_scale": 0.42, "minimal": True},
    {"name": "Kinetic Lines", "bg": "#0c0c0c", "road": "#e8e8e8", "casing": "#292929", "building": "#212121", "outline": "#4f4f4f", "park": "#151515", "water": "#1a1a1a", "pin_bg": "#f0f0f0", "pin_fg": "#0c0c0c", "road_scale": 0.66, "car_trails": True, "centerlines": True},
    {"name": "Hyper Clean", "bg": "#e7e7e5", "road": "#ffffff", "casing": "#101010", "building": "#c9c9c6", "outline": "#8f8f8b", "park": "#d9d9d5", "water": "#bdbdba", "pin_bg": "#101010", "pin_fg": "#ffffff", "road_scale": 0.74, "shadow": 5, "minimal": True},
]


def fetch_osm():
    map_url = (
        "https://api.openstreetmap.org/api/0.6/map?bbox="
        f"{WEST},{SOUTH},{EAST},{NORTH}"
    )
    try:
        request = urllib.request.Request(
            map_url,
            headers={"User-Agent": "HearthHomeDashboard/63 (non-AI map renderer)"},
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            root = ET.fromstring(response.read())
        nodes = {
            node.attrib["id"]: {
                "lat": float(node.attrib["lat"]),
                "lon": float(node.attrib["lon"]),
            }
            for node in root.findall("node")
        }
        elements = []
        for way in root.findall("way"):
            tags = {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")}
            relevant = (
                "highway" in tags
                or "building" in tags
                or tags.get("leisure") == "park"
                or tags.get("landuse") in {"grass", "recreation_ground", "commercial", "retail"}
                or tags.get("natural") == "water"
                or "waterway" in tags
            )
            if not relevant:
                continue
            geometry = [nodes[nd.attrib["ref"]] for nd in way.findall("nd") if nd.attrib["ref"] in nodes]
            elements.append({"tags": tags, "geometry": geometry})
        return {"elements": elements}
    except Exception as map_error:
        errors = [f"{map_url}: {map_error}"]

    for endpoint in (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://overpass.nchc.org.tw/api/interpreter",
    ):
        request = urllib.request.Request(
            endpoint,
            data=urllib.parse.urlencode({"data": QUERY}).encode(),
            headers={"User-Agent": "HearthHomeDashboard/63 (non-AI map renderer)"},
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except Exception as error:
            errors.append(f"{endpoint}: {error}")
    raise RuntimeError("Unable to load OSM vector data: " + "; ".join(errors))


def project(lat, lon):
    x = (lon - WEST) / (EAST - WEST) * WIDTH
    y = (NORTH - lat) / (NORTH - SOUTH) * HEIGHT
    return (round(x), round(y))


def points_for(element):
    return [project(point["lat"], point["lon"]) for point in element.get("geometry", [])]


def load_font(size, bold=False):
    names = ["arialbd.ttf" if bold else "arial.ttf", "segoeuib.ttf" if bold else "segoeui.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def draw_background_pattern(draw, style):
    if style.get("grid"):
        color = style["outline"]
        for x in range(0, WIDTH, 80):
            draw.line((x, 0, x, HEIGHT), fill=color, width=1)
        for y in range(0, HEIGHT, 80):
            draw.line((0, y, WIDTH, y), fill=color, width=1)
    if style.get("contours"):
        for offset in range(-200, 2600, 145):
            points = []
            for y in range(-40, HEIGHT + 40, 20):
                x = offset + 35 * math.sin(y / 85 + offset / 230)
                points.append((x, y))
            draw.line(points, fill=style["outline"], width=1)


def line_length(points):
    return sum(math.dist(a, b) for a, b in zip(points, points[1:]))


def point_on_polyline(points, fraction):
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    total = sum(lengths)
    target = total * fraction
    walked = 0
    for index, length in enumerate(lengths):
        if walked + length >= target and length:
            amount = (target - walked) / length
            a, b = points[index], points[index + 1]
            x = a[0] + (b[0] - a[0]) * amount
            y = a[1] + (b[1] - a[1]) * amount
            return (x, y, math.atan2(b[1] - a[1], b[0] - a[0]))
        walked += length
    a, b = points[-2], points[-1]
    return (b[0], b[1], math.atan2(b[1] - a[1], b[0] - a[0]))


def draw_car(draw, x, y, angle, fill, outline, trail=False):
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    def rotate(px, py):
        return (x + px * cos_a - py * sin_a, y + px * sin_a + py * cos_a)
    if trail:
        for distance, alpha in ((34, 1), (24, 2), (15, 3)):
            start = rotate(-distance, 0)
            end = rotate(-10, 0)
            draw.line((start, end), fill=outline, width=alpha)
    body = [rotate(-11, -5), rotate(10, -5), rotate(13, 0), rotate(10, 5), rotate(-11, 5), rotate(-14, 0)]
    draw.polygon(body, fill=fill, outline=outline)
    cabin = [rotate(-3, -4), rotate(6, -4), rotate(8, 0), rotate(6, 4), rotate(-3, 4)]
    draw.polygon(cabin, fill=outline)


def dashed_line(draw, points, fill, width=2, dash=14, gap=12):
    for a, b in zip(points, points[1:]):
        length = math.dist(a, b)
        if length == 0:
            continue
        ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        distance = 0
        while distance < length:
            end = min(length, distance + dash)
            draw.line((a[0] + ux * distance, a[1] + uy * distance, a[0] + ux * end, a[1] + uy * end), fill=fill, width=width)
            distance += dash + gap


def render_map(
    data,
    style,
    number,
    show_option_label=True,
    show_address_marker=True,
    show_attribution=True,
    output_path=None,
):
    image = Image.new("RGB", (WIDTH, HEIGHT), style["bg"])
    draw = ImageDraw.Draw(image)
    draw_background_pattern(draw, style)
    elements = data.get("elements", [])

    for element in elements:
        tags = element.get("tags", {})
        points = points_for(element)
        if len(points) < 3:
            continue
        if tags.get("natural") == "water" or "waterway" in tags:
            draw.polygon(points, fill=style["water"])
        elif tags.get("leisure") == "park" or tags.get("landuse") in {"grass", "recreation_ground"}:
            draw.polygon(points, fill=style["park"])

    buildings = []
    for element in elements:
        points = points_for(element)
        if len(points) >= 3 and "building" in element.get("tags", {}):
            buildings.append(points)

    shadow = int(style.get("shadow", 0))
    if shadow:
        shadow_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        for points in buildings:
            shadow_draw.polygon([(x + shadow, y + shadow) for x, y in points], fill=(0, 0, 0, 95))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(max(2, shadow // 2)))
        image = Image.alpha_composite(image.convert("RGBA"), shadow_layer).convert("RGB")
        draw = ImageDraw.Draw(image)

    for points in buildings:
        draw.polygon(points, fill=style["building"], outline=style["outline"])
        if style.get("emboss"):
            draw.line(points[: max(2, len(points) // 2)], fill="#ffffff", width=1)

    base_widths = {
        "motorway": 25, "trunk": 23, "primary": 20, "secondary": 16,
        "tertiary": 13, "residential": 9, "unclassified": 8, "service": 6,
        "living_street": 7, "cycleway": 3, "footway": 2, "path": 2,
    }
    roads = []
    for element in elements:
        tags = element.get("tags", {})
        highway = tags.get("highway")
        points = points_for(element)
        if highway and len(points) >= 2:
            width = max(1, round(base_widths.get(highway, 4) * style["road_scale"]))
            roads.append((width, highway, points, line_length(points)))

    if style.get("glow"):
        glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        for width, highway, points, _ in roads:
            if highway not in {"footway", "path", "cycleway"}:
                glow_draw.line(points, fill=(255, 255, 255, 110), width=width + 7, joint="curve")
        glow = glow.filter(ImageFilter.GaussianBlur(7))
        image = Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")
        draw = ImageDraw.Draw(image)

    for width, highway, points, _ in sorted(roads, key=lambda road: road[0]):
        if highway in {"footway", "path", "cycleway"}:
            draw.line(points, fill=style["outline"], width=max(1, width), joint="curve")
            continue
        casing_extra = 3 if style.get("hairline") else 6
        draw.line(points, fill=style["casing"], width=width + casing_extra, joint="curve")
        draw.line(points, fill=style["road"], width=width, joint="curve")
        if style.get("centerlines") and width >= 12:
            dashed_line(draw, points, style["bg"], width=max(1, width // 8))

    if style.get("nodes"):
        for width, highway, points, length in roads:
            if width >= 7 and length > 180:
                x, y, _ = point_on_polyline(points, 0.5)
                radius = 3
                draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=style["pin_bg"])

    candidates = sorted(
        [road for road in roads if road[0] >= 10 and road[3] > 220],
        key=lambda road: road[3],
        reverse=True,
    )
    for index, road in enumerate(candidates[:6]):
        _, _, points, _ = road
        fraction = (0.22, 0.43, 0.66, 0.78, 0.34, 0.57)[index]
        x, y, angle = point_on_polyline(points, fraction)
        draw_car(draw, x, y, angle, style["pin_bg"], style["pin_fg"], style.get("car_trails", False))

    if show_address_marker:
        center_x, center_y = project(CENTER_LAT, CENTER_LON)
        pin_radius = 22
        draw.ellipse((center_x - pin_radius, center_y - pin_radius, center_x + pin_radius, center_y + pin_radius), fill=style["pin_bg"], outline=style["pin_fg"], width=4)
        draw.ellipse((center_x - 7, center_y - 7, center_x + 7, center_y + 7), fill=style["pin_fg"])

        label_font = load_font(33, bold=True)
        label = "923 N DANIEL"
        box = draw.textbbox((0, 0), label, font=label_font)
        label_width = box[2] - box[0]
        label_height = box[3] - box[1]
        label_x = min(WIDTH - label_width - 35, center_x + 36)
        label_y = center_y - label_height // 2
        draw.rounded_rectangle((label_x - 14, label_y - 9, label_x + label_width + 14, label_y + label_height + 11), radius=14, fill=style["pin_bg"], outline=style["pin_fg"], width=3)
        draw.text((label_x, label_y), label, fill=style["pin_fg"], font=label_font)

    if show_attribution:
        attribution_font = load_font(17, bold=False)
        attribution = "© OpenStreetMap contributors"
        attr_box = draw.textbbox((0, 0), attribution, font=attribution_font)
        attr_width = attr_box[2] - attr_box[0]
        draw.rounded_rectangle((WIDTH - attr_width - 34, HEIGHT - 36, WIDTH - 10, HEIGHT - 9), radius=8, fill=style["pin_bg"])
        draw.text((WIDTH - attr_width - 22, HEIGHT - 33), attribution, fill=style["pin_fg"], font=attribution_font)

    if style.get("vignette"):
        vignette = Image.new("L", image.size, 0)
        vdraw = ImageDraw.Draw(vignette)
        vdraw.ellipse((-300, -500, WIDTH + 300, HEIGHT + 500), fill=160)
        vignette = vignette.filter(ImageFilter.GaussianBlur(150))
        shade = Image.new("RGB", image.size, "#000000")
        image = Image.composite(image, shade, vignette.point(lambda value: 255 - value))

    if show_option_label:
        number_font = load_font(27, bold=True)
        draw = ImageDraw.Draw(image)
        number_label = f"{number:02d}  {style['name'].upper()}"
        draw.rounded_rectangle((14, 14, 390, 59), radius=12, fill=style["pin_bg"], outline=style["pin_fg"], width=2)
        draw.text((29, 22), number_label, fill=style["pin_fg"], font=number_font)

    output = output_path or OUTPUT_DIR / f"{number:02d}-{style['name'].lower().replace(' ', '-')}.png"
    image.save(output, optimize=True)
    return output


def make_contact_sheets(files):
    label_font = load_font(25, bold=True)
    thumb_width = 1000
    thumb_height = round(thumb_width * HEIGHT / WIDTH)
    gap = 22
    label_height = 42
    sheet_width = thumb_width * 2 + gap * 3
    sheet_height = (thumb_height + label_height) * 2 + gap * 3
    for sheet_index in range(5):
        sheet = Image.new("RGB", (sheet_width, sheet_height), "#0b0b0b")
        draw = ImageDraw.Draw(sheet)
        for slot, path in enumerate(files[sheet_index * 4: sheet_index * 4 + 4]):
            row, column = divmod(slot, 2)
            x = gap + column * (thumb_width + gap)
            y = gap + row * (thumb_height + label_height + gap)
            number = sheet_index * 4 + slot + 1
            title = f"{number:02d}  {STYLES[number - 1]['name']}"
            draw.text((x, y), title, fill="#ffffff", font=label_font)
            thumb = Image.open(path).convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x, y + label_height))
        sheet.save(OUTPUT_DIR / f"contact-sheet-{sheet_index + 1}.png", optimize=True)


def make_car_overlay(data):
    candidates = []
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        highway = tags.get("highway")
        points = points_for(element)
        if not highway or len(points) < 2 or highway in {"footway", "path", "cycleway", "steps"}:
            continue
        runs = []
        run = []
        for point_index, point in enumerate(points):
            x, y = point
            inside = -60 <= x <= WIDTH + 60 and -60 <= y <= HEIGHT + 60
            if inside:
                if not run and point_index > 0:
                    run.append(points[point_index - 1])
                run.append(point)
            elif run:
                run.append(point)
                if len(run) >= 2:
                    runs.append(run)
                run = []
        if len(run) >= 2:
            runs.append(run)
        for visible_points in runs:
            length = line_length(visible_points)
            if length >= 230:
                candidates.append((highway, visible_points, length))

    priority = {
        "motorway": 0, "trunk": 1, "primary": 2, "secondary": 3,
        "tertiary": 4, "residential": 5, "unclassified": 6, "service": 7,
    }
    candidates.sort(key=lambda road: (priority.get(road[0], 8), -road[2]))
    selected = []
    midpoints = []
    selected_samples = []
    for highway, points, length in candidates:
        x, y, _ = point_on_polyline(points, 0.5)
        if not (0 <= x <= WIDTH and 0 <= y <= HEIGHT):
            continue
        if any(math.dist((x, y), midpoint) < 72 for midpoint in midpoints):
            continue
        samples = [point_on_polyline(points, index / 24)[:2] for index in range(25)]
        overlaps_existing_road = any(
            sum(
                1 for sample in samples
                if min(math.dist(sample, other) for other in existing_samples) < 52
            ) >= 3
            for existing_samples in selected_samples
        )
        if overlaps_existing_road:
            continue
        selected.append((highway, points, length))
        midpoints.append((x, y))
        selected_samples.append(samples)
        if len(selected) == 21:
            break

    durations = (14, 18, 21, 16, 24, 19, 27)
    defs = []
    cars = []
    for index, (_, points, _) in enumerate(selected, 1):
        route_points = list(reversed(points)) if index % 2 == 0 else points
        path_data = "M " + " L ".join(f"{x},{y}" for x, y in route_points)
        defs.append(f'<path id="car-route-{index}" d="{path_data}"/>')
    for route_index, _ in enumerate(selected, 1):
        rank = route_index
        base_duration = durations[(route_index - 1) % len(durations)]
        phase = (route_index * 0.173) % 1
        cars.append(f'''\
  <g class="map-car map-car-{rank}" data-traffic-rank="{rank}" data-route="{route_index}" data-phase="{phase:.4f}" data-base-duration="{base_duration}" filter="url(#car-shadow-blue)">
    <g transform="translate(-18 -8)">
      <path d="M 7,1 H 29 C 33,1 35,4 35,8 C 35,12 33,15 29,15 H 7 C 3,15 1,12 1,8 C 1,4 3,1 7,1 Z" fill="#0A84FF"/>
      <rect x="5" y="0" width="7" height="2" rx="1" fill="#0A84FF"/>
      <rect x="24" y="0" width="7" height="2" rx="1" fill="#0A84FF"/>
      <rect x="5" y="14" width="7" height="2" rx="1" fill="#0A84FF"/>
      <rect x="24" y="14" width="7" height="2" rx="1" fill="#0A84FF"/>
    </g>
  </g>''')

    center_x, center_y = project(CENTER_LAT, CENTER_LON)
    home_marker = f'''\
  <g class="map-home-marker" transform="translate({center_x} {center_y})" filter="url(#home-shadow)">
    <circle r="30" fill="#0A84FF" stroke="#ffffff" stroke-width="5"/>
    <path d="M -16,1 L 0,-14 L 16,1 V 18 H 5 V 7 H -5 V 18 H -16 Z" fill="#ffffff" stroke="#031528" stroke-width="2" stroke-linejoin="round"/>
  </g>'''

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <filter id="car-shadow-blue" x="-50%" y="-100%" width="200%" height="300%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0A84FF" flood-opacity="0.72"/>
    </filter>
    <filter id="car-shadow-red" x="-50%" y="-100%" width="200%" height="300%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#FF2D2D" flood-opacity="0.78"/>
    </filter>
    <filter id="car-shadow-yellow" x="-50%" y="-100%" width="200%" height="300%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#FFD60A" flood-opacity="0.78"/>
    </filter>
    <filter id="home-shadow" x="-80%" y="-80%" width="260%" height="260%">
      <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#001b36" flood-opacity="0.55"/>
    </filter>
    {''.join(defs)}
  </defs>
{''.join(cars)}
{home_marker}
</svg>
'''
    (ROOT / "map-cars.svg").write_text(svg, encoding="utf-8")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    data = fetch_osm()
    files = [render_map(data, style, index) for index, style in enumerate(STYLES, 1)]
    make_contact_sheets(files)
    make_car_overlay(data)
    render_map(
        data,
        STYLES[1],
        2,
        show_option_label=False,
        show_address_marker=False,
        show_attribution=False,
        output_path=ROOT / "map-fallback.png",
    )
    print(f"Rendered {len(files)} non-AI map options to {OUTPUT_DIR}")


if __name__ == "__main__":
    random.seed(923)
    main()
