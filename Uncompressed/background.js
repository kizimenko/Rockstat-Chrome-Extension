let connection;
let requestsAll = {}; // use let instead of const
const filterStr = 't4k.json';

chrome.runtime.onInstalled.addListener(async () => {
    Object.keys(requestsAll).forEach(key => delete requestsAll[key]);
    await chrome.storage.local.set({'dataPersistence': false});

    // Устанавливаем cookie на все открытые вкладки при установке расширения
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                await setEmployeeCookieForDomain(tab.url);
            }
        }
    } catch (error) {
        console.error('Ошибка установки cookie при инициализации:', error);
    }
});

// Функция установки cookie сотрудника на текущий домен
async function setEmployeeCookieForDomain(url) {
    try {
        const domain = new URL(url).origin;
        const cookieData = {
            url: domain,
            name: 'rstextempl',
            value: JSON.stringify({
                installed: true,
                timestamp: Date.now(),
                version: chrome.runtime.getManifest().version
            }),
            expirationDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 год
        };

        await chrome.cookies.set(cookieData);
        console.log(`Cookie установлен для домена: ${domain}`);
    } catch (error) {
        console.error(`Ошибка установки cookie:`, error);
    }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === 'POST' && details.url.includes(filterStr)) {
      let arrayBuffer = details.requestBody.raw[0].bytes;
      let encodedURI = String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
      let postedString = decodeURIComponent(escape(encodedURI));
      let postedObj = JSON.parse(postedString);

      postedObj['url'] = details.url;
      // console.log(details);
      writeNewRequest(details.tabId, postedObj);
    }
  },
  {urls: ['<all_urls>']},
  ['requestBody']
);

chrome.tabs.onUpdated.addListener(async function(id, info, tab) {
  if (info.status === 'loading' && requestsAll.hasOwnProperty(id)) {
    let { dataPersistence } = await chrome.storage.local.get('dataPersistence');
    if (!dataPersistence) {
      delete requestsAll[id];
    }
  }

  // Устанавливаем cookie при навигации на новый домен
  if (info.status === 'complete' && tab.url) {
    await setEmployeeCookieForDomain(tab.url);
  }
});

chrome.tabs.onRemoved.addListener(function(id) {
  if (requestsAll.hasOwnProperty(id)) {
    delete requestsAll[id];
  }
});

chrome.action.onClicked.addListener(async function() {
  let popupUrl = chrome.runtime.getURL('popup.html');
  let tab = await chrome.tabs.create({url: popupUrl});
});

chrome.runtime.onConnect.addListener(function(port) {
  connection = port;
  connection.onDisconnect.addListener(() => { connection = undefined; });

  port.onMessage.addListener(function(request) {
    if (request.msg !== 'handshake') return;

    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      if (!tabs[0]) return;
      let id = tabs[0].id;
      let data = requestsAll[id] || [];
      port.postMessage({msg: 'requests', data: data});
    });
  });
});

function writeNewRequest(tabId, bodyObj) {
  if (requestsAll.hasOwnProperty(tabId)) {
    let requestsTab = requestsAll[tabId];
    requestsTab[requestsTab.length] = bodyObj;
  } else {
    requestsAll[tabId] = [bodyObj];
  }

  let reqCount = requestsAll[tabId].length;

  chrome.action.setBadgeText({tabId: tabId, text: reqCount.toString()});
  chrome.action.setBadgeBackgroundColor({color: '#0000FF', tabId: tabId});

  if(connection) {
    connection.postMessage({msg: 'requests', data: [bodyObj]});
  }
}
