'use strict';

var clients = require('../../app/controllers/clients.server.controller');
var passport = require('passport');

module.exports = function(app) {
    app.route('/client/register')
        .get(clients.create);
    app.route('/client/auth')
        .post(passport.authenticate('local'),
            function(req, res) {
                req.user.extIP = req.ip.replace(/.*:/, '');
                res.json(req.user);
            })
        .get(function(req, res) {
        	if (req.isAuthenticated()) {
				req.user.extIP = req.ip.replace(/.*:/, '');
                res.json(req.user);
        	} else
        		res.json({});
        });
};
