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
  };
  update();
  window.visualViewport?.addEventListener("resize", update);
  window.addEventListener("resize", update);
}

document.addEventListener("DOMContentLoaded", setupIOSViewport);
