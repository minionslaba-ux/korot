# Лесная почта — заметки для Claude

- Миссии, уровни, задания, доставки, боссы — только по скиллу .claude/skills/raznoobraznye-missii (каталог docs/missii-katalog.md, таблица новых миссий владельцу до кода, проверка check_missions.py).
- Пропорция типов миссий для этой игры: все письма — «головоломка» (боссы — «босс»); типов «вождение/бой/спокойная» в «три в ряд» нет, поэтому проверка скилла запускается с `--types none`.
- Для «три в ряд» действуют уточнённые правила из docs/missii-pravila-match3.md (проверка: python3 tools/check_match3.py docs/missii-katalog.md).
- Отвечать владельцу по-русски. Версия для Пикабу собирается из pochta/index.html: python3 tools/site.py (вызывает tools/build_pikabu.py).
