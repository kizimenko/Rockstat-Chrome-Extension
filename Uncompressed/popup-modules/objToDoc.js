// Перевод массива объектов в DocumentFragment в виде списка раскрываемых блоков
export default function objToDoc(objArr, global) {
    // Получаем доступ к переменным фильтра объектов из основного скрипта
    const allowedObjectsSet = window.allowedObjectsSet || new Set();
    const isObjectFilterActive = window.isObjectFilterActive || false;
    let fragment = document.createDocumentFragment(); // Создать новый пустой фрагмент

    // Перебор массива объектов - запросов для активной вкладки
    objArr.forEach(function(obj) {
        let domain = obj.url.match(/.*:\/\/([^\/]+).*/)?.[1] || ''; // Домен куда шлем аналитику
        let pagePath = obj.page?.path || ''; // Путь страницы

        // Формируем базовый заголовок
        let labelText = (obj.name || '') + ' - ' + (obj.projectId || '') + (domain ? ' - ' + domain : '');

        createHtmlBlock(obj, labelText, pagePath, fragment);
        // console.log(obj);
    });

    // Создание разворачиваемого блока HTML (для основных блоков)
    function createHtmlBlock(obj, labelText, pagePath, fragment) {
        let divBlock = document.createElement('div'); // Создать новый элемент div
        divBlock.className = 'block';

        let inputHide = document.createElement('input'); // Создать новый элемент input
        inputHide.id = 'hd-' + global.blockNum;
        inputHide.className = 'hide';
        inputHide.type = 'checkbox';
        inputHide.addEventListener('change', scrollToContent); // Добавить слушатель события изменения состояния чекбокса
        divBlock.appendChild(inputHide);

        let label = document.createElement('label'); // Создать новый элемент label
        label.htmlFor = 'hd-' + global.blockNum;

        // Формируем HTML с основным текстом и путем страницы
        let labelHTML = labelText;
        if (pagePath) {
            // Сокращаем путь если он слишком длинный
            let shortPath = pagePath.length > 30 ? '...' + pagePath.slice(-27) : pagePath;
            labelHTML += '<span class="page-path">' + shortPath + '</span>';
        }

        label.innerHTML = labelHTML;
        divBlock.appendChild(label);
        global.blockNum++;

        let divContent = document.createElement('div'); // Создать новый элемент div
        // Создание вложенного содержимого (для основного блока применяется фильтр)
        divContent.appendChild( createInnerContent(obj, false) );
        divBlock.appendChild(divContent); // Добавить содержимое в divBlock элемент

        fragment.appendChild(divBlock); // Поместить элемент div в фрагмент
    }

    // Создание разворачиваемого блока HTML для вложенных объектов (без фильтрации)
    function createHtmlBlockNested(obj, labelText, pagePath, fragment) {
        let divBlock = document.createElement('div'); // Создать новый элемент div
        divBlock.className = 'block';

        let inputHide = document.createElement('input'); // Создать новый элемент input
        inputHide.id = 'hd-' + global.blockNum;
        inputHide.className = 'hide';
        inputHide.type = 'checkbox';
        inputHide.addEventListener('change', scrollToContent); // Добавить слушатель события изменения состояния чекбокса
        divBlock.appendChild(inputHide);

        let label = document.createElement('label'); // Создать новый элемент label
        label.htmlFor = 'hd-' + global.blockNum;

        // Формируем HTML с основным текстом и путем страницы
        let labelHTML = labelText;
        if (pagePath) {
            // Сокращаем путь если он слишком длинный
            let shortPath = pagePath.length > 30 ? '...' + pagePath.slice(-27) : pagePath;
            labelHTML += '<span class="page-path">' + shortPath + '</span>';
        }

        label.innerHTML = labelHTML;
        divBlock.appendChild(label);
        global.blockNum++;

        let divContent = document.createElement('div'); // Создать новый элемент div
        // Создание вложенного содержимого (для вложенного блока НЕ применяется фильтр)
        divContent.appendChild( createInnerContent(obj, true) );
        divBlock.appendChild(divContent); // Добавить содержимое в divBlock элемент

        fragment.appendChild(divBlock); // Поместить элемент div в фрагмент
    }

    // Перебор всех свойств объекта, создание DocumentFragment
    function createInnerContent(obj, isNestedLevel = false) {
        let contentFragment = document.createDocumentFragment(); // Создать новый пустой фрагмент

        for (let key in obj) {
            if (
                key == 'name' ||
                key == 'projectId' ||
                key == '__proto__'
            ) continue; // Пропустить определенные свойства

            // Проверяем фильтр объектов только для первого уровня (не для вложенных)
            if (isObjectFilterActive && !isNestedLevel) {
                const keyLower = key.toLowerCase();
                if (!allowedObjectsSet.has(keyLower)) {
                    continue; // Пропускаем свойство, если оно не в списке разрешенных
                }
            }

            if ( typeof(obj[key]) !== 'object' ) {
                // Если текущее свойство не является объектом
                let span = document.createElement('span'); // Создать новый элемент span
                let value = obj[key];
                span.innerHTML = '<span class="key">' + key + ': ' + '</span>' + value; // Текст текущего пункта списка
                contentFragment.appendChild(span);
            } else {
                // Если текущее свойство является объектом
                let stringObj = objToStr(obj[key], true); // Для предварительного просмотра всегда показываем всё
                // Заголовок раскрываемого блока
                let labelText = '<span class="key">' + key + ': ' + '</span>' + '<span class="autohide">' + stringObj + '</span>';
                createHtmlBlockNested(obj[key], labelText, '', contentFragment);
            }
        }

        // Функция перевода объекта в строку (без кавычек)
        function objToStr(obj, isNestedLevel = false) {
            let content = '';
            let i = 0;
            for (let key in obj) {
                // Применяем фильтр только к первому уровню
                if (isObjectFilterActive && !isNestedLevel) {
                    const keyLower = key.toLowerCase();
                    if (!allowedObjectsSet.has(keyLower)) {
                        continue;
                    }
                }
                i++;
                content += `${key}: ${typeof(obj[key]) === 'object' ? objToStr(obj[key], true) : obj[key]}${i === Object.keys(obj).length ? '' : ', '}`;
            }
            return `{${content}}`;
        }

        return contentFragment;
    }

    // Прокрутка к содержимому раскрытого блока
    function scrollToContent() {
        let input = this; // Элемент input (скрытый чекбокс)

        if (input.checked) { // Если чекбокс активен (блок был раскрыт)
            let block = input.parentElement; // Блок, в котором хранится чекбокс, заголовок и содержимое
            let rect = block.getBoundingClientRect(); // Получить координаты границ раскрытого блока
            if (rect.bottom > window.innerHeight) { // Если блок находится ниже области просмотра
                let wrapp = document.querySelector('div.wrapp'); // Контейнер wrapp
                let wrappHeight = parseInt( getComputedStyle(wrapp).height ); // Высота контейнера wrapp

                // Если высота блока больше высоты окна
                if ( block.offsetHeight > wrappHeight ) {
                    block.scrollIntoView(); // Прокрутить к верхней границе содержимого
                } else {
                    block.scrollIntoView(false); // Прокрутить к нижней границе содержимого
                }
            }
        }
    }

    return fragment;
}