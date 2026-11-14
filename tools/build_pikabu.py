# Сборка «Лесной почты» для Пикабу Игр (как у «Мутации» и «Ночного тарифа»): pikabu/index.html на нашем сайте —
# https://forestpost.games/pikabu/ (графика, звук и шрифты берутся из pochta/ через <base href="/pochta/">, поисковикам — noindex).
# Берёт pochta/index.html и: ставит window.LP_PLATFORM='pikabu' (SDK Пикабу, без ссылок наружу, без строки документов с данными владельца,
# открытки — картинкой); убирает манифест, иконки для «Добавить на экран», canonical и метки соцсетей.
# Запуск: python3 tools/build_pikabu.py (его же вызывает tools/site.py). После любой правки pochta/index.html — пересобрать.
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
d = (ROOT / 'pochta' / 'index.html').read_text(encoding='utf-8')
for pat in [r'<link rel="manifest"[^>]*>\n?', r'<link rel="canonical"[^>]*>\n?', r'<meta property="og:[^>]*>\n?',
            r'<link rel="apple-touch-icon"[^>]*>\n?', r'<meta name="apple-mobile-web-app[^>]*>\n?', r'<meta name="mobile-web-app-capable"[^>]*>\n?']:
    d = re.sub(pat, '', d)
k = d.index('<meta charset="utf-8">') + len('<meta charset="utf-8">\n')
d = d[:k] + '<base href="/pochta/">\n<meta name="robots" content="noindex">\n<script>window.LP_PLATFORM="pikabu";</script>\n' + d[k:]
assert 'rel="manifest"' not in d and 'LP_PLATFORM="pikabu"' in d
(ROOT / 'pikabu').mkdir(exist_ok=True)
(ROOT / 'pikabu' / 'index.html').write_text(d, encoding='utf-8')
print('pikabu: pikabu/index.html', len(d), 'байт (https://forestpost.games/pikabu/)')
