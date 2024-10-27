import json
import os

from bs4 import BeautifulSoup

# Путь к папке с HTML-файлами
input_dir = 'data/pl'
# Путь к папке для JSON-файлов
output_dir = 'data/pl_parsed'


def clean_plant_name(name):
    # Ищем первую заглавную букву в строке
    for idx, char in enumerate(name):
        if char.isupper():
            # Возвращаем подстроку, начиная с первой заглавной буквы
            return name[idx:].strip()

    # Если заглавная буква не найдена, возвращаем исходную строку
    return name.strip()


def get_latin_name_from_html(soup):
    # Находим все элементы по селектору table > tbody > tr > td
    elements = soup.select('table > tbody > tr > td')

    # Проходим по каждому элементу
    for idx, element in enumerate(elements):
        # Очищаем текст элемента от HTML-тегов и проверяем, содержит ли он текст "Nazwa systematyczna"
        if element.get_text(strip=True) == "Nazwa systematyczna":
            # Проверяем, что следующий элемент существует
            if idx + 1 < len(elements):
                # Берем следующий элемент и возвращаем его содержимое
                next_element = elements[idx + 1]
                italic_span = next_element.find('span', style='font-style:italic;')

                if not italic_span:
                    raise Exception(str(next_element))

                return italic_span.get_text(strip=True)
            else:
                print("Следующий элемент не найден")
                return None

    print("Элемент с текстом 'Nazwa systematyczna' не найден")
    return None


# Функция для обработки одного файла
def process_file(file_path, output_dir):
    with open(file_path, 'r', encoding='utf-8') as file:
        # Загружаем содержимое HTML-файла
        soup = BeautifulSoup(file, 'html.parser')

        latin_name = clean_plant_name(get_latin_name_from_html(soup))
        pl_name = soup.select_one('div.iboxt-1').get_text(strip=True)

        if not pl_name:
            raise Exception(file_path)

        pl_name = clean_plant_name(pl_name)

        print()
        print('====>>>')
        print(latin_name)
        print(pl_name)
        print('<<<====')

        # Создаем JSON-данные
        json_data = {
            "latin": latin_name,
            "pl": pl_name,
            "ru": None
        }

        # Формируем путь для сохранения JSON-файла
        json_file_path = os.path.join(output_dir, f"{latin_name}.json")

        # Записываем JSON в файл
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(json_data, json_file, ensure_ascii=False, indent=4)

        print(f"Processed {latin_name}.json")


# Проход по всем HTML-файлам в директории
for file_name in os.listdir(input_dir):
    file_path = os.path.join(input_dir, file_name)
    process_file(file_path, output_dir)
