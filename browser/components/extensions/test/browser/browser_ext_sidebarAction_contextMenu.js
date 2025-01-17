/* -*- Mode: indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sts=2 sw=2 et tw=80: */
"use strict";

let extData = {
  manifest: {
    "permissions": ["contextMenus"],
    "sidebar_action": {
      "default_panel": "sidebar.html",
    },
  },
  useAddonManager: "temporary",

  files: {
    "sidebar.html": `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"/>
      <script src="sidebar.js"></script>
      </head>
      <body>
      <span id="text">A Test Sidebar</span>
      <img id="testimg" src="data:image/svg+xml,<svg></svg>" height="10" width="10">
      </body></html>
    `,

    "sidebar.js": function() {
      window.onload = () => {
        browser.test.sendMessage("sidebar");
      };
    },
  },

  background: function() {
    browser.contextMenus.create({
      id: "clickme-page",
      title: "Click me!",
      contexts: ["all"],
    });
  },
};

let contextMenuItems = {
  "context-navigation": "hidden",
  "context-sep-navigation": "hidden",
  "context-viewsource": "",
  "context-viewinfo": "",
  "inspect-separator": "hidden",
  "context-inspect": "hidden",
  "context-bookmarkpage": "hidden",
  "context-sharepage": "hidden",
};

add_task(function* sidebar_contextmenu() {
  let extension = ExtensionTestUtils.loadExtension(extData);
  yield extension.startup();
  // Test sidebar is opened on install
  yield extension.awaitMessage("sidebar");

  let contentAreaContextMenu = yield openContextMenuInSidebar();
  let item = contentAreaContextMenu.getElementsByAttribute("label", "Click me!");
  is(item.length, 1, "contextMenu item for page was found");
  yield closeContextMenu(contentAreaContextMenu);

  yield extension.unload();
});


add_task(function* sidebar_contextmenu_hidden_items() {
  let extension = ExtensionTestUtils.loadExtension(extData);
  yield extension.startup();
  // Test sidebar is opened on install
  yield extension.awaitMessage("sidebar");

  let contentAreaContextMenu = yield openContextMenuInSidebar("#text");

  let item, state;
  for (const itemID in contextMenuItems) {
    item = contentAreaContextMenu.querySelector(`#${itemID}`);
    state = contextMenuItems[itemID];

    if (state !== "") {
      ok(item[state], `${itemID} is ${state}`);

      if (state !== "hidden") {
        ok(!item.hidden, `Disabled ${itemID} is not hidden`);
      }
    } else {
      ok(!item.hidden, `${itemID} is not hidden`);
      ok(!item.disabled, `${itemID} is not disabled`);
    }
  }

  yield closeContextMenu(contentAreaContextMenu);

  yield extension.unload();
});

add_task(function* sidebar_image_contextmenu() {
  let extension = ExtensionTestUtils.loadExtension(extData);
  yield extension.startup();
  // Test sidebar is opened on install
  yield extension.awaitMessage("sidebar");

  let contentAreaContextMenu = yield openContextMenuInSidebar("#testimg");

  let item = contentAreaContextMenu.querySelector("#context-viewimageinfo");
  ok(!item.hidden);
  ok(!item.disabled);

  yield closeContextMenu(contentAreaContextMenu);

  yield extension.unload();
});

add_task(function* cleanup() {
  // This is set on initial sidebar install.
  Services.prefs.clearUserPref("extensions.sidebar-button.shown");
});
