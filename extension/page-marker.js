/* Lets the 購物紀錄 page know that this computer has 購物紀錄小幫手 (and which version). */
document.documentElement.dataset.ndShopHelper = chrome.runtime.getManifest().version;
