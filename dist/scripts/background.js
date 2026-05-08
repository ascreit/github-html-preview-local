"use strict";
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url?.startsWith("https://github.com/")) {
        return;
    }
    const [loadState] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => Boolean(window.__ghHtmlPreviewLocalLoaded)
    });
    if (!loadState?.result) {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["scripts/content.js"]
        });
        return;
    }
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.dispatchEvent(new CustomEvent("gh-html-preview-local:boot"))
    });
});
