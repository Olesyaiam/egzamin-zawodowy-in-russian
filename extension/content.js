(function () {
    'use strict';

    const baseUrl = 'http://145.239.80.201:8081/'

    const switchSelectors = []

    const selectors = {
        "question": "#question_text",
        "others": [
            //"#eztr_pod_pytaniem > div > div > div",
            "div.wyjasnienie_pytania > div.alert",
            "td > label"
        ]
    };

    let selectorsToRemove = [
        {
            selector: 'div.wyjasnienie_pytania > div > b > i',
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

    function createHint(mouseX, mouseY) {
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

        return hintDiv
    }

    function createImgHint(src, mouseX, mouseY) {
        let hintDiv = createHint(mouseX, mouseY)

        const img = document.createElement('img');
        img.src = src;
        img.style.width = '200px';
        img.style.height = 'auto';

        hintDiv.appendChild(img);

        return hintDiv;
    }

    function createTextHint(text, mouseX, mouseY) {
        let hintDiv = createHint(mouseX, mouseY)
        hintDiv.style.pointerEvents = 'none';
        hintDiv.style.maxWidth = '400px';
        hintDiv.style.wordWrap = 'break-word';

        const textNode = document.createElement('span');
        textNode.textContent = text;
        hintDiv.appendChild(textNode);

        return hintDiv;
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
            console.log(endpoint + " " + translation + ": " + result);
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

    function createAndInsertToggleSwitch(element, id) {
        const div = document.createElement('div');
        div.className = 'toggle-switch';
        div.style.display = 'block';

        div.style.marginLeft = '0px';
        div.style.marginRight = '5px';
        div.style.marginTop = '5px';
        div.style.marginBottom = '0px';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.hidden = true;
        input.checked = loadFromCacheSwitchState()
        switchIds.add(id);
        input.addEventListener('change', setSwitchState);

        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.className = 'switch';

        div.appendChild(input);
        div.appendChild(label);
        element.prepend(div);
    }

    function prepareTranslationElementAndAddToDom(category, element, translation, originalText) {
        const regex = /\b([A-Z]-\d+[A-Za-z]?)\b/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(translation)) !== null) {
            const beforeMatch = document.createElement('b');
            beforeMatch.textContent = translation.substring(lastIndex, match.index);
            element.appendChild(beforeMatch);

            const link = document.createElement('a');
            link.href = signsImagesBasePath + match[1].toUpperCase() + '.png';
            link.textContent = match[1];

            let hintElement;

            link.onmouseover = (e) => {
                const mouseX = e.clientX + 10;
                const mouseY = e.clientY + 10;
                hintElement = createImgHint(link.href, mouseX, mouseY);
            };

            link.onmouseout = () => {
                if (hintElement) document.body.removeChild(hintElement);
            };
            element.appendChild(link);

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < translation.length) {
            const remainingText = document.createElement('b');
            remainingText.textContent = translation.substring(lastIndex);
            element.appendChild(remainingText);
        }

        const span = document.createElement('span');

        if (loadFromCacheEmojiFlag(translation)) {
            createLikeOrDislikeEmojiLink(span, () => markTranslationAsCorrect(translation), true);
            span.appendChild(document.createTextNode(' '));
            createLikeOrDislikeEmojiLink(span, () => markTranslationAsIncorrect(translation), false);
        } else {
            span.innerHTML = ' ✅';
        }

        element.classList.add('translation');
        element.appendChild(span);

        setSwitchState()
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

    function saveToCacheRegistrationDate(registrationDate) {
        console.log('Save the registration date: "' + registrationDate + '"');
        localStorage.setItem('registration_date', registrationDate);
    }

    function loadFromCacheRegistrationDate() {
        return localStorage.getItem('registration_date');
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

    function translateText(text, callback) {
        let cachedTranslation = loadTranslateFromCache(text);

        if (cachedTranslation !== null) {
            callback(cachedTranslation);
        } else {
            makeHttpRequest('translations/get', {text: text}, function (result) {
                if (result.translation && result.translation.trim() !== '') {
                    saveTranslateToCache(text, result.translation);
                    saveToCacheEmojiFlag(result.translation, !result.approved);
                    callback(result.translation);
                } else {
                    console.log('Invalid translation received for: ' + text);
                    callback('Ошибка: не получилось перевести.', false);
                }
            });
        }
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

    function processSwitch(selector) {
        let id = 'toggle-switch-' + selector.length
        let switchElement = document.getElementById(id);

        if (!switchElement) {
            let element;

            if (selector.startsWith('/')) {
                const xpathResult = document.evaluate(
                    selector,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );

                if (xpathResult.snapshotLength > 0) {
                    element = xpathResult.snapshotItem(0);
                }
            } else {
                element = document.querySelector(selector);
            }

            if (element) {
                createAndInsertToggleSwitch(element, id);
            }
        }
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
                        processElement(element, selector, category);
                    }
                }
            } else {
                document.querySelectorAll(selector).forEach(element => {
                    processElement(element, selector, category);
                });
            }
        } catch (error) {
            console.error('Error processing selector:', selector, 'Error:', error);
        }
    }

    function processElement(element, selector, category) {
        if (!element.id) {
            element.id = 'random-' + Math.floor(Math.random() * 1000000);
        }

        let id = element.id;

        if (!id.includes('-cloned')) {
            let originalTextWithNoTranslate = element.innerHTML.replace(/<translation>.*?<\/translation>/g, '').replace(/<\/?[^>]+(>|$)/g, '').trim();

            if (originalTextWithNoTranslate !== '' && originalTextWithNoTranslate !== contentCache[id]) {
                contentCache[id] = originalTextWithNoTranslate;

                if (id && id.endsWith('-answer')) {
                    translateText(originalTextWithNoTranslate, function (translatedText) {
                        element.innerHTML = originalTextWithNoTranslate + '<translation><br /><b></b><br /><br /></translation>';
                        const translationElement = element.querySelector('b');
                        prepareTranslationElementAndAddToDom(
                            category,
                            translationElement,
                            translatedText,
                            originalTextWithNoTranslate
                        );
                    });
                } else if (selector.includes('page_title')) {
                    translateText(originalTextWithNoTranslate, function (translatedText) {
                        element.innerHTML = originalTextWithNoTranslate + '<translation><br /></translation>';
                        const translationElement = element.querySelector('translation');
                        prepareTranslationElementAndAddToDom(
                            category,
                            translationElement,
                            translatedText,
                            originalTextWithNoTranslate
                        );
                    });
                } else {
                    let clonedContent = getElementWithTranslation(element);
                    clonedContent.style.display = 'none';

                    translateText(originalTextWithNoTranslate, function (translatedText) {
                        clonedContent.innerHTML = '';
                        prepareTranslationElementAndAddToDom(
                            category,
                            clonedContent,
                            translatedText,
                            originalTextWithNoTranslate
                        );
                    });
                }
            }
        }
    }

    let emptyRemoved = false;

    setInterval(function () {
        if (!document.querySelector(selectors['question'])) {
            let fieldset = document.querySelector('#question_form > fieldset');
            let questionTextNode = fieldset.childNodes[5];

            // Проверяем, что узел действительно существует и является текстом
            if (questionTextNode && questionTextNode.nodeType === Node.TEXT_NODE) {
                // Создаем новый элемент div с id="question_text"
                let div = document.createElement('div');
                div.id = selectors['question'].slice(1);
        
                // Добавляем текст вопроса в div
                div.textContent = questionTextNode.textContent.trim();
        
                // Заменяем оригинальный текстовый узел на новый div
                fieldset.replaceChild(div, questionTextNode);
            }
        }

        processSelector(selectors['question'], 'question')
        selectors['others'].forEach(selector => processSelector(selector, 'others'));

        switchSelectors.concat([selectors['question']]).forEach(selector => processSwitch(selector));
        const consentButton = document.querySelector('button.fc-button.fc-cta-consent.fc-primary-button');

        if (consentButton && !consentButton.classList.contains('clicked')) {
            consentButton.classList.add('clicked');
            consentButton.click();
        }

        let videoElement = document.getElementById('video');

        if (videoElement) {
            videoElement.controls = true;
        }

        selectorsToRemove.forEach(function (item) {
            let elements = document.querySelectorAll(item.selector);

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

        if (!emptyRemoved) {
            let elementToRemove = document.querySelector('section.breadcumb_area + *');

            if (elementToRemove) {
                elementToRemove.parentNode.removeChild(elementToRemove);
                emptyRemoved = true;
            }
        }
    }, 100);

    let style = document.createElement('style');
    style.type = 'text/css';

    style.innerHTML = `
    @keyframes blink { 
        50% { opacity: 0; } 
    }
    .breadcumb_area {
        height: 170px !important;
    }
    .breadcumb_section {
        margin-top: 33px !important;
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
})();
