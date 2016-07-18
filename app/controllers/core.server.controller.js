'use strict';

/**
 * Module dependencies.
 */
exports.index = function(req, res) {
	res.render('index', {
		user: req.user || null,
		request: req
	});
};
exports.buy = function(req, res) {
	//res.redirect('/buy.html');
	res.redirect('https://www.tindie.com/products/harik/zmote-wi-fi-universal-remote/');
};