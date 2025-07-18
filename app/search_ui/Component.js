sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
	"use strict";

	return UIComponent.extend("com.sap.searchui.Component", {

		metadata: {
			manifest: "json"
		},

		init: function () {

			UIComponent.prototype.init.apply(this, arguments);

			var oData = {
				recipient: {
					name: "World"
				}
			};
			var oModel = new JSONModel(oData);
			this.setModel(oModel);
		}
	});
});
