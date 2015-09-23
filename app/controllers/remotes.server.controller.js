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
exports.list_old = function(req, res) {
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

// New style query that does not depend on a text index
exports.list = function(req, res) {
	if (!req.query.query || req.query.query.length < 2)
		return res.status(400).send({
			message: "No query or query too short"
		});
	// Break query string into words while honoring double quotes
	var terms = req.query.query.match(/\s*([^"]\S*|".*?")\s*/g)
					.map(function (s) {
						if (s[0] == '"')
							s = s.replace(/^"/, '').replace(/"$/, '');
						s = s.replace(/^\s*/, '').replace(/\s*$/, '');
						return s;
					});

	// Each search term must:
	//   1. match the start of a brand name (i.e., moto ~ motorola), OR
	//   2. match the model , OR
	//   3. Be a substring of the model (provided the term in question is atleast 4 characters)
	var q = [];
	terms.forEach(function 	(t) {
		var sq = [
			{brand: {$regex: '^'+t+'.*', $options: 'i'}},
			{model: t}
		];
		if (t.length >= 4)
			sq.push({model: {$regex: '.*'+t+'.*', $options: 'i'}});
		q.push({$or: sq});
	});
	if (q.length > 1)
		q = {$and: q};
	else
		q = q[0];
	if (req.query.type) {
		if (q['$and'])
			q['$and'].push({ type: req.query.type});
		else
			q = {$and: [ q, { type: req.query.type}]};
	}
	Remote.find(q)
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
