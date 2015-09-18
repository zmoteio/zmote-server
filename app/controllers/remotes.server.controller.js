'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	errorHandler = require('./errors.server.controller'),
	Remote = mongoose.model('Remote'),
	_ = require('lodash');

// Index created with:
// 	db.remotes.createIndex({brand: "text", model: "text", name: "text"})
exports.list = function(req, res) {
	if (!req.query.query || req.query.query.length < 2)
		return res.status(400).send({
			message: "No query or query too short"
		});
	// Double quote terms that are not already double quoted
	// MongoDB treats search terms as "OR" unless they are double quoted
	// Double-quoting also prevents stemming and whatnot
	// See: http://stackoverflow.com/a/24071183/4560510
	var terms = req.query.query.match(/"(?:\\"|\\\\|[^"])*"|\S+/g)
					.map(function (s) {
						if (s[0] == '"')
							return s;
						return '"' + s + '"';
					})
					.join(" ");
	var q = {
		$text: {
			$search: terms
		}
	};
	if (req.query.type)
		q.type = req.query.type;
	Remote.find(q)
		.select({ match: { $meta: "textScore" }})
		//.sort([{ match: { $meta: "textScore" }}	, {confidence: 1}, {score: 1}])
		.sort([[ 'match', { $meta: "textScore" }], ['confidence', 1], ['score', 1]])
		.select('-keys -layout')
		//.limit(500)
		.exec(function(err, remotes) {
			if (err) {
				return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
			} else {
				res.json(remotes);
			}
	});
};

exports.get = function (req, res) {
	Remote.findById(req.params.remoteId)
		.then(function (gadget) {
			res.json(gadget);
		}, function (err) {
			return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
		});
}
