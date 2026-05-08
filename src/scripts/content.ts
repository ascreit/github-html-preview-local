interface CapturePayload {
  source: string;
  pageUrl: string;
  rawFileUrl: string | null;
}

(() => {
const LOADED_FLAG = "__ghHtmlPreviewLocalLoaded";
const REBOOT_EVENT = "gh-html-preview-local:boot";
const ROOT_ID = "gh-html-preview-local-root";
const BUTTON_ID = "gh-html-preview-local-button";
const FLOATING_BUTTON_ID = "gh-html-preview-local-floating-button";
const STYLE_ID = "gh-html-preview-local-style";

const pageWindow = window as Window & {
  [LOADED_FLAG]?: boolean;
};

if (pageWindow[LOADED_FLAG]) {
  window.dispatchEvent(new CustomEvent(REBOOT_EVENT));
  return;
}

pageWindow[LOADED_FLAG] = true;

let previewFrame: HTMLIFrameElement | null = null;
let codeSurface: HTMLElement | null = null;
let previewVisible = false;

function message(name: string): string {
  return chrome.i18n.getMessage(name) || name;
}

function normalizeLine(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\r\n?/g, "\n");
}

function isHtmlBlobPage(): boolean {
  return (
    window.location.hostname === "github.com" &&
    /\/[^/]+\/[^/]+\/blob\/.+\.html?$/i.test(window.location.pathname)
  );
}

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width >= 0 && rect.height >= 0;
}

function collectFromSelector(selector: string): string {
  const nodes = Array.from(document.querySelectorAll(selector)).filter(isVisible);
  const lines = nodes
    .map((node) => normalizeLine(node.textContent || ""))
    .filter((line, index, list) => index < list.length - 1 || line.length > 0);

  return lines.length ? lines.join("\n") : "";
}

function collectFromLineIds(): string {
  const lineNodes = Array.from(document.querySelectorAll<HTMLElement>("[id^='LC']"))
    .filter((node) => /^LC\d+$/.test(node.id))
    .filter(isVisible)
    .sort((left, right) => Number(left.id.slice(2)) - Number(right.id.slice(2)));

  const lines = lineNodes.map((node) => normalizeLine(node.textContent || ""));
  return lines.length ? lines.join("\n") : "";
}

function getVisibleSource(): string {
  const selectorCandidates = [
    "[data-line-number] .react-code-text",
    ".react-code-text",
    ".react-file-line",
    "td.blob-code-inner",
    ".blob-code-content",
    ".js-file-line",
    "[data-testid='code-cell']",
    "[data-code-cell]",
    "table.highlight tr td:last-child",
    "table.js-file-line-container tr td:last-child"
  ];

  let source = collectFromLineIds();
  for (const selector of selectorCandidates) {
    if (source.trim()) {
      break;
    }

    source = collectFromSelector(selector);
  }

  if (!source.trim()) {
    const codeBlock = document.querySelector("pre, code");
    source = codeBlock ? normalizeLine(codeBlock.textContent || "") : "";
  }

  return source;
}

function getRawFileUrl(): string | null {
  return (
    Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((link) => link.href)
      .find((href) => {
        try {
          const url = new URL(href);
          return url.hostname === "github.com" && url.pathname.includes("/raw/");
        } catch {
          return false;
        }
      }) || null
  );
}

