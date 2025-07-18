sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function (Controller, MessageBox) {
    "use strict";

    return Controller.extend("com.sap.searchui.controller.App", {
        onFileChange: function(oEvent) {
            var oFileUploader = this.byId("fileUploader");
            var oButton = this.byId("uploadButton");

            if (oFileUploader.getValue()) {
                oButton.setEnabled(true);
            } else {
                oButton.setEnabled(false);
            }
        },

        onUploadPress: function () {
            var oFileUploader = this.byId("fileUploader");
            if (!oFileUploader.getValue()) {
                MessageBox.error("Please choose a file first.");
                return;
            }

            oFileUploader.upload();
        },

        onUploadComplete: function(oEvent) {
            var oFileUploader = this.byId("fileUploader");
            var sResponse = oEvent.getParameter("responseRaw");
            var iStatus = oEvent.getParameter("status");

            oFileUploader.clear();
            this.byId("uploadButton").setEnabled(false);

            if (iStatus === 202) {
                MessageBox.success("File successfully submitted for processing. Response: " + sResponse);
            } else {
                MessageBox.error("File upload failed.\n\nStatus: " + iStatus + "\nResponse: " + sResponse);
            }
        }
    });
});
