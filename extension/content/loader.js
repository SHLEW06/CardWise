/* Content scripts can't be ES modules, so this classic script imports the
   real one (content/main.js) from the extension package. */
(async () => {
  try {
    const { start } = await import(chrome.runtime.getURL("content/main.js"));
    start();
  } catch (e) {
    console.warn("CardWise extension couldn't start on this page:", e);
  }
})();
