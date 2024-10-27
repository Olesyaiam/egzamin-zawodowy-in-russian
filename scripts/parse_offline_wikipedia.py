import os

import mwxml


def create_safe_filename(title, max_length=50):
    if not title or len(title) == 0:
        raise Exception("Название файла пустое или содержит недопустимые символы для создания файла.")

    # Преобразуем заголовок в безопасное имя файла
    safe_title = "".join([c if c.isalnum() or c in (' ', '-', '_') else "_" for c in title])

    # Проверяем, если длина превышает max_length
    if len(safe_title) > max_length:
        original_length = len(safe_title)
        # Обрезаем имя до max_length минус длина суффикса, чтобы хватило места для " _XX"
        safe_title = safe_title[:max_length - len(str(original_length)) - 1] + f"_{original_length}"

    return safe_title


# Функция для обработки статей
def process_article(title, text, output_dir):
    safe_title = create_safe_filename(title)

    if len(safe_title) >= 2:
        first_char = safe_title[0]
        second_char = safe_title[1]

        if not first_char.isdigit() and not second_char.isdigit():
            nested_dir = os.path.join(output_dir, first_char, second_char)
            os.makedirs(nested_dir, exist_ok=True)
            file_path = os.path.join(nested_dir, f"{safe_title}.txt")

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(text)

            print(f"Статья '{title}' сохранена в {file_path}")


# Основная функция для парсинга дампа Википедии с использованием mwxml
def parse_wikipedia_dump(dump_file, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    file_size = os.path.getsize(dump_file)

    # Открываем дамп Википедии
    with open(dump_file, 'rb') as f:
        dump = mwxml.Dump.from_file(f)

        # Итерируем по страницам
        for page in dump:
            if not page.title:
                continue  # Пропускаем страницы без заголовка
            else:
                current_pos = f.tell()

                # Вычисляем прогресс
                progress = (current_pos / file_size) * 100
                print(f"Progress: {progress:.2f}%")

                # Выведем доступные атрибуты объекта page для отладки
                print(f"Page title: {page.title}")

                # Итерируем по ревизиям внутри страницы
                latest_revision = None

                for revision in page:
                    if not latest_revision or revision.id > latest_revision.id:
                        latest_revision = revision  # сохраняем ревизию как последнюю

                # Если есть ревизия, то обрабатываем текст
                if latest_revision and latest_revision.text:
                    # print(f"Latest revision ID: {latest_revision.id}")
                    # print(f"Latest revision text: {latest_revision.text[:100]}...")  # Выводим первые 100 символов текста
                    process_article(page.title, latest_revision.text, output_dir)


# Пример использования:
dump_file = "/media/pavel/Backup/wiki/ruwiki-20241020-pages-articles-multistream.xml"
# output_dir = "data/ru"
output_dir = "/media/pavel/Backup/wiki/wiki_ru"

# Запускаем парсинг
parse_wikipedia_dump(dump_file, output_dir)
