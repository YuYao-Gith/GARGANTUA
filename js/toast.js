// ============================================================
//  toast.js — 右下角提示
// ============================================================

let toastTimer = null;
let toastEl = null;

export function showToast(text, duration = 2.5) {
    if (!toastEl) toastEl = document.getElementById('toast');
    toastEl.textContent = text;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.remove('visible');
    }, duration * 1000);
}