function getCapturePayload(): CapturePayload | null {
  const source = getVisibleSource();
  if (!source.trim()) {
    return null;
  }

  return {
    source,
    pageUrl: window.location.href,
    rawFileUrl: getRawFileUrl()
  };
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getPreviewChromeStyle(): string {
  return [
    "<style>",
    "html{background:#fff;}",
    "body{min-height:100vh;box-sizing:border-box;padding-block-start:32px;}",
    "body>*:first-child{margin-top:0;}",
    "</style>"
  ].join("");
}

function getDirectoryUrl(fileUrl: string): string {
  const url = new URL(fileUrl);
  url.pathname = url.pathname.replace(/\/[^/]*$/, "/");
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getRawAssetBaseUrl(pageUrl: string, rawFileUrl: string | null): string | null {
  if (rawFileUrl) {
    return getDirectoryUrl(rawFileUrl);
  }

  const url = new URL(pageUrl);
  if (url.hostname !== "github.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const blobIndex = parts.indexOf("blob");
  if (blobIndex !== 2 || parts.length < 5) {
    return null;
  }

  const owner = parts[0];
  const repo = parts[1];
  const ref = parts[3];
  const directoryParts = parts.slice(4, -1);

  if (!owner || !repo || !ref) {
    return null;
  }

  const rawPath = [owner, repo, "raw", ref, ...directoryParts]
    .map(encodeURIComponent)
    .join("/");

  return `https://github.com/${rawPath}/`;
}

function withAssetBase(payload: CapturePayload): string {
  const baseUrl = getRawAssetBaseUrl(payload.pageUrl, payload.rawFileUrl);
  const previewStyle = getPreviewChromeStyle();
  const baseElement = baseUrl && !/<base(?:\s|>)/i.test(payload.source)
    ? `<base href="${escapeAttribute(baseUrl)}">`
    : "";
  const headAdditions = [baseElement, previewStyle].filter(Boolean).join("\n");

  if (/<head(?:\s[^>]*)?>/i.test(payload.source)) {
    return payload.source.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${headAdditions}`);
  }

  return `${headAdditions}\n${payload.source}`;
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${FLOATING_BUTTON_ID}[aria-pressed="true"] {
      background: var(--bgColor-accent-muted, #ddf4ff);
      border-color: var(--borderColor-accent-emphasis, #0969da);
      color: var(--fgColor-accent, #0969da);
      font-weight: 600;
    }

    #${FLOATING_BUTTON_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 10000;
      box-shadow: var(--shadow-floating-large, 0 8px 24px rgba(31, 35, 40, 0.16));
    }

    #${ROOT_ID} {
      min-height: 520px;
      background: #fff;
    }

    #${ROOT_ID} iframe {
      display: block;
      width: 100%;
      min-height: 720px;
      border: 0;
      background: #fff;
    }
  `;
  document.documentElement.append(style);
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function findControlByText(scope: ParentNode, label: string): HTMLElement | null {
  const controls = Array.from(scope.querySelectorAll<HTMLElement>("button, a, [role='button']"));
  const directMatch = controls.find((element) => normalizeText(element.textContent) === label);
  if (directMatch) {
    return directMatch;
  }

  const labelElement = Array.from(scope.querySelectorAll<HTMLElement>("span, div, strong"))
    .find((element) => normalizeText(element.textContent) === label);

  return labelElement?.closest<HTMLElement>("button, a, [role='button']") ?? null;
}

function findFileToolbar(): HTMLElement | null {
  const firstLine = document.querySelector<HTMLElement>("#LC1");
  let current: HTMLElement | null = firstLine;

  while (current?.parentElement && current.parentElement !== document.body) {
    const previous = current.previousElementSibling;
    const parentPrevious = current.parentElement.previousElementSibling;

    if (looksLikeFileToolbar(previous)) {
      return previous as HTMLElement;
    }

    if (looksLikeFileToolbar(parentPrevious)) {
      return parentPrevious as HTMLElement;
    }

    current = current.parentElement;
  }

  return null;
}

function findCodeButton(scope: ParentNode = document): HTMLElement | null {
  const codeButton = findControlByText(scope, "Code");

  if (scope === document) {
    return codeButton ?? null;
  }

  return codeButton;
}

function findInsertionTarget(): {
  container: HTMLElement;
  codeButton: HTMLElement | null;
} | null {
  const fileToolbar = findFileToolbar();
  const rawButton = findControlByText(fileToolbar ?? document, "Raw");
  if (rawButton?.parentElement) {
    return {
      container: rawButton.parentElement,
      codeButton: null
    };
  }

  const codeSurface = findCodeSurface();
  const filePanel = codeSurface?.closest<HTMLElement>(".Box, [class*='Box'], div");
  if (filePanel?.parentElement) {
    return {
      container: filePanel.parentElement,
      codeButton: null
    };
  }

  return null;
}

function findCodeSurface(): HTMLElement | null {
  const firstLine = document.querySelector<HTMLElement>("#LC1");
  const codeBody = firstLine ? findFileBodyFromLine(firstLine) : null;
  if (codeBody) {
    return codeBody;
  }

  return (
    document.querySelector<HTMLElement>(".react-code-lines") ||
    document.querySelector<HTMLElement>(".js-file-line-container") ||
    document.querySelector<HTMLElement>("[data-testid='code-cell']")?.parentElement ||
    null
  );
}

function looksLikeFileToolbar(element: Element | null): boolean {
  if (!element) {
    return false;
  }

  const labels = Array.from(element.querySelectorAll("button, a"))
    .map((node) => normalizeText(node.textContent))
    .filter(Boolean);

  return labels.includes("Code") && (labels.includes("Blame") || labels.includes("Raw"));
}

function findFileBodyFromLine(line: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = line;

  while (current?.parentElement && current.parentElement !== document.body) {
    const previous = current.previousElementSibling;
    const parentPrevious = current.parentElement.previousElementSibling;

    if (looksLikeFileToolbar(previous) || looksLikeFileToolbar(parentPrevious)) {
      return current;
    }

    current = current.parentElement;
  }

  return line.closest<HTMLElement>("table, .js-file-line-container, .react-code-lines");
}

function createPreviewFrame(payload: CapturePayload): HTMLIFrameElement {
  const wrapper = document.createElement("div");
  wrapper.id = ROOT_ID;

  const iframe = document.createElement("iframe");
  iframe.title = "Local HTML preview";
  iframe.src = chrome.runtime.getURL("preview-sandbox.html");
  iframe.addEventListener("load", () => {
    iframe.contentWindow?.postMessage(
      {
        type: "render",
        html: withAssetBase(payload)
      },
      "*"
    );
  });
  wrapper.append(iframe);

  codeSurface?.after(wrapper);
  return iframe;
}

function setPreviewButtonState(button: HTMLButtonElement): void {
  button.setAttribute("aria-pressed", String(previewVisible));
  button.textContent = previewVisible ? message("codeButton") : message("previewButton");
}

function showPreview(button: HTMLButtonElement): void {
  const payload = getCapturePayload();
  if (!payload) {
    button.textContent = message("previewUnavailable");
    window.setTimeout(() => setPreviewButtonState(button), 1500);
    return;
  }

  codeSurface = findCodeSurface();
  if (!codeSurface) {
    button.textContent = message("previewUnavailable");
    window.setTimeout(() => setPreviewButtonState(button), 1500);
    return;
  }

  previewFrame?.parentElement?.remove();
  previewFrame = createPreviewFrame(payload);
  codeSurface.hidden = true;
  codeSurface.setAttribute("data-gh-html-preview-hidden", "true");
  previewVisible = true;
  setPreviewButtonState(button);
}

function showCode(button: HTMLButtonElement): void {
  previewFrame?.parentElement?.remove();
  previewFrame = null;
  if (codeSurface) {
    codeSurface.hidden = false;
    codeSurface.removeAttribute("data-gh-html-preview-hidden");
  }
  previewVisible = false;
  setPreviewButtonState(button);
}

function injectPreviewButton(): void {
  if (!isHtmlBlobPage()) {
    return;
  }

  injectStyle();

  if (document.getElementById(BUTTON_ID)) {
    document.getElementById(FLOATING_BUTTON_ID)?.remove();
    return;
  }

  const target = findInsertionTarget();
  if (!target) {
    injectFloatingButton();
    return;
  }

  document.getElementById(FLOATING_BUTTON_ID)?.remove();

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.className = "btn";
  button.textContent = message("previewButton");
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    if (previewVisible) {
      showCode(button);
    } else {
      showPreview(button);
    }
    button.blur();
  });

  target.codeButton?.addEventListener("click", () => {
    showCode(button);
  });

  if (target.codeButton?.nextSibling) {
    target.container.insertBefore(button, target.codeButton.nextSibling);
  } else {
    target.container.insertBefore(button, target.container.firstChild);
  }

  document.getElementById(FLOATING_BUTTON_ID)?.remove();
}

function injectFloatingButton(): void {
  if (document.getElementById(FLOATING_BUTTON_ID)) {
    return;
  }

  const button = document.createElement("button");
  button.id = FLOATING_BUTTON_ID;
  button.type = "button";
  button.className = "btn";
  button.textContent = message("previewButton");
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    if (previewVisible) {
      showCode(button);
    } else {
      showPreview(button);
    }
  });

  document.body.append(button);
}

function resetPreviewState(): void {
  previewFrame?.parentElement?.remove();
  previewFrame = null;
  codeSurface = null;
  previewVisible = false;
}

let lastPath = window.location.pathname;

function boot(): void {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    resetPreviewState();
  }

  injectPreviewButton();
}

boot();

window.addEventListener(REBOOT_EVENT, boot);

const observer = new MutationObserver(() => {
  window.requestAnimationFrame(boot);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
})();
