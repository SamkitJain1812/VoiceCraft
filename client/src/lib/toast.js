export function showToast(message, tone = "error") {
  window.dispatchEvent(new CustomEvent("voicecraft:toast", {
    detail: { message, tone },
  }));
}
