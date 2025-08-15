sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./formatter"
], function (Controller, formatter) {
    "use strict";
    return Controller.extend("com.sap.searchui.controller.History", {
        
        formatter: formatter,

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("History").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function () {
            this.byId("historyTable").getBinding("items").refresh();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Upload", {}, true);
        },

        onRefresh: function () {
            this.byId("historyTable").getBinding("items").refresh();
        }
    });
});