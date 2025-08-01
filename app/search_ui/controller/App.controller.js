sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/unified/FileUploaderParameter", // <-- ADD THIS IMPORT
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Link",
    "sap/m/Text",
    "sap/m/VBox"
], function (Controller, FileUploaderParameter, MessageBox, Dialog, Button, Link, Text, VBox) { // <-- ADD IT HERE
    "use strict";

    return Controller.extend("com.sap.searchui.controller.App", {
        
        onNavToHistory: function() {
            this.getOwnerComponent().getRouter().navTo("History");
        },

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

            // The backend now needs the filename. We add it as a request header.
            oFileUploader.removeAllHeaderParameters();
            var sFileName = oFileUploader.getValue();
            
            // --- THIS IS THE CORRECTED LINE ---
            var oHeaderParameter = new FileUploaderParameter({
                name: "x-filename",
                value: sFileName
            });
            oFileUploader.addHeaderParameter(oHeaderParameter);

            oFileUploader.upload();
        },

        onUploadComplete: function(oEvent) {
            var oFileUploader = this.byId("fileUploader");
            var sResponse = oEvent.getParameter("responseRaw");
            var iStatus = oEvent.getParameter("status");

            oFileUploader.clear();
            this.byId("uploadButton").setEnabled(false);

            if (iStatus === 200 && sResponse) { 
                try {
                    const oData = JSON.parse(sResponse);
                    
                    const oSuccessDialog = new Dialog({
                        title: "Success",
                        type: "Message",
                        state: "Success",
                        content: new VBox({
                            items: [
                                new Text({ text: oData.message }),
                                new Link({
                                    text: "Click here to download your report",
                                    href: oData.downloadUrl,
                                    target: "_blank", 
                                    class: "sapUiSmallMarginTop"
                                })
                            ]
                        }),
                        beginButton: new Button({
                            text: "Close",
                            press: function () {
                                oSuccessDialog.close();
                            }
                        }),
                        afterClose: function() {
                            oSuccessDialog.destroy();
                        }
                    });

                    oSuccessDialog.open();

                } catch (e) {
                     MessageBox.error("An error occurred while parsing the server response.");
                }

            } else {
                MessageBox.error("File upload failed.\n\nStatus: " + iStatus + "\nResponse: " + sResponse);
            }
        }
    });
});