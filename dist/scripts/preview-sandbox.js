"use strict";
const previewFrame = document.querySelector("#previewFrame");
if (!previewFrame) {
    throw new Error("Preview frame is missing.");
}
window.addEventListener("message", (event) => {
    if (event.data?.type !== "render") {
        return;
    }
    previewFrame.srcdoc = event.data.html;
});
