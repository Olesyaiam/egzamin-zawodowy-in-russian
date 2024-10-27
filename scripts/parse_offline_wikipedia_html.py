import os
from pathlib import Path
from urllib.parse import quote

from bs4 import BeautifulSoup


def sanitize_filename(filename):
    """
    Кодирует символы в имени файла и заменяет опасные символы вроде '/'.

    :param filename: Исходное имя файла
    :return: Безопасное имя файла
    """
    return quote(filename).replace('/', '_')


def process_html(html_content):
    if '<table class="infobox takson-rosliny">' in html_content:
        soup = BeautifulSoup(html_content, 'lxml')
        tag1 = soup.select_one('a[title="Rośliny"]')
        tag2 = soup.select_one('a[href="/wiki/Plantae"]')

        if tag1 or tag2:
            print(tag1)
            print(tag2)
            title_tag = soup.find('div', class_='iboxt-1')
            title = title_tag.text.strip()
            filename = sanitize_filename(title)
            filepath = os.path.join('data', 'pl', f'{filename}.html')
            print()
            print("title:", title)
            print("safe_title:", filename)
            print("filepath:", filepath)

            # Записываем контент в файл
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(html_content)


def process_file(file_path: Path):
    if file_path.is_file():
        file_path_str = str(file_path)

        # Проверка расширения и размера файла
        if not file_path_str.endswith('.svg') and not file_path_str.endswith('.pdf'):
            if file_path.stat().st_size <= 10 * 1024 * 1024:  # Проверяем, что размер файла <= 10 МБ
                print()
                print(file_path)
                # Читаем и обрабатываем файл
                with open(file_path, 'r', encoding='utf-8') as f:
                    try:
                        process_html(f.read())
                    except UnicodeDecodeError:
                        print('binary')


def process_all_files(directory):
    """
    Рекурсивно обходит директорию и выводит пути всех файлов.

    :param directory: Путь к начальной директории.
    """
    p = Path(directory)
    if not p.is_dir():
        print(f"Директория '{directory}' не существует.")
        return

    i = 0

    for file_path in p.rglob('*'):
        i += 1
        print(i, round(i / 2182458 * 100))
        process_file(file_path)


def main():
    # Замените этот путь на путь к вашей директории
    start_directory = '/media/pavel/Backup/wiki/docker_test/extracted_html_pl'
    process_all_files(start_directory)


if __name__ == '__main__':
    main()
