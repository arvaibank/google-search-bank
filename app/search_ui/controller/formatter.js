sap.ui.define([], function () {
    "use strict";

    return {
        isReportVisible: function (sReportUrl) {
            return !!sReportUrl;
        },

        /**
         * @param {string}
         * @returns {string}
         */
        formatDateTime: function(sTimestamp) {
            if (!sTimestamp) {
                return "";
            }

            const oDate = new Date(sTimestamp);

            if (isNaN(oDate.getTime())) {
                return "";
            }
            return oDate.toLocaleString();
        }
    };
});