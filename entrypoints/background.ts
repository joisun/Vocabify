export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
  chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

  chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.create({ url: 'https://react.dev/learn/render-and-commit' });
  });
});
