'use strict';

var es = require('child_process').execSync;
var decodeir = '/home/harik_klarsys_com/zmote-server/bin/decodeir ';
var encodeir = '/home/harik_klarsys_com/zmote-server/bin/encodeir ';
var encodeirz = '/home/harik_klarsys_com/zmote-server/bin/encodeirz ';

var gc2trigger = function(gc) {
    gc = gc.replace(/([A-Z])/g, ',$1,').replace(/,,/g, ',');
    var data = gc.split(',');
    if (data[0] === 'sendir') {
        data.shift();
        data.shift();
        data.shift();
    }
    var f = parseInt(data.shift());
    var r = parseInt(data.shift());
    var o = parseInt(data.shift());
    var trigger = [];
    var p = {}, q = {}, k = 0;
    var alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    while (data.length > 0) {
        var v = data.shift();
        if (v.match(/[A-Z]/)) {
            trigger.push(p[v]);
            trigger.push(q[v]);
        }
        else {
            v = parseInt(parseInt(v) * 1000000.0 / f + 0.5);
            trigger.push(v);
            p[alphabet[k]] = v;
            v = parseInt(parseInt(data.shift()) * 1000000.0 / f + 0.5);
            trigger.push(v);
            q[alphabet[k]] = v;
            k++;
        }
    }
    return trigger;
}

var rawcode = function(trigger, frequency) {
    if (frequency === undefined) frequency = 38000;
    var seq = [];

    for (var i = 0; i < trigger.length; i++) {
        seq.push(Math.floor(trigger[i] * frequency / 1000000.0 + 0.5));
    }

    return {frequency: frequency, n: seq.length, seq: seq, repeat: [0, 0, 0]};
}

var analyse = function(trigger) {
    var args, spec, code;
    var response = { confidence: 0 };
    for (var i = 0; i < trigger.length; i++) trigger[i] = parseInt(trigger[i]);
    if (trigger.length % 2 == 1) trigger.push(100000);
    spec = JSON.parse(es(decodeir + trigger.join(' ')).toString().trim());
    if (spec.error === undefined) {
        response.confidence += 32;
        response.spec = spec;
        args = spec.protocol + ' ' + spec.device + ' ' + (spec.subdevice || -1) + ' ' + spec.obc;
        code = JSON.parse(es(encodeirz + args).toString().trim());
        if (code.error === undefined) {
            response.confidence += 64;
            code.repeat[0] = 1;
            response.code = code;
            if (spec.misc && spec.misc.match(/T=/)) {
                args += ' 1';
                code = JSON.parse(es(encodeirz + args).toString().trim());
                code.repeat[0] = 1;
                response.tcode = code;
            }
        }
        else {
            // console.log('encode error');
            response.trigger = trigger;
            code = rawcode(trigger);
            response.code = code;
        }
    }
    else {
        // console.log('decode error');
        response.trigger = trigger;
        code = rawcode(trigger);
        response.code = code;
    }
    return response;
}

module.exports = function(app) {

    app.route('/irp/analyse/:data')
        .get(function(req, res, next) {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            var trigger = req.params.data.replace(/,/g, ' ').split(' ');
            if (trigger[0] === 'sendir') {
                trigger = gc2trigger(req.params.data);
            }
            res.end(JSON.stringify(analyse(trigger)));
            return next();
        });
    app.route('/irp/analyse')
        .post(function(req, res, next) {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            res.end(JSON.stringify(analyse(req.body.trigger)));
            return next();
        });

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
