'use strict';

/**
 * Module dependencies.
 */
var widgets = require('../../app/controllers/widgets.server.controller');
var clients = require('../../app/controllers/clients.server.controller');
var demo = require('../../app/controllers/demo.server.controller');

module.exports = function(app) {
	app.route('/widgets')
		.get(clients.auth, widgets.list)
		.post(clients.auth, widgets.list) // !
		;
	app.route('/demowidgets')
		.get(clients.auth, widgets.demoWidget)
		.post(clients.auth, widgets.demoWidget) // !
		;
	app.route('/widgets/:widgetId/gadgets')
		.post(clients.auth, widgets.auth, widgets.addGadget)
		.get(clients.auth, widgets.auth, widgets.listGadgets)
		;
	app.route('/widgets/:widgetId/gadgets/:gadgetId')
		.all(clients.auth)
		.all(widgets.auth)
		.put(widgets.updateGadget)
		.get(widgets.listGadget)
		.post(widgets.listGadget) // !
		.delete(widgets.removeGadget)
		;
	app.route('/widgets/:widgetId/gadgets/:gadgetId/delete')
		.post(widgets.removeGadget) // !
		;
	app.route('/widgets/:widgetId/gadgets/:gadgetId/userremote')
		.all(clients.auth)
		.all(widgets.auth)
		.post(widgets.updateUserRemote)
		.put(widgets.updateUserRemote)
		;
	app.route('/widgets/:widgetId/:staMAC?/api/*')
		.all(clients.auth)
		.all(widgets.auth)
		.all(widgets.sendCommand)
		;
	app.route('/widgets/:widgetId/command/:commandId')
		.all(clients.auth)
		.all(widgets.auth)
		.all(widgets.sendResponse)
		;
	app.route('/demo/api/wifi/mac')
		.get(demo.dummyMac)
		;
	app.route('/demo/demo_mac/*')
		.get(demo.dummyWidget)
		;
	app.param('widgetId', widgets.widgetById);
	app.param('gadgetId', widgets.gadgetById);
};