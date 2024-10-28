import json
import os
import re

import requests

# Ваш ключ API OpenAI
API_KEY = ''
API_URL = "https://api.openai.com/v1/chat/completions"


def clean_and_parse_json(response_text):
    # Используем регулярное выражение для удаления обертки "json..." в начале строки
    cleaned_text = re.sub(
        r'^\s*json\s*',
        '',
        response_text.strip('`').strip().strip('`'), flags=re.IGNORECASE
    ).strip('`').strip()
    print('>>>')
    print(cleaned_text)
    print('<<<')

    try:
        # Попробуем распарсить JSON
        parsed_data = json.loads(cleaned_text)
        return parsed_data
    except json.JSONDecodeError as e:
        # Если возникает ошибка, выводим сообщение об ошибке и возвращаем None
        print(f"Ошибка при парсинге JSON: {e}")
        return None


# Функция для генерации промпта
def generate_prompt(polish_names):
    return """Proszę o odmianę przez przypadki (Dopełniacz, Celownik, Biernik, Narzędnik, Miejscownik) dla następujących nazw roślin:
===
{words}
===
Odpowiedź wyłącznie w formacie valid JSON o następującej strukturze:
{
"nazwa rośliny 1": ["nazwa rośliny 1 w dopełniaczu", "nazwa rośliny 1 w celowniku", "nazwa rośliny 1 w bierniku", "nazwa rośliny 1 w narzędniku", "nazwa rośliny 1 w miejscowniku"],"nazwa rośliny 2": ["nazwa rośliny 2 w dopełniaczu", "nazwa rośliny 2 w celowniku", "nazwa rośliny 2 w bierniku", "nazwa rośliny 2 w narzędniku", "nazwa rośliny 2 w miejscowniku"],
...,
"nazwa rośliny {len}": ["nazwa rośliny {len} w dopełniaczu", "nazwa rośliny {len} w celowniku", "nazwa rośliny {len} w bierniku", "nazwa rośliny {len} w narzędniku", "nazwa rośliny {len} w miejscowniku"]
}""".replace('{words}', "\n".join(polish_names)).replace('{len}', str(len(polish_names)))


def generate_prompt_mnoga(polish_names):
    return """Proszę o odmianę przez przypadki w liczbie mnogiej (Mianownik, Dopełniacz, Celownik, Biernik, Narzędnik, Miejscownik) dla następujących nazw roślin:
===
{words}
===
Odpowiedź wyłącznie w formacie valid JSON o następującej strukturze:
{
    "nazwa rośliny 1": ["nazwa rośliny 1 w mianowniku (liczba mnoga)", "nazwa rośliny 1 w dopełniaczu (liczba mnoga)", "nazwa rośliny 1 w celowniku (liczba mnoga)", "nazwa rośliny 1 w bierniku (liczba mnoga)", "nazwa rośliny 1 w narzędniku (liczba mnoga)", "nazwa rośliny 1 w miejscowniku (liczba mnoga)"],
...
"nazwa rośliny {len}": ["nazwa rośliny {len} w mianowniku (liczba mnoga)", "nazwa rośliny {len} w dopełniaczu (liczba mnoga)", "nazwa rośliny {len} w celowniku (liczba mnoga)", "nazwa rośliny {len} w bierniku (liczba mnoga)", "nazwa rośliny {len} w narzędniku (liczba mnoga)", "nazwa rośliny {len} w miejscowniku (liczba mnoga)"]
}""".replace('{words}', "\n".join(polish_names)).replace('{len}', str(len(polish_names)))


# Функция для отправки запроса к OpenAI API через requests
def request_openai(prompt):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    data = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": "Jesteś polskim lingwistą."},
            {"role": "user", "content": prompt}
        ],
        "n": 1,
        "stop": None,
        "temperature": 0.2
    }

    response = requests.post(API_URL, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Ошибка запроса к OpenAI API: {response.status_code} - {response.text}")


def show_statistics(directory: str):
    exists = 0
    not_exists = 0

    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)

            # Чтение содержимого JSON-файла
            with open(file_path, 'r', encoding='utf-8') as f:
                # Проверяем наличие ключа 'pl_variations2'
                data = json.load(f)

                if 'pl_variations2' in data or data['pl'] == data['latin']:
                    exists += 1
                else:
                    not_exists += 1

    print()
    print()
    print('Exists:', exists)
    print('Not exists:', not_exists)
    print()


def find_and_update_json(directory: str, mianownik: str, pl_variations2: []):
    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)

            # Чтение содержимого JSON-файла
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

                if data['pl'] == mianownik:
                    # Проверяем наличие ключа 'pl_variations2'
                    if 'pl_variations2' in data:
                        raise Exception('Already exists: ' + file_path)
                    # Добавляем новый ключ и значение
                    data['pl_variations2'] = pl_variations2

                    # Перезаписываем файл с обновленными данными
                    with open(file_path, 'w', encoding='utf-8') as f_write:
                        json.dump(data, f_write, ensure_ascii=False, indent=4)

                    # Выводим сообщение о перезаписанном файле
                    print(f"Файл перезаписан: {file_path}")

                    return

    raise Exception(mianownik + ' not found')


# Функция для сбора польских названий и отправки запросов
def collect_polish_names(directory, group_size=13):
    polish_names = []

    # Обход всех файлов в директории
    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

                # Если ключа pl_variations2 нет, добавляем в список
                if 'pl_variations2' not in data and data['pl'] != data['latin']:
                    polish_names.append(data['pl'])

                    # Когда собрана группа из 50 слов, делаем запрос
                    if len(polish_names) >= group_size:
                        prompt = generate_prompt_mnoga(polish_names)
                        print(f"Сгенерированный промпт:\n{prompt}\n")

                        # Отправляем запрос к OpenAI
                        response = request_openai(prompt)
                        # Выводим результат
                        reply = response['choices'][0]['message']['content']
                        # print(f"Результат спряжения для группы слов:\n{reply}\n")
                        parsed_data = clean_and_parse_json(reply)

                        if parsed_data is None:
                            raise Exception('not valid JSON')

                        for mianownik, others in parsed_data.items():
                            find_and_update_json(directory, mianownik, others)

                        show_statistics(directory)
                        polish_names = []  # Очищаем список для следующей группы

if __name__ == "__main__":
    directory = "data/pl_parsed"  # Укажите путь к вашей папке
    collect_polish_names(directory)
