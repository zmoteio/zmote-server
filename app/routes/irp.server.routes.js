'use strict';

var es = require('child_process').execSync;
var heroku = (process.env.NODE_HOME || '').indexOf('heroku') > -1
var decodeir = heroku ? '/app/bin/decodeir ' : 'decodeir ';
var encodeir = heroku ? '/app/bin/encodeir ' : 'encodeir ';
var encodeirz = heroku ? '/app/bin/encodeirz ' : 'encodeirz ';

module.exports = function(app) {

    app.route('/irp/decode/:data')
        .get(function(req, res, next) {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            res.end(es(decodeir + req.params.data.replace(/,/g, ' ')).toString().trim());
            return next();
        });
    app.route('/irp/decode')
        .post(function(req, res, next) {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            res.end(es(decodeir + JSON.stringify(req.body.trigger).replace(/[,\[\]]/g, ' ')).toString().trim());
            return next();
        });

    app.route('/irp/encode/:data')
        .get(function(req, res, next) {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            res.end(es(encodeirz + req.params.data.replace(/,/g, ' ')).toString().trim());
            return next();
        });
    app.route('/irp/encode')
        .post(function(req, res, next) {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            var args = req.body.protocol + ' ' + req.body.device + ' ' + (req.body.subdevice || -1) + ' ' + req.body.obc;
            if (req.body.misc && req.body.misc.match(/T=1/))
                args += ' 1';
            res.end(es(encodeirz + args).toString().trim());
            return next();
        });

    app.route('/irp/encode/raw/:data')
        .get(function(req, res, next) {
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8'
            });
            res.end(es(encodeir + req.params.data.replace(/,/g, ' ')).toString().trim());
            return next();
        });
};
