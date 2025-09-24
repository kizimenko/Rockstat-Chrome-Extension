let connection;
let requestsAll = {}; // use let instead of const
const filterStr = 't4k.json';

// GitHub repository info for update checks
const GITHUB_REPO = 'kizimenko/Rockstat-Chrome-Extension';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

chrome.runtime.onInstalled.addListener(async () => {
    Object.keys(requestsAll).forEach(key => delete requestsAll[key]);
    await chrome.storage.local.set({'dataPersistence': false});

    // Check for updates on install
    await checkForUpdates();
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
  async (details) => {
    if (details.method === 'POST' && details.url.includes(filterStr)) {
      let arrayBuffer = details.requestBody.raw[0].bytes;
      let encodedURI = String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
      let postedString = decodeURIComponent(escape(encodedURI));
      let postedObj = JSON.parse(postedString);

      postedObj['url'] = details.url;
      // console.log(details);
      writeNewRequest(details.tabId, postedObj);

      // Устанавливаем cookie только на сайтах где есть t4k события
      try {
        const tab = await chrome.tabs.get(details.tabId);
        if (tab.url) {
          await setEmployeeCookieForDomain(tab.url);
        }
      } catch (error) {
        console.error('Ошибка установки cookie для t4k сайта:', error);
      }
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
    if (request.msg !== 'handshake' && request.msg !== 'refresh') return;

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

// Update checking functionality
async function checkForUpdates() {
  try {
    const response = await fetch(GITHUB_API_URL);
    if (!response.ok) return;

    const release = await response.json();
    const latestVersion = release.tag_name.replace('v', ''); // Remove 'v' prefix if present
    const currentVersion = chrome.runtime.getManifest().version;

    if (isNewerVersion(latestVersion, currentVersion)) {
      await chrome.storage.local.set({
        'updateAvailable': true,
        'latestVersion': latestVersion,
        'releaseUrl': release.html_url,
        'releaseNotes': release.body || ''
      });
    }
  } catch (error) {
    console.error('Ошибка проверки обновлений:', error);
  }
}

function isNewerVersion(latest, current) {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestPart = latestParts[i] || 0;
    const currentPart = currentParts[i] || 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  return false;
}

// Periodic update check (every 24 hours)
chrome.alarms.create('updateCheck', { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateCheck') {
    checkForUpdates();
  }
});
