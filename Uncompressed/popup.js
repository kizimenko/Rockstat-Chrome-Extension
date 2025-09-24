// Импорт модулей
import objToDoc from '/popup-modules/objToDoc.js';

// Действия при загрузке страницы (DOM дерева)
document.addEventListener('DOMContentLoaded', init);

// Инициализация
function init() {
    // Установка глобальных переменных
    const global = {
        reqCount: 0, // Общее количество выполненных запросов
        blockNum: 1  // Номер раскрываемого блока
    }

    document.querySelector('span.title').innerHTML = chrome.runtime.getManifest().name;
    document.querySelector('span.version').innerHTML = 'Версия ' + chrome.runtime.getManifest().version;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        let domain = tabs[0].url.match(/.*:\/\/([^\/]+).*/)?.[1] || ''; // Домен активной вкладки
        document.querySelector("#domain").innerHTML = domain;
    });



    // Инициализировать исключения и фильтр объектов
    initExcludes();
    initObjectFilter();

    msg(global); // Обработка сообщений
    document.querySelector('#filter').addEventListener('input', applyFilter); // Обработка фильтрации
    document.querySelector('#clearFilter').addEventListener('click', clearFilter); // Обработка очистки поля ввода фильтра

    // Обработчики для новых функций
    document.querySelector('#copyData').addEventListener('click', () => copyToClipboard(global));
    document.querySelector('#exportJSON').addEventListener('click', () => exportData('json', global));

    // Обработчики для настроек исключений
    document.querySelector('#excludeSettings').addEventListener('click', openExcludeModal);
    document.querySelector('.close').addEventListener('click', closeExcludeModal);
    document.querySelector('#saveExcludes').addEventListener('click', saveExcludes);
    document.querySelector('#cancelExcludes').addEventListener('click', closeExcludeModal);

    // Обработчики для фильтра объектов
    document.querySelector('#objectFilterSettings').addEventListener('click', openObjectFilterModal);
    document.querySelector('.close-object-filter').addEventListener('click', closeObjectFilterModal);
    document.querySelector('#saveObjectFilter').addEventListener('click', saveObjectFilter);
    document.querySelector('#cancelObjectFilter').addEventListener('click', closeObjectFilterModal);

    // Обработчик переключения режима фильтрации
    document.querySelector('#filterModeToggle').addEventListener('click', toggleFilterMode);

    // Закрытие модального окна по клику вне его
    document.querySelector('#excludeModal').addEventListener('click', (e) => {
        if (e.target.id === 'excludeModal') {
            closeExcludeModal();
        }
    });

    // Закрытие модального окна фильтра объектов по клику вне его
    document.querySelector('#objectFilterModal').addEventListener('click', (e) => {
        if (e.target.id === 'objectFilterModal') {
            closeObjectFilterModal();
        }
    });

    // Получить div для добавления чекбокса
    let persistanceDiv = document.querySelector('.persistance');
    
    // Создать чекбокс
    let checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'dataPersistenceToggle';
    checkbox.name = 'dataPersistenceToggle';

    // Добавить чекбокс в div
    persistanceDiv.appendChild(checkbox);

    // Добавить обработчик событий для чекбокса
    checkbox.addEventListener('change', function() {
        // Обновить хранилище с новым значением чекбокса
        chrome.storage.local.set({'dataPersistence': this.checked});
    });

    // Установить начальное значение чекбокса на основе хранилища
    chrome.storage.local.get('dataPersistence', function(data) {
        checkbox.checked = data.dataPersistence || false;
    });
}

