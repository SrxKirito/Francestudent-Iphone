"use strict";

function bindEvents() {
  $("login-form").addEventListener("submit", login);
  $("cookie-form").addEventListener("submit", cookieLogin);
  $("logout").addEventListener("click", logout);
  $("new-chat").addEventListener("click", newConversation);
  $("menu-toggle").addEventListener("click", () => {
    if (window.innerWidth > 768) $("app").classList.remove("sidebar-collapsed");
    else openSidebar();
  });
  $("sidebar-collapse").addEventListener("click", () => {
    closeMenus();
    if (window.innerWidth > 768) $("app").classList.add("sidebar-collapsed");
    else closeSidebar();
  });
  $("overlay").addEventListener("click", () => {
    closeMenus();
    closeSidebar();
  });

  $("search-input").addEventListener("input", event => {
    historyQuery = event.target.value;
    closeMenus();
    renderHistory();
  });
  $("search-input").addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.target.value = "";
      historyQuery = "";
      renderHistory();
    }
  });
  $("history").addEventListener("scroll", () => {
    if (menuConversationId !== null) closeMenus();
  });

  $("conv-menu").addEventListener("click", event => event.stopPropagation());
  $("conv-rename").addEventListener("click", () => {
    const id = menuConversationId;
    closeMenus();
    if (id) renameConversation(id);
  });
  $("conv-pin").addEventListener("click", () => {
    const id = menuConversationId;
    closeMenus();
    if (id) togglePin(id);
  });
  $("conv-delete").addEventListener("click", () => {
    const id = menuConversationId;
    closeMenus();
    if (id) deleteConversation(id);
  });

  $("user-button").addEventListener("click", toggleSettingsMenu);
  setupSettings();
  $("settings-menu").addEventListener("click", event => {
    event.stopPropagation();
    if (!event.target.closest(".default-model-field")) closeDefaultModelMenu();
    if (!event.target.closest(".reasoning-field")) closeReasoningMenu();
    if (!event.target.closest("#settings-image-models") && !event.target.closest("#settings-image-model-button")) closeSettingsImageModelMenu();
  });
  $("default-model-button").addEventListener("click", toggleDefaultModelMenu);
  $("default-model-menu").addEventListener("click", event => {
    event.stopPropagation();
    const option = event.target.closest(".model-option");
    if (!option || option.getAttribute("aria-disabled") === "true") return;
    setDefaultModel(option.dataset.id || "");
    closeDefaultModelMenu();
    renderDefaultModelSelect();
    $("default-model-button").focus();
  });
  $("default-model-menu").addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeDefaultModelMenu();
      $("default-model-button").focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = [...$("default-model-menu").querySelectorAll(".model-option:not([aria-disabled=\"true\"])")];
    if (!options.length) return;
    const index = options.indexOf(document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(index + step + options.length) % options.length].focus();
  });
  $("quota-refresh").addEventListener("click", () => loadQuota());
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.addEventListener("click", () => {
      store.theme = button.dataset.themeChoice;
      saveStore();
      applyTheme();
    });
  }
  document.addEventListener("click", closeMenus);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenus();
  });
  window.addEventListener("resize", closeMenus);
  applyTheme();
  renderProfile();
  $("messages").addEventListener("click", handleMessageClick);

  $("model-select").addEventListener("change", event => selectModel(Number(event.target.value)));
  $("model-button").addEventListener("click", toggleModelMenu);
  $("model-menu").addEventListener("click", event => {
    event.stopPropagation();
    const option = event.target.closest(".model-option");
    if (!option || option.getAttribute("aria-disabled") === "true") return;
    selectModel(Number(option.dataset.id));
    $("model-button").focus();
  });
  $("model-menu").addEventListener("keydown", event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = [...$("model-menu").querySelectorAll(".model-option")];
    if (!options.length) return;
    const index = options.indexOf(document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(index + step + options.length) % options.length].focus();
  });

  $("composer").addEventListener("submit", event => {
    event.preventDefault();
    sendMessage();
  });

  $("attach").addEventListener("click", event => {
    event.stopPropagation();
    const menu = $("attach-menu");
    const opening = menu.classList.contains("hidden");
    closeMenus();
    if (!opening) return;
    menu.classList.remove("hidden");
    $("attach").setAttribute("aria-expanded", "true");
  });
  $("attach-menu").addEventListener("click", event => {
    event.stopPropagation();
    const option = event.target.closest(".attach-option");
    if (!option) return;
    closeMenus();
    $(option.dataset.target).click();
  });
  for (const inputId of ["photo-input", "file-input", "camera-input"]) {
    $(inputId).addEventListener("change", async event => {
      const input = event.target;
      await addFiles(input.files);
      input.value = "";
    });
  }
  $("attachments").addEventListener("click", event => {
    const button = event.target.closest(".attachment-remove");
    if (button) removeAttachment(button.dataset.id);
  });
  const mic = $("mic");
  if (!speechRecognitionClass() && !nativeSpeechPlugin()) mic.classList.add("unsupported");
  mic.addEventListener("click", toggleDictation);

  renderToggles();
  $("toggle-web").addEventListener("click", () => {
    store.webSearch = !store.webSearch;
    saveStore();
    renderToggles();
  });
  $("toggle-image").addEventListener("click", () => {
    store.imageMode = !store.imageMode;
    saveStore();
    renderToggles();
  });
  const studyButton = $("toggle-study");
  if (studyButton) studyButton.addEventListener("click", cycleStudyMode);
  setupImageModelMenu();
  renderImageModel();
  if (typeof setupDropZone === "function") setupDropZone();

  const prompt = $("prompt");
  prompt.addEventListener("input", () => {
    resizePrompt();
    updateSendButton();
  });
  prompt.addEventListener("paste", event => {
    const items = event.clipboardData ? Array.from(event.clipboardData.files || []) : [];
    const pastedImages = items.filter(file => String(file.type || "").startsWith("image/"));
    if (pastedImages.length) {
      event.preventDefault();
      addFiles(pastedImages);
    }
  });
  prompt.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!busy) sendMessage();
    }
  });
}

async function startApp() {
  saveStore();
  bindEvents();
  if (!store.session) {
    showLogin("");
    return;
  }
  try {
    await getAccessToken(true);
    await showApp();
  } catch (error) {
    if (error.auth) showLogin(error.message);
    else await showApp();
  }
}

async function init() {
  try {
    await startApp();
  } finally {
    const screen = $("startup-screen");
    if (screen) screen.remove();
  }
}

document.addEventListener("DOMContentLoaded", init);
