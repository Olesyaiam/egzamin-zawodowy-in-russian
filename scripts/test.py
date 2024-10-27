import json
import os
import re

output_dir = 'data/ru_parsed'
root_dir = '/media/pavel/Backup/wiki/wiki_ru/'
current_pos = 0


def replace_template(text):
    # Шаблон для поиска {{любая строка|'''ТЕКСТ'''|любые данные}} и Замена на '''ТЕКСТ'''
    return re.sub(r"\{\{.*?\|\s*'''([^']*?)'''\s*\|.*?\}\}", r"'''\1'''", text)


def extract_latin_name(text):
    match = re.search(r'\{\{lang-la\|([^\}]+)\}\}', text, re.IGNORECASE)

    if match:
        return match.group(1).strip()

    return None


for first_char in os.listdir(root_dir):
    first_char_path = os.path.join(root_dir, first_char)

    for second_char in os.listdir(first_char_path):
        second_char_path = os.path.join(first_char_path, second_char)

        for filename in os.listdir(second_char_path):
            current_pos += 1
            progress = (current_pos / 5724854) * 100

            if progress < 7.353:
                continue

            print(f"Progress: {progress:.3f}%")

            file_path = os.path.join(second_char_path, filename)
            lines = []

            try:
                # Открываем файл в режиме чтения
                with open(file_path, 'r', encoding='utf-8') as file:
                    for line in file:
                        lines.append(line.strip())
            except Exception as e:
                print(f"Ошибка при чтении файла {file_path}: {e}")

            if lines[0].startswith("#REDIRECT") or lines[0].startswith("#перенаправление"):
                continue

            new_lines = []

            for line in lines:
                if line.startswith("}}"):
                    new_lines.append("}}")
                    new_lines.append(replace_template(line[2:]))
                else:
                    new_lines.append(replace_template(line))

            taxon_lines = {}
            taxon_lines_started = False

            for line in new_lines:
                if not taxon_lines_started and line == '{{Таксон':
                    taxon_lines_started = True
                elif taxon_lines_started and line == '}}':
                    break
                else:
                    if ' = ' in line:
                        key_value = line.split(' = ')
                        taxon_lines[key_value[0].strip()[1:].strip()] = key_value[1].strip()

            if 'regnum' in taxon_lines and taxon_lines['regnum'] == 'Растения':
                print()
                print()
                print(file_path)

                latin_name = ''
                ru_name = ''

                if 'latin' in taxon_lines and isinstance(taxon_lines['latin'], str):
                    latin_name = taxon_lines['latin'].strip()

                for line in new_lines:
                    if line.startswith("'''"):
                        ru_name = line.split("'''")[1].strip()
                        print(ru_name)
                        print('===')

                        if len(latin_name) == 0:
                            latin_name = extract_latin_name(line)

                if len(ru_name) == 0:
                    raise Exception('No RU')
                elif not latin_name or len(latin_name) == 0:
                    print('No LATIN')
                    continue

                print(ru_name)
                print(latin_name)

                json_data = {
                    'latin': latin_name,
                    'pl': None,
                    'ru': ru_name,
                }

                # Формируем путь для сохранения JSON-файла
                json_file_path = os.path.join(output_dir, f"{latin_name}.json")

                # Записываем JSON в файл
                with open(json_file_path, 'w', encoding='utf-8') as json_file:
                    json.dump(json_data, json_file, ensure_ascii=False, indent=4)
