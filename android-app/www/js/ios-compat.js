"use strict";

// WKWebView conserve parfois sa hauteur de page lorsque le clavier apparaît.
function setupIOSViewport() {
  const cap = window.Capacitor;
  if (!cap || typeof cap.getPlatform !== "function" || cap.getPlatform() !== "ios") return;
  const root = document.documentElement;
  root.classList.add("native-ios");
  const update = () => {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    root.style.setProperty("--ios-viewport-height", Math.round(height) + "px");
    // Keep WKWebView's document at its origin: only the message list scrolls.
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
  };
  update();
  // The native plugin resizes WKWebView and removes the form accessory bar.
  // Listen to keyboard events rather than focus (hardware keyboards also focus).
  const keyboardVisible = visible => {
    root.classList.toggle("ios-keyboard-open", visible);
    update();
  };
  window.addEventListener("keyboardWillShow", () => keyboardVisible(true));
  window.addEventListener("keyboardDidShow", () => keyboardVisible(true));
  window.addEventListener("keyboardWillHide", () => keyboardVisible(false));
  window.addEventListener("keyboardDidHide", () => keyboardVisible(false));
  cap.Plugins?.Keyboard?.setAccessoryBarVisible({ isVisible: false }).catch(console.warn);
  window.visualViewport?.addEventListener("resize", update);
  window.visualViewport?.addEventListener("scroll", update);
  document.addEventListener("focusin", () => { update(); setTimeout(update, 350); });
  document.addEventListener("focusout", () => setTimeout(update, 350));
  window.addEventListener("resize", update);
}

document.addEventListener("DOMContentLoaded", setupIOSViewport);
