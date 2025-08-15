sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/unified/FileUploaderParameter",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Link",
    "sap/m/Text",
    "sap/m/VBox"
], function (Controller, FileUploaderParameter, MessageBox, Dialog, Button, Link, Text, VBox) {
    "use strict";

    return Controller.extend("com.sap.searchui.controller.Upload", {
        
        onNavToHistory: function() {
            this.getOwnerComponent().getRouter().navTo("History");
        },

        onFileChange: function(oEvent) {
            this.byId("uploadButton").setEnabled(true);
        },

        onUploadPress: function () {
            const oFileUploader = this.byId("fileUploader");
            const sFileName = oFileUploader.getValue();

            if (!sFileName) {
                MessageBox.error("Please choose a file first.");
                return;
            }

            // Set header parameter right before upload
            oFileUploader.removeAllHeaderParameters();
            const oHeaderParameter = new FileUploaderParameter({
                name: "x-filename",
                value: encodeURIComponent(sFileName)
            });
            oFileUploader.addHeaderParameter(oHeaderParameter);

            // Disable the button immediately to prevent double-clicks
            this.byId("uploadButton").setEnabled(false);
            
            // Start the upload
            oFileUploader.upload();
        },

        onUploadComplete: function(oEvent) {
            const oFileUploader = this.byId("fileUploader");
            const sResponse = oEvent.getParameter("responseRaw");
            const iStatus = oEvent.getParameter("status");

            // CRITICAL: Always clear the uploader and re-enable the button
            // This ensures the UI is reset after success or failure.
            oFileUploader.clear();
            this.byId("uploadButton").setEnabled(true);

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
                                    target: "_blank"
                                })
                            ]
                        }),
                        beginButton: new Button({
                            text: "Close",
                            press: () => {
                                oSuccessDialog.close();
                                this.getOwnerComponent().getRouter().navTo("History");
                            }
                        }),
                        afterClose: () => {
                            oSuccessDialog.destroy();
                        }
                    });
                    oSuccessDialog.open();
                } catch (e) {
                     MessageBox.error("An error occurred while parsing the server response.");
                }
            } else {
                // This now correctly handles any backend failure.
                MessageBox.error("File upload failed.\n\nStatus: " + iStatus + "\nResponse: " + sResponse);
            }
        }
    });
});