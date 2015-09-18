'use strict';

var clients = require('../../app/controllers/clients.server.controller'),
	remotes = require('../../app/controllers/remotes.server.controller'),
	widgets = require('../../app/controllers/widgets.server.controller');

module.exports = function(app) {
	app.route('/remotes')
		.get(remotes.list)
		;
	app.route('/remotes/:remoteId')
		.get(remotes.get)
		;
};