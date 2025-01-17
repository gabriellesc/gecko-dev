/**
 * Provides infrastructure for automated formautofill components tests.
 */

/* exported getTempFile, loadFormAutofillContent, runHeuristicsTest, sinon */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://testing-common/MockDocument.jsm");
Cu.import("resource://testing-common/TestUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "DownloadPaths",
                                  "resource://gre/modules/DownloadPaths.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
                                  "resource://gre/modules/FileUtils.jsm");

do_get_profile();

// Setup the environment for sinon.
Cu.import("resource://gre/modules/Timer.jsm");
let self = {}; // eslint-disable-line no-unused-vars
var sinon;
Services.scriptloader.loadSubScript("resource://testing-common/sinon-1.16.1.js");

// Load our bootstrap extension manifest so we can access our chrome/resource URIs.
const EXTENSION_ID = "formautofill@mozilla.org";
let extensionDir = Services.dirsvc.get("GreD", Ci.nsIFile);
extensionDir.append("browser");
extensionDir.append("features");
extensionDir.append(EXTENSION_ID);
// If the unpacked extension doesn't exist, use the packed version.
if (!extensionDir.exists()) {
  extensionDir = extensionDir.parent;
  extensionDir.append(EXTENSION_ID + ".xpi");
}
Components.manager.addBootstrappedManifestLocation(extensionDir);

// While the previous test file should have deleted all the temporary files it
// used, on Windows these might still be pending deletion on the physical file
// system.  Thus, start from a new base number every time, to make a collision
// with a file that is still pending deletion highly unlikely.
let gFileCounter = Math.floor(Math.random() * 1000000);

/**
 * Returns a reference to a temporary file, that is guaranteed not to exist, and
 * to have never been created before.
 *
 * @param {string} leafName
 *        Suggested leaf name for the file to be created.
 *
 * @returns {nsIFile} pointing to a non-existent file in a temporary directory.
 *
 * @note It is not enough to delete the file if it exists, or to delete the file
 *       after calling nsIFile.createUnique, because on Windows the delete
 *       operation in the file system may still be pending, preventing a new
 *       file with the same name to be created.
 */
function getTempFile(leafName) {
  // Prepend a serial number to the extension in the suggested leaf name.
  let [base, ext] = DownloadPaths.splitBaseNameAndExtension(leafName);
  let finalLeafName = base + "-" + gFileCounter + ext;
  gFileCounter++;

  // Get a file reference under the temporary directory for this test file.
  let file = FileUtils.getFile("TmpD", [finalLeafName]);
  do_check_false(file.exists());

  do_register_cleanup(function() {
    if (file.exists()) {
      file.remove(false);
    }
  });

  return file;
}

function runHeuristicsTest(patterns, fixturePathPrefix) {
  Cu.import("resource://gre/modules/FormLikeFactory.jsm");
  Cu.import("resource://formautofill/FormAutofillHeuristics.jsm");

  // TODO: "select" and "textarea" will be included eventually.
  const QUERY_STRING = ["input"];
  patterns.forEach(testPattern => {
    add_task(function* () {
      do_print("Starting test fixture: " + testPattern.fixturePath);
      let file = do_get_file(fixturePathPrefix + testPattern.fixturePath);
      let doc = MockDocument.createTestDocumentFromFile("http://localhost:8080/test/", file);

      let forms = [];

      for (let query of QUERY_STRING) {
        for (let field of doc.querySelectorAll(query)) {
          let formLike = FormLikeFactory.createFromField(field);
          if (!forms.some(form => form.rootElement === formLike.rootElement)) {
            forms.push(formLike);
          }
        }
      }

      Assert.equal(forms.length, testPattern.expectedResult.length, "Expected form count.");

      forms.forEach((form, formIndex) => {
        let formInfo = FormAutofillHeuristics.getFormInfo(form);
        // TODO: This line should be uncommented to make sure every field are verified.
        // Assert.equal(formInfo.length, testPattern.expectedResult[formIndex].length, "Expected field count.");
        formInfo.forEach((field, fieldIndex) => {
          let expectedField = testPattern.expectedResult[formIndex][fieldIndex];
          expectedField.elementWeakRef = field.elementWeakRef;
          Assert.deepEqual(field, expectedField);
        });
      });
    });
  });
}

add_task(function* head_initialize() {
  Services.prefs.setBoolPref("browser.formautofill.experimental", true);
  Services.prefs.setBoolPref("dom.forms.autocomplete.experimental", true);

  // Clean up after every test.
  do_register_cleanup(function head_cleanup() {
    Services.prefs.clearUserPref("browser.formautofill.experimental");
    Services.prefs.clearUserPref("dom.forms.autocomplete.experimental");
  });
});
