(function () {
    'use strict';

    const baseUrl = 'https://egzamin.dobroedelo39.ru/'
    const selectors = {
        'question': '#question_text',
        'comment': '#question_comment',
        'answer': 'td > label',
        'answer_block': 'div.answer_block',
        'switch': [
            '#question_text',
            'div.answer_block'
        ],
        'others': [
            'div.friends_area > label > span:first-of-type'
        ]
    };

    let selectorsToRemove = [
        {
            selector: 'a.facebook_share',
            deleteLevel: 0
        },
        {
            selector: '//table[@width="100%" and count(@*) = 1]',
            deleteLevel: 0
        },
        {
            selector: '#question_form > fieldset > div.alert.alert-error.visible-desktop',
            deleteLevel: 0
        },
        {
            selector: 'iframe',
            deleteLevel: 0
        },
        {
            selector: 'ins',
            deleteLevel: 0
        }
    ];

    let contentCache = {};
    let switchIds = new Set();

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }

        return Math.abs(hash).toString();
    }

    function makeHttpRequest(endpoint, data, callback) {
        const url = baseUrl + endpoint;
        const requestData = {
            action: 'makeHttpRequest',
            url: url,
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            data: JSON.stringify(data)
        };

        chrome.runtime.sendMessage(requestData, response => {
            if (response.success) {
                callback(response.data);
            } else {
                console.error('Error:', response.error);
            }
        });
    }

    function sendTranslationFeedback(translation, endpoint) {
        let switchState = loadFromCacheSwitchState()
        localStorage.clear();
        saveToCacheSwitchState(switchState)

        makeHttpRequest(endpoint, {text: translation}, function (result) {
            console.log(endpoint + " " + translation);
        });
    }

    function markTranslationAsIncorrect(translation) {
        sendTranslationFeedback(translation, 'translations/markIncorrect');
    }

    function markTranslationAsCorrect(translation) {
        sendTranslationFeedback(translation, 'translations/markCorrect');
    }

    function createLikeOrDislikeEmojiLink(span, onClickHandler, itIsLike = true) {
        const link = document.createElement('a');
        link.href = '#';
        link.innerHTML = itIsLike ? ' 👍' : ' 👎';
        link.onclick = (e) => {
            e.preventDefault();
            span.innerHTML = ' ✅';
            onClickHandler();
        };

        span.appendChild(link);
    }

    function setSwitchState(event = null) {
        let switchIsOn = event ? event.target.checked : loadFromCacheSwitchState();

        switchIds.forEach(id => {
            let switchElement = document.getElementById(id);

            if (switchElement) {
                switchElement.checked = switchIsOn
            }
        });

        document.querySelectorAll('.translation').forEach(element => {
            element.style.display = switchIsOn ? 'block' : 'none';
        });

        saveToCacheSwitchState(switchIsOn)
    }

    function prepareTranslationElementAndAddToDom(original_element, translation_element, translation, flowers) {
        let lastIndex = 0;
        let originalText = original_element.innerHTML;

        Object.keys(flowers).forEach((key) => {
            const keyRegex = new RegExp(`(?<![\\p{L}\\d])${key}(?![\\p{L}\\d])`, 'giu');
            const flowerData = flowers[key]; // Получаем объект с 'wiki_pl' и 'img'

            // Разбиваем текст на сегменты, используя HTML-теги как разделители
            originalText = originalText.replace(/(<[^>]+>|[^<]+)/g, (segment) => {
                // Если сегмент является HTML-тегом, возвращаем его без изменений
                if (segment.startsWith('<') && segment.endsWith('>')) {
                    return segment;
                }

                // В противном случае выполняем замену по ключевому слову
                return segment.replace(keyRegex, (match) => {
                    return `<a href="${flowerData.wiki_pl}" class="image-link" data-image="${flowerData.img}" target="_blank">${match}</a>`;
                });
            });
        });

        original_element.innerHTML = originalText;

        // Добавление подсказок с изображениями при наведении на ссылки
        const links = original_element.querySelectorAll('.image-link');
        links.forEach((link) => {
            let hintElement;

            link.onmouseover = (e) => {
                const mouseX = e.clientX + 10;
                const mouseY = e.clientY + 10;
                const imageUrl = link.getAttribute('data-image');
                hintElement = createImgHint(imageUrl, mouseX, mouseY);
            };

            link.onmouseout = () => {
                if (hintElement) {
                    document.body.removeChild(hintElement);
                    hintElement = null;
                }
            };

            // Добавляем обработчик клика, чтобы открыть изображение в новой вкладке
            link.onclick = (e) => {
                e.preventDefault();
                window.open(link.getAttribute('href'), '_blank');
            };
        });

        // Остальная часть функции
        if (lastIndex < translation.length) {
            translation_element.appendChild(document.createElement('br'));
            const remainingText = document.createElement('b');
            remainingText.textContent = translation.substring(lastIndex);
            translation_element.appendChild(remainingText);
        }

        const span = document.createElement('span');

        if (loadFromCacheEmojiFlag(translation)) {
            createLikeOrDislikeEmojiLink(span, () => markTranslationAsCorrect(translation), true);
            span.appendChild(document.createTextNode(' '));
            createLikeOrDislikeEmojiLink(span, () => markTranslationAsIncorrect(translation), false);
        } else {
            span.innerHTML = ' ✅';
        }

        translation_element.classList.add('translation');
        translation_element.appendChild(span);

        setSwitchState();
    }

    function getCacheKey(originalText) {
        return 'translationCache_' + simpleHash(originalText);
    }

    function getCacheKeyForEmojiFlags(translation) {
        return 'emojiFlagsCache_' + simpleHash(translation);
    }

    function saveToCacheEmojiFlag(translate, flag) {
        localStorage.setItem(getCacheKeyForEmojiFlags(translate), flag ? '1' : '0');
    }

    function loadFromCacheEmojiFlag(translate) {
        return localStorage.getItem(getCacheKeyForEmojiFlags(translate)) === '1';
    }

    function saveToCacheSwitchState(isItEnabled) {
        localStorage.setItem('translation_switch_state', isItEnabled ? '1' : '0');
    }

    function loadFromCacheSwitchState() {
        return localStorage.getItem('translation_switch_state') === '1';
    }

    function saveTranslateToCache(original, translate) {
        localStorage.setItem(getCacheKey(original), translate);
    }

    function loadTranslateFromCache(original) {
        let cachedTranslation = localStorage.getItem(getCacheKey(original));

        if (cachedTranslation !== null) {
            return cachedTranslation;
        }

        return null;
    }

    function translateText(text, questionContext, callback) {
        if (text.length > 3000) {
            console.log('Text too long to translate, length:', text.length);
            callback('Ошибка: текст слишком длинный для перевода.', []);
            return;
        } else if (text.includes('githubusercontent')) {
            console.log('Text contains "githubusercontent", length:', text.length);
            callback('Text contains "githubusercontent', []);
            return;
        }

        makeHttpRequest('translations/get', {text: text, question_context: questionContext}, function (result) {
            if (result.translation && result.translation.trim() !== '') {
                saveToCacheEmojiFlag(result.translation, !result.approved);
                callback(result.translation, result.flowers);
            } else {
                console.log('Invalid translation received for: ' + text);
                callback('Ошибка: не получилось перевести.', []);
            }
        });
    }

    function getElementWithTranslation(originalElement) {
        let originalId = originalElement.id;
        let clonedId = originalId + '-cloned';
        let clonedContent = document.getElementById(clonedId);

        if (!clonedContent) {
            clonedContent = document.createElement(originalElement.tagName);
            clonedContent.id = clonedId;
            originalElement.parentNode.insertBefore(clonedContent, originalElement.nextSibling);

            if (originalId.endsWith('-content') || originalId.endsWith('q-result-explanation') || originalId.endsWith('q-result-question')) {
                originalElement.parentNode.insertBefore(document.createElement('br'), clonedContent);
            }

            originalElement.parentNode.insertBefore(document.createElement('br'), clonedContent.nextSibling);
        }

        return clonedContent
    }

    function createSwitchesIfNotExist() {
        selectors['switch'].forEach(selector => {
            let elementBaseId = `switch_${selector.length}_`
            let elements = [];

            // Если селектор начинается с '/', считаем его XPath
            if (selector.startsWith('/')) {
                const xpathResult = document.evaluate(
                    selector,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );

                for (let i = 0; i < xpathResult.snapshotLength; i++) {
                    elements.push(xpathResult.snapshotItem(i));
                }
            } else {
                // Иначе считаем его обычным CSS-селектором
                elements = document.querySelectorAll(selector);
            }

            elements.forEach((element, selectorElementIndex) => {
                // Генерация ID для каждого элемента, чтобы у каждого был уникальный ID
                let elementSpecificId = `${elementBaseId}_${selectorElementIndex}`;

                // Проверяем, существует ли переключатель с таким уникальным ID
                if (!document.getElementById(elementSpecificId)) {
                    // Создаем переключатель
                    const div = document.createElement('div');
                    div.className = 'toggle-switch';
                    div.style.display = 'block';
                    div.style.marginLeft = '0px';
                    div.style.marginRight = '5px';
                    div.style.marginTop = '5px';
                    div.style.marginBottom = '0px';

                    const input = document.createElement('input');
                    input.style.opacity = '0'; // Делаем чекбокс невидимым
                    input.type = 'checkbox';
                    input.id = elementSpecificId;
                    input.checked = loadFromCacheSwitchState();
                    input.addEventListener('change', setSwitchState);

                    const label = document.createElement('label');
                    label.setAttribute('for', elementSpecificId);
                    label.className = 'switch';

                    div.appendChild(input);
                    div.appendChild(label);

                    // Добавляем переключатель перед найденным элементом
                    element.insertAdjacentElement('beforebegin', div);
                    switchIds.add(elementSpecificId);
                }
            });
        });
    }

    function processSelector(selector, category) {
        try {
            if (selector.startsWith('/')) {
                const result = document.evaluate(
                    selector,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );

                for (let i = 0; i < result.snapshotLength; i++) {
                    const element = result.snapshotItem(i);

                    if (element) {
                        processElement(element, category);
                    }
                }
            } else {
                document.querySelectorAll(selector).forEach(element => {
                    processElement(element, category);
                });
            }
        } catch (error) {
            console.error('Error processing selector:', selector, 'Error:', error);
        }
    }

    function processElement(element, category) {
        if (!element.id) {
            element.id = 'random-' + Math.floor(Math.random() * 1000000);
        }

        let id = element.id;

        if (!id.includes('-cloned')) {
            let originalTextWithNoTranslate = element.innerHTML.replace(/<translation>.*?<\/translation>/g, '').replace(/<\/?[^>]+(>|$)/g, '').trim();

            if (originalTextWithNoTranslate !== '' && originalTextWithNoTranslate !== contentCache[id]) {
                contentCache[id] = originalTextWithNoTranslate;

                let clonedContent = getElementWithTranslation(element);
                clonedContent.style.display = 'none';

                let questionContext = category === 'answer'
                    ? document.querySelector(selectors['question'])?.textContent.trim() || ''
                    : '';


                translateText(originalTextWithNoTranslate, questionContext, function (translatedText, flowers) {
                    clonedContent.innerHTML = '';
                    prepareTranslationElementAndAddToDom(element, clonedContent, translatedText, flowers);
                });
            }
        }
    }

    function intervalQuestion() {
        if (!document.querySelector(selectors['question'])) {
            let fieldset = document.querySelector('#question_form > fieldset');

            if (fieldset && fieldset.innerHTML.trim() !== '') {
                // Создаем массив для хранения всех текстовых узлов
                let textNodes = [];

                // Проходим по всем дочерним узлам fieldset
                for (let node of fieldset.childNodes) {
                    // Проверяем, является ли узел текстовым или элементом <b>/<i> с текстом внутри
                    if (
                        node.textContent.trim() !== '' &&
                        (node.nodeType === Node.TEXT_NODE ||
                        (node.nodeType === Node.ELEMENT_NODE &&
                        (node.tagName === 'B' || node.tagName === 'I')))
                    ) {
                        // Добавляем узел в массив
                        textNodes.push(node);
                    }
                }

                // Если найдены текстовые узлы
                if (textNodes.length > 0) {
                    // Создаем новый div элемент
                    const wrapper = document.createElement('div');
                    // Добавляем ID
                    wrapper.id = selectors['question'].slice(1);

                    // Объединяем текст всех найденных узлов
                    const combinedText = textNodes.map(node => node.textContent.trim()).join(' ');

                    // Устанавливаем объединенный текст в div
                    wrapper.textContent = combinedText;

                    // Заменяем первый найденный текстовый узел на div
                    fieldset.replaceChild(wrapper, textNodes[0]);

                    // Удаляем остальные текстовые узлы
                    for (let i = 1; i < textNodes.length; i++) {
                        fieldset.removeChild(textNodes[i]);
                    }
                }
            }
        }

        processSelector(selectors['question'], 'question')
    }

    function intervalComment() {
        if (!document.querySelector(selectors['comment'])) {
            let comment_with_trash = document.querySelector('#eztr_pod_pytaniem > div > div > div');

            if (comment_with_trash && comment_with_trash.innerHTML.trim() !== '') {
                // Разбиваем содержимое по тегу <br>
                let parts = comment_with_trash.innerHTML.split('<br>');

                // Берем все, что идет после первого <br>
                if (parts.length > 1) {
                    // Собираем все оставшиеся части
                    let afterBrContent = parts.slice(1).join('<br>');

                    // Создаем временный элемент для очистки содержимого от HTML-тегов
                    let tempDiv = document.createElement('div');
                    tempDiv.innerHTML = afterBrContent;
                    let plainText = tempDiv.textContent || tempDiv.innerText || '';

                    // Создаем новый элемент <div> с нужным ID
                    let newDiv = document.createElement('div');
                    newDiv.id = selectors['comment'].slice(1);
                    newDiv.textContent = plainText.trim(); // Добавляем очищенный текст в новый элемент

                    // Находим элемент с ID eztr_pod_pytaniem
                    let eztr_pod_pytaniem = document.querySelector('#eztr_pod_pytaniem');
                    if (eztr_pod_pytaniem) {
                        // Добавляем новый элемент последним в eztr_pod_pytaniem
                        eztr_pod_pytaniem.appendChild(newDiv);

                        // Удаляем comment_with_trash из DOM
                        comment_with_trash.remove();
                    } else {
                        console.log('Элемент #eztr_pod_pytaniem не найден.');
                    }
                } else {
                    console.log('Элемент <br> не найден');
                }
            }
        }

        processSelector(selectors['comment'], 'comment')
    }

    function intervalAnswer() {
        // Находим все элементы div.widget-content > div.answers_element
        let answerElements = document.querySelectorAll('div.widget-content > div.answers_element');

        // Проходим по каждому найденному элементу
        answerElements.forEach(answerElement => {
            // Проверяем, есть ли уже внутри div.answer_block
            if (!answerElement.querySelector(selectors['answer_block'])) {
                // Создаем массив для хранения всех текстовых узлов
                let textNodes = [];
                let brFound = false;

                // Проходим по всем дочерним узлам
                for (let node of answerElement.childNodes) {
                    let tag = node.tagName
                    let type = node.nodeType

                    if (tag === 'BR') {
                        brFound = true
                    } else if (
                        brFound &&
                        node.textContent.trim() !== '' &&
                        (type === Node.TEXT_NODE ||
                        (type === Node.ELEMENT_NODE &&
                        (tag === 'B' || tag === 'I')))
                    ) {
                        // Добавляем узел в массив
                        textNodes.push(node);
                    }
                }

                // Если найдены текстовые узлы
                if (textNodes.length > 0) {
                    // Создаем новый div элемент
                    const wrapper = document.createElement('div');
                    // Добавляем className
                    wrapper.className = 'answer_block';

                    // Объединяем текст всех найденных узлов
                    const combinedText = textNodes.map(node => node.textContent.trim()).join(' ');

                    // Устанавливаем объединенный текст в div
                    wrapper.textContent = combinedText;

                    // Заменяем первый найденный текстовый узел на div
                    answerElement.replaceChild(wrapper, textNodes[0]);

                    // Удаляем остальные текстовые узлы
                    for (let i = 1; i < textNodes.length; i++) {
                        answerElement.removeChild(textNodes[i]);
                    }
                }
            }
        });

        processSelector(selectors['answer'], 'answer')
    }

    function intervalSelectorsToRemove() {
        selectorsToRemove.forEach(function (item) {
            let elements;

            // Проверяем, является ли селектор XPath
            if (item.selector.startsWith('/')) {
                // Используем XPath
                const xpathResult = document.evaluate(
                    item.selector,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );

                elements = [];
                for (let i = 0; i < xpathResult.snapshotLength; i++) {
                    elements.push(xpathResult.snapshotItem(i));
                }
            } else {
                // Используем обычный селектор
                elements = document.querySelectorAll(item.selector);
            }

            elements.forEach(function (element) {
                let elementToRemove = element;

                for (let i = 0; i < item.deleteLevel; i++) {
                    if (elementToRemove.parentNode) {
                        elementToRemove = elementToRemove.parentNode;
                    } else {
                        break;
                    }
                }

                if (elementToRemove && elementToRemove.parentNode) {
                    elementToRemove.parentNode.removeChild(elementToRemove);
                }
            });
        });
    }

    function menu() {
        const navMenu = document.getElementById("main-nav");

        // Проверяем наличие меню и отсутствие уже добавленных элементов
        if (navMenu && !navMenu.querySelector(".extension_menu")) {
            // Добавляем временный пустой элемент, чтобы предотвратить повторные запросы
            let tempLi = document.createElement("li");
            tempLi.classList.add("extension_menu");
            navMenu.insertBefore(tempLi, navMenu.firstChild);

            // Запрос к серверу для получения элементов меню
            makeHttpRequest('menu/menu', {}, data => {
                // Удаляем временный элемент перед добавлением реальных пунктов
                navMenu.removeChild(tempLi);

                const items = data.items.reverse(); // Обратный порядок для вставки в начало

                items.forEach(item => {
                    let li = document.createElement("li");
                    li.classList.add("extension_menu");

                    let a = document.createElement("a");
                    a.target = '_blank';
                    a.style = item.style;
                    a.href = item.url;
                    a.textContent = item.text;

                    let icon = document.createElement("i");
                    icon.classList.add(item.icon); // Класс иконки
                    a.insertBefore(icon, a.firstChild); // Добавляем иконку перед текстом

                    li.appendChild(a);
                    navMenu.insertBefore(li, navMenu.firstChild); // Вставляем в начало меню
                });

                Array.from(navMenu.querySelectorAll("a")).forEach(link => {
                    if (data.remove.includes(link.href)) {
                        link.closest("li").remove();
                    }
                });
            });
        }
    }


    setInterval(function () {
        intervalSelectorsToRemove();
        intervalQuestion();
        intervalComment();
        intervalAnswer();
        createSwitchesIfNotExist();
        processSelector(selectors['answer_block'], 'answer_block')
        selectors['others'].forEach(selector => processSelector(selector, 'others'));
        menu();
    }, 100);

    let style = document.createElement('style');
    style.type = 'text/css';

    style.innerHTML = `
    .image-link {
        position: relative;
        text-decoration: underline;
    }
    .image-link .tooltip {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 1000;
        background-color: white;
        border: 1px solid #ccc;
        padding: 5px;
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.2);
    }
    .image-link:hover .tooltip img {
        max-width: 100px;
        height: auto;
    }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 34px;
    }
    .switch {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 34px;
    }
    .switch:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .switch {
      background-color: #2196F3;
    }
    input:checked + .switch:before {
      transform: translateX(26px);
    }`;

    document.head.appendChild(style);

    window.createHint = function(mouseX, mouseY) {
        const hintDiv = document.createElement('div');

        hintDiv.style.position = 'fixed';
        hintDiv.style.top = mouseY + 'px';
        hintDiv.style.left = mouseX + 'px';
        hintDiv.style.zIndex = '1000';
        hintDiv.style.border = '1px solid black';
        hintDiv.style.backgroundColor = 'white';
        hintDiv.style.padding = '5px';
        hintDiv.style.boxShadow = '0px 0px 10px rgba(0,0,0,0.5)';
        document.body.appendChild(hintDiv);

        return hintDiv;
    };

    window.createImgHint = function(src, mouseX, mouseY) {
        let hintDiv = createHint(mouseX, mouseY);

        const img = document.createElement('img');
        img.src = src;
        img.style.width = '400px';
        img.style.height = 'auto';

        hintDiv.appendChild(img);

        return hintDiv;
    };
})();
