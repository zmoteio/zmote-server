'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    errorHandler = require('./errors.server.controller'),
    Client = mongoose.model('Client'),
    _ = require('lodash');

// Generates a random 64-byte alpha-numeric string
var allChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

function genCode() {
    var base = '';
    for (var i = 0; i < 64; i++)
        base += allChars.charAt(Math.floor(Math.random() * allChars.length));
    return base;
}
/**
 * Create a client
 */
exports.create = function(req, res) {
    var client = new Client();
    client.secret = genCode();

    client.save(function(err) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.json(client);
        }
    });
};

exports.auth = function(req, res, next) {
    if (req.isAuthenticated()) {
        req.client = req.user;
        return next();
    }
    var creds = req.body;
    if (req.body.client)
        creds = req.body.client;
    if (!creds || !creds._id)
        return next("Auth failure");
    Client.findById(creds._id)
        .then(function(client) {
            if (client && client.secret == creds.secret) {
                client.lastLogin = Date.now();
                req.client = client;
                return client.save();
            } else
                return next("Auth faulure");
        })
        .then(function() {
            if (req.client) {
            	delete req.body.client;
                next();
            }
        }, function(err) {
            console.error("DB error", err);
            next("Auth failure");
        });
};
