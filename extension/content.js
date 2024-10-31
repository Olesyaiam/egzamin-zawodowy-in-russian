(function () {
    'use strict';

    const baseUrl = 'https://webscrapp.rocks/egzamin-zawodowy/'
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

    function prepareTranslationElementAndAddToDom(original_element, translation_element, translation, images) {
        let lastIndex = 0;
        let match;

        // Подготовка оригинального элемента
        let originalText = original_element.innerHTML;
    
        // Проход по ключам объекта images
        Object.keys(images).forEach((key) => {
            const keyRegex = new RegExp(`\\b(${key})\\b`, 'gi'); // Регулярное выражение для поиска ключевого слова
            const imageUrl = images[key]; // URL изображения для ключевого слова
            originalText = originalText.replace(keyRegex, `<a href="${imageUrl}" target="_blank">$1</a>`); // Замена ключевого слова на <a>
        });
    
        // Обновляем содержимое original_element с выделенными жирным словами
        original_element.innerHTML = originalText;
    
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
        makeHttpRequest('translations/get', {text: text, question_context: questionContext}, function (result) {
            if (result.translation && result.translation.trim() !== '') {
                saveToCacheEmojiFlag(result.translation, !result.approved);
                callback(result.translation, result.images);
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


                translateText(originalTextWithNoTranslate, questionContext, function (translatedText, images) {
                    clonedContent.innerHTML = '';
                    prepareTranslationElementAndAddToDom(element, clonedContent, translatedText, images);
                });
            }
        }
    }

    function intervalQuestion() {
        if (!document.querySelector(selectors['question'])) {
            let question_with_trash = document.querySelector('#question_form > fieldset');

            if (question_with_trash && question_with_trash.innerHTML.trim() !== '') {
                let parts;

                if (question_with_trash.innerHTML.includes('<p class="image_test visible-desktop">')) {
                    parts = question_with_trash.innerHTML.split('<p class="image_test visible-desktop">');
                } else if (question_with_trash.innerHTML.includes('<div class="image_test">')) {
                    parts = question_with_trash.innerHTML.split('<div class="image_test">');
                } else {
                    // Для таблицы используем сохранение самого тега <table> и его содержимого
                    parts = question_with_trash.innerHTML.split(/(<table class="table_answers[^>]*>)/);
                }

                // Разделяем первую часть на блоки с div
                let parts2 = parts[0].split('</div>');
                let question = parts2.at(-1); // Получаем вопрос

                // Убираем вопрос, но оставляем остальное содержимое
                parts2.pop();
                let newHTML = parts2.join('</div>') + '</div>';

                // Добавляем вторую часть (с тегом <p> или <table>) обратно, не изменяя её
                if (parts.length > 1) {
                    newHTML += parts.slice(1).join('');
                }
                question_with_trash.innerHTML = newHTML;

                // Очищаем вопрос от HTML-тегов
                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = question;
                let cleanQuestion = tempDiv.textContent || tempDiv.innerText || '';

                // Создаем новый элемент <div> для сохранения очищенного вопроса
                let xpath = '//*[@id="question_form"]/fieldset//div[b]';
                let result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);

                let questionDiv = document.createElement('div');
                questionDiv.id = selectors['question'].slice(1);
                questionDiv.textContent = cleanQuestion.trim();
                result.singleNodeValue.appendChild(questionDiv);
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
        answerElements.forEach(answersElement => {
            // Проверяем, есть ли уже внутри div.answer_block
            if (!answersElement.querySelector(selectors['answer_block'])) {
                // Находим элементы <br> и <table>
                let brElement = answersElement.querySelector('br');
                let tableElement = answersElement.querySelector('table.table_answers');

                // Проверяем, что оба элемента найдены
                if (brElement && tableElement) {
                    // Создаем новый <div class="answer_block">
                    let answerBlockDiv = document.createElement('div');
                    answerBlockDiv.className = 'answer_block';

                    // Получаем все элементы между <br> и <table>
                    let currentElement = brElement.nextSibling;
                    while (currentElement && currentElement !== tableElement) {
                        let nextElement = currentElement.nextSibling; // Сохраняем следующий элемент
                        answerBlockDiv.appendChild(currentElement); // Перемещаем текущий элемент в answer_block
                        currentElement = nextElement; // Переходим к следующему элементу
                    }

                    // Вставляем новый div перед таблицей
                    answersElement.insertBefore(answerBlockDiv, tableElement);
        
                    // Проверяем, есть ли div.image_test внутри answer_block
                    let imageTestDiv = answerBlockDiv.querySelector('div.image_test');
                    if (imageTestDiv) {
                        // Перемещаем div.image_test после answer_block
                        answersElement.insertBefore(imageTestDiv, answerBlockDiv.nextSibling);
                    }
                } else {
                    console.error('Не найдены необходимые элементы: <br> или <table>');
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

    setInterval(function () {
        intervalSelectorsToRemove();
        intervalQuestion();
        intervalComment();
        intervalAnswer();
        createSwitchesIfNotExist();
        processSelector(selectors['answer_block'], 'answer_block')
        selectors['others'].forEach(selector => processSelector(selector, 'others'));
    }, 100);

    let style = document.createElement('style');
    style.type = 'text/css';

    style.innerHTML = `
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
})();
