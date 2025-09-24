# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension for tracking Rockstat analytics requests. The extension monitors HTTP POST requests to `t4k.json` endpoints and displays them in a visual interface without opening Chrome's developer console.

## Architecture

### Core Components

- **manifest.json** (Uncompressed/): Chrome extension manifest defining permissions, service worker, and extension metadata
- **background.js** (Uncompressed/): Service worker that intercepts web requests and manages data storage per tab
- **popup.html/popup.js/popup.css** (Uncompressed/): Extension popup interface for displaying tracked requests
- **popup-modules/objToDoc.js**: Module for converting request objects to collapsible HTML blocks

### Key Functionality

1. **Request Interception**: Background service worker listens for POST requests containing 't4k.json' in the URL
2. **Data Processing**: Extracts and parses request body data, associates it with tab IDs
3. **UI Display**: Popup interface shows requests as expandable blocks with filtering capabilities
4. **Data Persistence**: Optional setting to persist data across tab reloads

### Data Flow

1. User visits a website with Rockstat analytics
2. Background script intercepts POST requests to analytics endpoints
3. Request data is stored in memory indexed by tab ID
4. Popup connects to background script via chrome.runtime messaging
5. Request data is transformed into HTML blocks and displayed with filtering

### Storage Management

- **requestsAll**: Object storing all intercepted requests indexed by tab ID
- **chrome.storage.local**: Persistent storage for user settings (data persistence toggle)
- Automatic cleanup when tabs are closed or reloaded (unless persistence is enabled)

## Development Commands

This is a browser extension project with no build system. Development is done directly on the source files in the `Uncompressed/` directory.

### Installation for Development

1. Clone the repository
2. Open Chrome and navigate to chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `Uncompressed/` folder

### File Structure

```
Uncompressed/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── popup.html             # Popup interface
├── popup.js              # Popup logic
├── popup.css             # Popup styling
├── popup-modules/
│   └── objToDoc.js       # HTML generation module
└── images/
    └── icon128.png       # Extension icon
```

## Key Technical Details

- **Manifest Version**: 3 (latest Chrome extension format)
- **Permissions**: webRequest, storage, tabs, and host_permissions for all URLs
- **Language**: Vanilla JavaScript with ES6 modules
- **Communication**: Chrome extension messaging API between background and popup
- **UI Framework**: None (vanilla DOM manipulation)

## Extension Permissions

- `webRequest`: Required to intercept HTTP requests
- `storage`: For persisting user preferences
- `tabs`: For tab management and URL access
- `<all_urls>`: Necessary to monitor requests across all websites