// Обработка сообщений
function msg(global) {
    let port = chrome.runtime.connect();

    // Если порт был отключен, очистить переменную port
    port.onDisconnect.addListener(() => { port = undefined; });
    
    // Если порт существует/подключен, отправить сообщение
    port?.postMessage({msg: 'handshake'});
    
    // Прослушивать сообщения на port
    port.onMessage.addListener(function(request) {
        if (request.msg === 'requests') {
            // Вывести полученную информацию о запросах в html документ
            document.querySelector('div.container.font').appendChild( objToDoc(request.data, global) );
            // console.log(request);
            applyExcludeFilter(); // Применить исключения и обычный фильтр
            global.reqCount += request.data.length; // Увеличить счетчик количества выполненных запросов

            // Изменить надпись о количестве выполненных запросов
            let textReqCount;
            let n = global.reqCount; // Число выполненных запросов
            if (n % 10 === 1 && n % 100 !== 11) { // Если число запросов заканчивается на 1
                textReqCount = 'запрос выполнен';
            } else if ( // Если число запросов заканчивается на 2, 3 или 4
                (n % 10 === 2 || n % 10 === 3 || n % 10 === 4) &&
                (n % 100 !== 12 && n % 100 !== 13 && n % 100 !== 14)
            ) {
                textReqCount = 'запроса выполнено';
            } else { // Все остальные варианты
                textReqCount = 'запросов выполнено';
            }
            document.querySelector("#requestCount").innerText = n;
            document.querySelector("#textReqCount").innerText = ` ${textReqCount} на `;
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                let domain = new URL(tabs[0].url).hostname;  // More reliable domain extraction using URL object
                let expectedURL = `https://${domain}/an/band/t4k.json`;
            
                // Check each request to see if it matches the expected URL pattern
                request.data.forEach(item => {
                    let requestURL = new URL(item.url);
            
                    // Check the base part of the URL and parameters
                    if (requestURL.origin + requestURL.pathname === expectedURL) {
                        // Optionally, check for specific query parameters
                        let params = requestURL.searchParams;
                        let dig = params.get('dig');
                        let td_trans = params.get('td_trans');
            
                        if (dig && td_trans) {  // Confirm that necessary parameters are present
                            // Update the UI with the data
                            document.querySelector('#uid').innerText = item.uid;
                            document.querySelector('#user_id').innerText = item.user.id;
                            document.querySelector('#currency').innerText = item.user.currency;
                            document.querySelector('#locale').innerText = item.user.locale;
                        }
                    }
                });
            });
        }
    });
}

// Оптимизированная функция применения всех фильтров
function applyAllFilters() {
    const input = document.querySelector('#filter');
    const filterStr = (input.value || '').toLowerCase();
    const clear = document.querySelector('#clearFilter');
    const blocksCollection = document.querySelector('div.container.font').children;

    // Управление кнопкой очистки
    clear.style.display = filterStr ? 'inline-block' : 'none';

    // Используем DocumentFragment для батчевых изменений DOM
    const fragment = document.createDocumentFragment();
    const hiddenBlocks = [];

    // Перебор блоков с объединенной логикой фильтрации
    for (let i = 0; i < blocksCollection.length; i++) {
        const el = blocksCollection[i];
        let isVisible = filterStr === ''; // По умолчанию показываем все при пустом фильтре

        // Получение или создание кешированного названия события
        let eventName = eventCache.get(el);
        if (!eventName) {
            const label = el.querySelector('label');
            if (label) {
                const labelText = label.innerText;
                eventName = labelText.split(' - ')[0].trim().toLowerCase();
                eventCache.set(el, eventName);
            }
        }

        // Проверка исключений (O(1) благодаря Set)
        if (eventName && isEventExcluded(eventName)) {
            el.classList.add('excluded');
            isVisible = false;
        } else {
            el.classList.remove('excluded');

            // Применение текстового фильтра только если событие не исключено
            if (filterStr && !isVisible) {
                isVisible = checkTextFilter(el, filterStr);
            }
        }

        // Применение видимости
        const shouldShow = isVisible ? '' : 'none';
        if (el.style.display !== shouldShow) {
            el.style.display = shouldShow;
        }
    }
}

// Быстрая проверка исключений с поддержкой частичного совпадения
function isEventExcluded(eventName) {
    // Сначала точное совпадение (O(1))
    if (excludedNamesSet.has(eventName)) {
        return true;
    }

    // Затем проверка частичного совпадения (только при необходимости)
    for (const excludeName of excludedNamesSet) {
        if (eventName.includes(excludeName)) {
            return true;
        }
    }

    return false;
}

// Оптимизированная проверка текстового фильтра
function checkTextFilter(el, filterStr) {
    if (isGlobalFilterMode) {
        // Режим поиска по всему объекту
        // Проверка заголовка
        const label = el.querySelector('label');
        if (label && label.innerText.toLowerCase().includes(filterStr)) {
            return true;
        }

        // Проверка содержимого (ленивая загрузка)
        const spans = el.querySelectorAll('span');
        for (const span of spans) {
            if (span.innerText.toLowerCase().includes(filterStr)) {
                return true;
            }
        }

        return false;
    } else {
        // Режим поиска только по названию события
        const label = el.querySelector('label');
        if (label) {
            const labelText = label.innerText;
            // Извлекаем только название события (до первого ' - ')
            const eventName = labelText.split(' - ')[0].trim().toLowerCase();
            return eventName.includes(filterStr);
        }
        return false;
    }
}

