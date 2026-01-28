# vCaptions Extension Mechanism Analysis

## Overview

This document analyzes the working principle of the "vCaptions" browser extension (version 2.2.6). The extension captures subtitles from video websites (YouTube, Bilibili) by intercepting network requests in the content script context.

## Core Mechanism: Monkey Patching

Instead of using the `webRequest` API (which has limitations in Manifest V3 regarding body access and requires higher permissions), vCaptions injects a script into the page context that overrides native browser APIs.

### 1. Intercepting XMLHttpRequest

The extension creates a `Proxy` around `window.XMLHttpRequest`.

```javascript
let OriginalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = new Proxy(OriginalXHR, {
  construct(target, args) {
    let xhr = new target(...args);

    // Intercept .open() to capture URL and Method
    let originalOpen = xhr.open;
    xhr.open = function (method, url, ...rest) {
      // Save request details
      this._requestInfo = { url: url.toString(), method: method.toUpperCase() };
      return originalOpen.apply(this, [method, url, ...rest]);
    };

    // Intercept .send()
    let originalSend = xhr.send;
    xhr.send = function (body) {
      // Check if URL matches subtitle pattern (e.g. "timedtext" for YouTube)
      if (isSubtitleRequest(this._requestInfo.url)) {
        // Add event listener to capture response
        xhr.addEventListener("readystatechange", () => {
          if (xhr.readyState === 4 && xhr.status === 200) {
            // Clone and extract data
            extractSubtitleData(xhr.responseText);
          }
        });
      }
      return originalSend.apply(this, [body]);
    };

    return xhr;
  },
});
```

### 2. Intercepting Fetch API

Similarly, `window.fetch` is proxied to intercept modern network requests.

```javascript
let originalFetch = window.fetch;
window.fetch = new Proxy(originalFetch, {
  apply: async function (target, thisArg, args) {
    let url = args[0];

    // Execute original fetch
    let response = await Reflect.apply(target, thisArg, args);

    if (isSubtitleRequest(url)) {
      // distinct clone() is required because response body can only be read once
      let clone = response.clone();
      let text = await clone.text();
      extractSubtitleData(text);
    }

    return response;
  },
});
```

## Communication

Captured data is sent from the injected script (Page Context/Content Script) to the Background Service Worker via `window.postMessage` or `chrome.runtime.sendMessage`, which then handles processing or storage.

## Relevance to Mediaflow

While Mediaflow uses `yt-dlp` (which accesses internal APIs directly) for downloading, understanding this client-side interception technique is useful for:

- Debugging encrypted streams.
- Extracting data when API methods fail.
- Building a browser-based companion extension in the future.
