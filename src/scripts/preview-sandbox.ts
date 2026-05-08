interface SandboxMessage {
  type: "render";
  html: string;
}

const previewFrame = document.querySelector<HTMLIFrameElement>("#previewFrame");

if (!previewFrame) {
  throw new Error("Preview frame is missing.");
}

window.addEventListener("message", (event: MessageEvent<SandboxMessage>) => {
  if (event.data?.type !== "render") {
    return;
  }

  previewFrame.srcdoc = event.data.html;
});