// Обратная совместимость
function applyFilter() {
    applyAllFilters();
}

// Функция очистки поля ввода фильтра
function clearFilter() {
    let input = document.querySelector('#filter');
    input.value = '';
    applyFilter();
    input.focus();
}

// Функция копирования данных в буфер обмена
async function copyToClipboard(global) {
    try {
        const allRequests = getAllVisibleRequests();
        const jsonData = JSON.stringify(allRequests, null, 2);
        await navigator.clipboard.writeText(jsonData);

        // Показать уведомление
        const button = document.querySelector('#copyData');
        const originalText = button.textContent;
        button.textContent = 'Скопировано!';
        setTimeout(() => button.textContent = originalText, 1000);
    } catch (error) {
        console.error('Ошибка копирования:', error);
        alert('Ошибка копирования в буфер обмена');
    }
}

// Функция экспорта данных
function exportData(format, global) {
    const allRequests = getAllVisibleRequests();

    if (format === 'json') {
        const content = JSON.stringify(allRequests, null, 2);
        const filename = `rockstat-requests-${new Date().toISOString().slice(0,10)}.json`;
        const mimeType = 'application/json';

        // Создание и скачивание файла
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Получить все видимые запросы
function getAllVisibleRequests() {
    const requests = [];
    const blocks = document.querySelectorAll('.container.font .block');

    blocks.forEach(block => {
        if (block.style.display !== 'none') {
            const label = block.querySelector('label');
            const content = extractBlockData(block);
            requests.push({
                title: label?.textContent || '',
                timestamp: Date.now(),
                data: content
            });
        }
    });

    return requests;
}

// Извлечь данные из блока
function extractBlockData(block) {
    const data = {};
    const spans = block.querySelectorAll('span');

    spans.forEach(span => {
        const keySpan = span.querySelector('.key');
        if (keySpan) {
            const key = keySpan.textContent.replace(':', '').trim();
            const value = span.textContent.replace(keySpan.textContent, '').trim();
            data[key] = value;
        }
    });

    return data;
}

// Глобальные переменные для оптимизации фильтрации
let excludedNames = [];
let excludedNamesSet = new Set(); // Быстрый поиск O(1)
let eventCache = new Map(); // Кеш извлеченных названий событий
let isGlobalFilterMode = false; // Режим фильтрации: false = по названию, true = по всему объекту

// Переменные для фильтра объектов (глобальные для доступа из модулей)
let allowedObjects = [];
let allowedObjectsSet = new Set(); // Быстрый поиск O(1)
let isObjectFilterActive = false; // Активен ли фильтр объектов

// Делаем переменные глобальными для доступа из модулей
window.allowedObjectsSet = allowedObjectsSet;
window.isObjectFilterActive = isObjectFilterActive;

// Открытие модального окна настроек исключений
async function openExcludeModal() {
    // Загрузить текущие исключения из storage
    const { excludeList } = await chrome.storage.local.get('excludeList');
    excludedNames = excludeList || [];

    document.querySelector('#excludeList').value = excludedNames.join('\n');
    document.querySelector('#excludeModal').style.display = 'block';
}

// Закрытие модального окна
function closeExcludeModal() {
    document.querySelector('#excludeModal').style.display = 'none';
}

// Сохранение списка исключений
async function saveExcludes() {
    const textarea = document.querySelector('#excludeList');
    const newExcludes = textarea.value
        .split('\n')
        .map(line => line.trim().toLowerCase()) // Нормализация к нижнему регистру
        .filter(line => line.length > 0);

    // Обновление структур данных
    excludedNames = newExcludes;
    excludedNamesSet = new Set(newExcludes); // Перестроение Set для быстрого поиска

    // Сохранить в storage
    await chrome.storage.local.set({ 'excludeList': excludedNames });

    closeExcludeModal();

    // Очистка кеша при изменении исключений
    eventCache.clear();

    // Очистить существующие блоки и перерисовать с новым фильтром
    refreshAllBlocks();

    console.log('Исключения сохранены:', excludedNames);
}

// Инициализация исключений при загрузке
async function initExcludes() {
    const { excludeList } = await chrome.storage.local.get('excludeList');
    excludedNames = excludeList || [];
    excludedNamesSet = new Set(excludedNames.map(name => name.toLowerCase()));
    console.log('Загружены исключения:', excludedNames);
}

// Инициализация фильтра объектов при загрузке
async function initObjectFilter() {
    const { objectFilterList } = await chrome.storage.local.get('objectFilterList');
    allowedObjects = objectFilterList || [];
    allowedObjectsSet = new Set(allowedObjects.map(name => name.toLowerCase()));
    isObjectFilterActive = allowedObjects.length > 0;

    // Обновляем глобальные переменные
    window.allowedObjectsSet = allowedObjectsSet;
    window.isObjectFilterActive = isObjectFilterActive;

    console.log('Загружен фильтр объектов:', allowedObjects);
}

// Открытие модального окна настроек фильтра объектов
async function openObjectFilterModal() {
    // Загрузить текущий фильтр объектов из storage
    const { objectFilterList } = await chrome.storage.local.get('objectFilterList');
    allowedObjects = objectFilterList || [];

    document.querySelector('#objectFilterList').value = allowedObjects.join('\n');
    document.querySelector('#objectFilterModal').style.display = 'block';
}

// Закрытие модального окна фильтра объектов
function closeObjectFilterModal() {
    document.querySelector('#objectFilterModal').style.display = 'none';
}

// Сохранение фильтра объектов
async function saveObjectFilter() {
    const textarea = document.querySelector('#objectFilterList');
    const newAllowedObjects = textarea.value
        .split('\n')
        .map(line => line.trim().toLowerCase()) // Нормализация к нижнему регистру
        .filter(line => line.length > 0);

    // Обновление структур данных
    allowedObjects = newAllowedObjects;
    allowedObjectsSet = new Set(newAllowedObjects);
    isObjectFilterActive = allowedObjects.length > 0;

    // Обновляем глобальные переменные
    window.allowedObjectsSet = allowedObjectsSet;
    window.isObjectFilterActive = isObjectFilterActive;

    // Сохранить в storage
    await chrome.storage.local.set({ 'objectFilterList': allowedObjects });

    closeObjectFilterModal();

    // Очистить существующие блоки и перерисовать с новым фильтром
    refreshAllBlocks();

    console.log('Фильтр объектов сохранен:', allowedObjects);
    console.log('Фильтр объектов активен:', isObjectFilterActive);
}

// Переключение режима фильтрации
function toggleFilterMode() {
    const toggleButton = document.querySelector('#filterModeToggle');
    const filterInput = document.querySelector('#filter');

    isGlobalFilterMode = !isGlobalFilterMode;

    if (isGlobalFilterMode) {
        toggleButton.classList.add('global-mode');
        toggleButton.textContent = '🌐';
        toggleButton.title = 'Поиск по всему объекту (клик для поиска по названию)';
        filterInput.placeholder = 'фильтр по всему объекту';
    } else {
        toggleButton.classList.remove('global-mode');
        toggleButton.textContent = '📍';
        toggleButton.title = 'Поиск по названию события (клик для поиска по всему объекту)';
        filterInput.placeholder = 'фильтр по названию';
    }

    // Применить фильтр с новым режимом
    applyAllFilters();
}

// Устаревшая функция - сохранена для обратной совместимости
// Теперь используется applyAllFilters()
function applyExcludeFilter() {
    applyAllFilters();
}

// Функция для перерисовки всех блоков с новыми фильтрами
function refreshAllBlocks() {
    // Очистить контейнер с блоками
    const container = document.querySelector('div.container.font');
    container.innerHTML = '';

    // Сбросить счетчик блоков
    const global = { blockNum: 1 };

    // Запросить данные заново у background script
    let port = chrome.runtime.connect();
    port?.postMessage({msg: 'refresh'});

    // Прослушивать ответ
    port.onMessage.addListener(function(request) {
        if (request.msg === 'requests' && request.data && request.data.length > 0) {
            // Перерисовать блоки с новыми фильтрами
            container.appendChild( objToDoc(request.data, global) );
            // Применить все фильтры
            applyAllFilters();
        }
    });
}

