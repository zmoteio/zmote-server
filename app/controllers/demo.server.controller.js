'use strict';


exports.dummyMac = function(req, res) {
    return res.json({
        ap_mac: "demo_mac",
        st_mac: "demo_mac"
    });
};
exports.dummyWidget = function(req, res) {
    return res.json({
        status: "ok"
    });
};



