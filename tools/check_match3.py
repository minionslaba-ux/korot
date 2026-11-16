#!/usr/bin/env python3
"""Проверка каталога писем по правилам docs/missii-pravila-match3.md.
Запуск: python3 tools/check_match3.py docs/missii-katalog.md [--only 3,10,11]"""
import sys, collections
path = sys.argv[1]; only = None
if '--only' in sys.argv: only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
rows = []
for l in open(path, encoding='utf-8'):
    c = [x.strip() for x in l.strip().strip('|').split('|')]
    if l.startswith('|') and c and c[0].isdigit(): rows.append(c)
ch = collections.OrderedDict()
for r in rows: ch.setdefault(r[0], []).append(r)
err = 0
for k, ms in ch.items():
    if only and k not in only: continue
    if k == '1': print('гл.1: обучающая глава — исключение (см. правила)'); continue
    v = [m[3] for m in ms]; cnt = collections.Counter(v); prob = []
    if len(cnt) < 5: prob.append(f'целей {len(cnt)} (<5)')
    for g, n in cnt.items():
        if n > 4: prob.append(f'«{g}» ×{n} (>4)')
    for i in range(1, len(v)):
        if v[i] == v[i - 1]: prob.append(f'подряд «{v[i]}» в №{ms[i-1][1]}–{ms[i][1]}')
    print(f'гл.{k}: ' + ('ок' if not prob else '; '.join(prob))); err += bool(prob)
print('Итог:', 'ок' if not err else f'глав с нарушениями: {err}'); sys.exit(1 if err else 0)
