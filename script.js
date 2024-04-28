// ==UserScript==
// @name         teoria.pl helper for Russian speaking persons
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Translate teoria.pl questions, answers and explanations to Russian
// @author       Pavel Geveiler
// @match        https://www.teoria.pl/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.js
// ==/UserScript==
(function () {
    'use strict';

    const selectors = {
        "question": [
            "#question-content",
            "#q-result-question"
        ],
        "others": [
            "//div[@id='q-result-answers']/div[child::node()[self::text()]]",
            '#report-question-content',
            '#a-answer',
            '#b-answer',
            '#c-answer',
            '#report-explanation',
            '#q-result-explanation',
            '#learning-success-tr2 > td > div:not([class]):not([id])',
            '#learning-failure-tr2 > td:first-child',
            '#learning-failure-tr3 > td:first-child',
            '#report-a-answer',
            '#report-b-answer',
            '#report-c-answer',
            '#a0',
            '#a1',
            '#a2',
            'div.col-md-6.col-lg-6 > div:not([class]):not([id])',
            'div.panel-body.card-panel > div.card-body'
        ]
    };

    let selectorsToRemove = [
        {
            selector: '.right-a.right-a-nl',
            deleteLevel: 0
        },
        {
            selector: '.google-auto-placed',
            deleteLevel: 0
        },
        {
            selector: 'iframe',
            deleteLevel: 0
        },
        {
            selector: 'div > .adsbygoogle',
            deleteLevel: 1
        },
        {
            selector: '.adsbygoogle',
            deleteLevel: 0
        },
        {
            selector: '.cc_banner-wrapper',
            deleteLevel: 0
        },
        {
            selector: '.google-revocation-link-placeholder',
            deleteLevel: 0
        },
        {
            selector: 'div.col-xs-12.society-like',
            deleteLevel: 2
        },
        {
            selector: '.top_header_area.hidden-xs',
            deleteLevel: 0
        },
        {
            selector: 'ol.test-list',
            deleteLevel: 3
        },
        {
            selector: 'div.text-center.version',
            deleteLevel: 3
        }
    ];

    let contentCache = {};
    let favoritesArray = [];

    function createPopup(src, mouseX, mouseY) {
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = mouseY + 'px';
        popup.style.left = mouseX + 'px';
        popup.style.zIndex = '1000';
        popup.style.border = '1px solid black';
        popup.style.backgroundColor = 'white';
        popup.style.padding = '5px';
        popup.style.boxShadow = '0px 0px 10px rgba(0,0,0,0.5)';

        const img = document.createElement('img');
        img.src = src;
        img.style.width = '200px';
        img.style.height = 'auto';

        popup.appendChild(img);
        document.body.appendChild(popup);

        return popup;
    }

    function makeHttpRequest(data, callback) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "http://145.239.80.201:8080/",
            headers: {"Content-Type": "application/json"},
            data: JSON.stringify(data),
            onload: function (response) {
                let result = JSON.parse(response.responseText);
                callback(result);
            }
        });
    }

    function sendTranslationFeedback(translation, actionType) {
        localStorage.clear();
        makeHttpRequest({[actionType]: translation}, function (result) {
            console.log(translation + " " + actionType + ": " + result.success);
        });
    }

    function markTranslationAsIncorrect(translation) {
        sendTranslationFeedback(translation, "mark_incorrect");
    }

    function approveTranslation(translation) {
        sendTranslationFeedback(translation, "approve");
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

    function createFavoritesEmojiLink(span, originalText) {
        const titleAdd = 'Добавить в список сложных';
        const titleRemove = 'Убрать из списка сложных';
        const emojiAdded = ' ⭐ ';
        const emojiNotAdded = ' ☆ ';

        const link = document.createElement('a');
        let addedToFavorites = favoritesArray.includes(originalText)

        link.href = '#';
        link.title = addedToFavorites ? titleRemove : titleAdd;
        link.innerHTML = addedToFavorites ? emojiAdded : emojiNotAdded;
        link.onclick = (e) => {
            e.preventDefault();
            addedToFavorites = !addedToFavorites;
            link.innerHTML = addedToFavorites ? emojiAdded : emojiNotAdded;
            link.title = addedToFavorites ? titleRemove : titleAdd;

            if (addedToFavorites) {
                addToFavoritesIfNotPresent(originalText)
            } else {
                removeFromFavorites(originalText)
            }
        };

        span.appendChild(link);
    }

    function addToFavoritesIfNotPresent(translation) {
        if (!favoritesArray.includes(translation)) {
            favoritesArray.push(translation);

            makeHttpRequest({add_to_favorites: translation}, function (result) {
                if (result.error === null) {
                    console.log("Added to Favorites in API: " + translation);
                } else {
                    console.log("Error adding to Favorites in API: " + translation);
                }
            });

            console.log(translation + " - added to Favorites.");
        } else {
            console.log(translation + " - already is in Favorites.");
        }
    }

    function removeFromFavorites(translation) {
        const index = favoritesArray.indexOf(translation);

        if (index !== -1) {
            favoritesArray.splice(index, 1);
            console.log(translation + " - removed from Favorites.");
        } else {
            console.log(translation + " - not found in Favorites.");
        }
    }

    function prepareTranslationElementAndAddToDom(category, element, translation, originalText) {
        if (category == 'question') {
            const spanForFavorite = document.createElement('span');
            createFavoritesEmojiLink(spanForFavorite, originalText);
            element.appendChild(spanForFavorite);
        }

        const regex = /\b([A-Z]-\d+[A-Za-z]?)\b/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(translation)) !== null) {
            // Добавляем текст до найденного соответствия жирным шрифтом
            const beforeMatch = document.createElement('b');
            beforeMatch.textContent = translation.substring(lastIndex, match.index);
            element.appendChild(beforeMatch);

            // Создаем и добавляем ссылку
            const link = document.createElement('a');
            link.href = 'https://raw.githubusercontent.com/pohape/teoria_pl_tests_translate/main/server_side/znaki/' + match[1].toUpperCase() + '.png';
            link.textContent = match[1];

            let popup;

            link.onmouseover = (e) => {
                const mouseX = e.clientX + 10; // 10 пикселей справа от курсора
                const mouseY = e.clientY + 10; // 10 пикселей ниже курсора
                popup = createPopup(link.href, mouseX, mouseY);
            };

            link.onmouseout = () => {
                if (popup) document.body.removeChild(popup);
            };
            element.appendChild(link); // Ссылка добавляется напрямую, без оборачивания в <b>

            lastIndex = regex.lastIndex;
        }

        // Добавляем оставшуюся часть текста после последнего соответствия жирным шрифтом
        if (lastIndex < translation.length) {
            const remainingText = document.createElement('b');
            remainingText.textContent = translation.substring(lastIndex);
            element.appendChild(remainingText);
        }

        const span = document.createElement('span');

        if (loadFromCacheEmojiFlag(translation)) {
            console.log(loadFromCacheEmojiFlag(translation) + ": add emojis for " + translation);

            createLikeOrDislikeEmojiLink(span, () => approveTranslation(translation), true);
            span.appendChild(document.createTextNode(' '));
            createLikeOrDislikeEmojiLink(span, () => markTranslationAsIncorrect(translation), false);
        } else {
            span.innerHTML = ' ✅';
        }

        element.appendChild(span);
    }

    function getCacheKey(originalText) {
        return "translationCache_" + CryptoJS.MD5(originalText).toString();
    }

    function getCacheKeyForEmojiFlags(translation) {
        return "emojiFlagsCache_" + CryptoJS.MD5(translation).toString();
    }

    function printNumberOfTranslationsInCache() {
        console.log("Number of translations in cache: " + Object.keys(localStorage).filter(key => key.startsWith("translationCache_")).length);
    }

    function saveToCacheEmojiFlag(translate, flag) {
        console.log("Save for '" + translate + "' emojiFlag=" + flag)
        localStorage.setItem(getCacheKeyForEmojiFlags(translate), flag ? '1' : '0');
    }

    function loadFromCacheEmojiFlag(translate) {
        let result = localStorage.getItem(getCacheKeyForEmojiFlags(translate));

        console.log("Load for '" + translate + "' emojiFlag=" + result)

        return result == 1;
    }

    function saveToCache(original, translate) {
        localStorage.setItem(getCacheKey(original), translate);
        // console.log("Translation saved to cache: " + translate);
        // printNumberOfTranslationsInCache();
    }

    function loadFromCache(original) {
        let cachedTranslation = localStorage.getItem(getCacheKey(original));

        if (cachedTranslation !== null) {
            // console.log("Translation loaded from cache: " + cachedTranslation);
            // printNumberOfTranslationsInCache();

            return cachedTranslation;
        }

        return null;
    }

    function translateText(text, callback) {
        let cachedTranslation = loadFromCache(text);

        if (cachedTranslation !== null) {
            callback(cachedTranslation);
        } else {
            makeHttpRequest({text: text}, function (result) {
                if (result.translate && result.translate.trim() !== '') {
                    saveToCache(text, result.translate);
                    saveToCacheEmojiFlag(result.translate, !result.approved);
                    callback(result.translate);
                } else {
                    console.log("Invalid translation received for: " + text);
                    callback("Ошибка: не получилось перевести.", false);
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

    function processSelector(selector, category) {
        try {
            if (selector.startsWith("/")) {
                const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < result.snapshotLength; i++) {
                    const element = result.snapshotItem(i);
                    processElement(element, selector, category);
                }
            } else {
                document.querySelectorAll(selector).forEach(element => {
                    processElement(element, selector, category);
                });
            }
        } catch (error) {
            console.error("Error processing selector:", selector, "Error:", error);
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
                        clonedContent.style.display = 'block';
                    });
                }
            }
        }
    }

    function loadFavorites() {
        makeHttpRequest({}, function (result) {
            if (result.error === null && Array.isArray(result.favorites)) {
                favoritesArray = result.favorites;
                console.log("Favorites loaded successfully", favoritesArray);
            } else {
                console.error("Failed to load favorites: ", result.error);
            }
        });
    }

    loadFavorites();
    let emptyRemoved = false;

    setInterval(function () {
        for (let category in selectors) {
            selectors[category].forEach(selector => processSelector(selector, category));
        }

        const consentButton = document.querySelector('button.fc-button.fc-cta-consent.fc-primary-button');

        if (consentButton && !consentButton.classList.contains('clicked')) {
            consentButton.classList.add('clicked');
            consentButton.click();
        }

        let videoElement = document.getElementById('video');

        if (videoElement) {
            videoElement.controls = true;
        }

        let imgElement = document.querySelector('img.img-responsive');

        imgElement.addEventListener('click', function () {
            // Проверяем, поддерживает ли браузер API полноэкранного режима
            if (imgElement.requestFullscreen) {
                imgElement.requestFullscreen(); // Нативный полноэкранный режим
            } else if (imgElement.mozRequestFullScreen) { /* Firefox */
                imgElement.mozRequestFullScreen();
            } else if (imgElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
                imgElement.webkitRequestFullscreen();
            } else if (imgElement.msRequestFullscreen) { /* IE/Edge */
                imgElement.msRequestFullscreen();
            }
        });

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

                elementToRemove.parentNode.removeChild(elementToRemove);
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
    .breadcumb_area {
        height: 170px !important;
    }
    .breadcumb_section {
        margin-top: 33px !important;
    }`;

    document.head.appendChild(style);
})();
