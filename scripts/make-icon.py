"""Иконка приложения из палитры макета.

Запускается вручную и очень редко:

    python3 scripts/make-icon.py

Рисует то же, что и шапка на главном экране: полосы заката, солнце,
уходящее за холм, и тропу. Отдельным файлом, а не в коде, потому что
иконку системе нужно отдать картинкой — ни Skia, ни стили тут не помогут.

Три размера под три нужды:
  icon.png          — обычная иконка (iOS и запасная для Android);
  adaptive-icon.png — передний план для Android: система сама обрежет его
                      кругом или квадратом, поэтому рисунок ужат к центру;
  splash-icon.png   — заставка при запуске, на прозрачном фоне.
"""

from PIL import Image, ImageDraw

SUNSET = ['#4A2A46', '#6B3A5B', '#8E4A5A', '#C8483F', '#E4713F', '#E9A83C', '#F2C94C']
INK = '#241812'
SUN = '#F7E27E'
EMBER = '#E4713F'
FOG = '#2E1F17'

SIZE = 1024


def draw_scene(image: Image.Image) -> None:
    """Закат, холм и тропа во весь холст."""
    draw = ImageDraw.Draw(image)
    side = image.size[0]

    box = (0.0, 0.0, float(side), float(side))
    width = box[2] - box[0]
    height = box[3] - box[1]

    # Полосы заката: ровно те же семь цветов, что и в шапке приложения.
    band = height / len(SUNSET)
    for index, color in enumerate(SUNSET):
        top = box[1] + index * band
        draw.rectangle([box[0], top, box[2], top + band + 1], fill=color)

    # Солнце наполовину за горизонтом.
    sun_r = width * 0.16
    sun_cx = box[0] + width * 0.52
    sun_cy = box[1] + height * 0.72
    draw.ellipse([sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r], fill=SUN)

    # Холм с лёгким наклоном — как в шапке приложения, где горизонт не ровный.
    hill_left = box[1] + height * 0.75
    hill_right = box[1] + height * 0.71
    draw.polygon(
        [(box[0], hill_left), (box[2], hill_right), (box[2], box[3]), (box[0], box[3])],
        fill=INK,
    )

    # Тропа: то, ради чего всё приложение. Идёт снизу вверх, к солнцу.
    # Плавная тропа, а не зигзаг: ломаная из трёх колен читается молнией.
    path = [
        (box[0] + width * 0.22, box[3] - height * 0.03),
        (box[0] + width * 0.33, box[3] - height * 0.07),
        (box[0] + width * 0.40, box[3] - height * 0.12),
        (box[0] + width * 0.46, box[3] - height * 0.17),
        (box[0] + width * 0.56, box[3] - height * 0.21),
    ]
    draw.line(path, fill=EMBER, width=int(width * 0.032), joint='curve')

    # Точка на конце тропы — «ты здесь».
    dot_r = width * 0.032
    end = path[-1]
    draw.ellipse([end[0] - dot_r, end[1] - dot_r, end[0] + dot_r, end[1] + dot_r], fill=EMBER)


def rounded(image: Image.Image, radius_ratio: float) -> Image.Image:
    """Скругление углов: iOS обрежет иконку сам, но своя маска даёт
    одинаковый вид и там, где системной обрезки нет."""
    mask = Image.new('L', image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, image.size[0], image.size[1]],
        radius=int(image.size[0] * radius_ratio),
        fill=255,
    )
    out = Image.new('RGBA', image.size, (0, 0, 0, 0))
    out.paste(image, mask=mask)
    return out


def centered(scale: float, radius_ratio: float) -> Image.Image:
    """Рисунок в скруглённом квадрате по центру прозрачного холста.

    Маска скругления кладётся на сам рисунок, а не на весь холст: иначе
    получается большой скруглённый прямоугольник фона с маленькой картинкой
    внутри — ровно то, что и вышло с первого раза.
    """
    inner = int(SIZE * scale)
    scene = Image.new('RGBA', (inner, inner), FOG)
    draw_scene(scene)
    scene = rounded(scene, radius_ratio)

    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    offset = (SIZE - inner) // 2
    canvas.paste(scene, (offset, offset), scene)
    return canvas


def main() -> None:
    icon = Image.new('RGBA', (SIZE, SIZE), FOG)
    draw_scene(icon)
    icon.save('assets/icon.png')

    # Android обрезает передний план кругом или скруглённым квадратом
    # и оставляет видимой только середину — поэтому рисунок ужат.
    centered(0.66, 0.22).save('assets/adaptive-icon.png')
    centered(0.58, 0.2).save('assets/splash-icon.png')

    print('иконки готовы: assets/icon.png, adaptive-icon.png, splash-icon.png')


if __name__ == '__main__':
    main()
