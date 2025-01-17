/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const kTimeoutInMS = 20000;

// Bug 934951 - Zoom controls percentage label doesn't update when it's in the toolbar and you navigate.
add_task(function*() {
  CustomizableUI.addWidgetToArea("zoom-controls", CustomizableUI.AREA_NAVBAR);
  let tab1 = gBrowser.addTab("about:mozilla");
  yield BrowserTestUtils.browserLoaded(tab1.linkedBrowser);
  let tab2 = gBrowser.addTab("about:robots");
  yield BrowserTestUtils.browserLoaded(tab2.linkedBrowser);
  gBrowser.selectedTab = tab1;
  let zoomResetButton = document.getElementById("zoom-reset-button");

  registerCleanupFunction(() => {
    info("Cleaning up.");
    CustomizableUI.reset();
    gBrowser.removeTab(tab2);
    gBrowser.removeTab(tab1);
  });

  is(parseInt(zoomResetButton.label, 10), 100, "Default zoom is 100% for about:mozilla");
  let zoomChangePromise = BrowserTestUtils.waitForEvent(window, "FullZoomChange");
  FullZoom.enlarge();
  yield zoomChangePromise;
  is(parseInt(zoomResetButton.label, 10), 110, "Zoom is changed to 110% for about:mozilla");

  let tabSelectPromise = promiseObserverNotification("browser-fullZoom:location-change");
  gBrowser.selectedTab = tab2;
  yield tabSelectPromise;
  yield new Promise(resolve => executeSoon(resolve));
  is(parseInt(zoomResetButton.label, 10), 100, "Default zoom is 100% for about:robots");

  gBrowser.selectedTab = tab1;
  let zoomResetPromise = BrowserTestUtils.waitForEvent(window, "FullZoomChange");
  FullZoom.reset();
  yield zoomResetPromise;
  is(parseInt(zoomResetButton.label, 10), 100, "Default zoom is 100% for about:mozilla");

  // Test zoom label updates while navigating pages in the same tab.
  FullZoom.enlarge();
  yield zoomChangePromise;
  is(parseInt(zoomResetButton.label, 10), 110, "Zoom is changed to 110% for about:mozilla");
  let attributeChangePromise = promiseAttributeMutation(zoomResetButton, "label", (v) => {
    return parseInt(v, 10) == 100;
  });
  yield promiseTabLoadEvent(tab1, "about:home");
  yield attributeChangePromise;
  is(parseInt(zoomResetButton.label, 10), 100, "Default zoom is 100% for about:home");
  yield promiseTabHistoryNavigation(-1, function() {
    return parseInt(zoomResetButton.label, 10) == 110;
  });
  is(parseInt(zoomResetButton.label, 10), 110, "Zoom is still 110% for about:mozilla");
  FullZoom.reset();
});

function promiseObserverNotification(aObserver) {
  let deferred = Promise.defer();
  function notificationCallback(e) {
    Services.obs.removeObserver(notificationCallback, aObserver);
    clearTimeout(timeoutId);
    deferred.resolve();
  }
  let timeoutId = setTimeout(() => {
    Services.obs.removeObserver(notificationCallback, aObserver);
    deferred.reject("Notification '" + aObserver + "' did not happen within 20 seconds.");
  }, kTimeoutInMS);
  Services.obs.addObserver(notificationCallback, aObserver);
  return deferred.promise;
}

function promiseTabSelect() {
  let deferred = Promise.defer();
  let container = window.gBrowser.tabContainer;
  let timeoutId = setTimeout(() => {
    container.removeEventListener("TabSelect", callback);
    deferred.reject("TabSelect did not happen within 20 seconds");
  }, kTimeoutInMS);
  function callback(e) {
    container.removeEventListener("TabSelect", callback);
    clearTimeout(timeoutId);
    executeSoon(deferred.resolve);
  }
  container.addEventListener("TabSelect", callback);
  return deferred.promise;
}
