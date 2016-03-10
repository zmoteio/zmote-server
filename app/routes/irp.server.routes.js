'use strict';

var es = require('child_process').execSync;
var heroku = (process.env.NODE_HOME || '').indexOf('heroku') > -1
var decodeir = heroku ? '/app/bin/decodeir ' : 'decodeir ';
var encodeir = heroku ? '/app/bin/encodeir ' : 'encodeir ';
var encodeirz = heroku ? '/app/bin/encodeirz ' : 'encodeirz ';

var code2gc = function(code, compress) {
    if (compress === undefined) compress = true;
    var gc = code.frequency + ',' + (code.repeat[0] + 1) + ',' + (code.repeat[1] + 1);
    var p = [], q = [];
    if (compress) {
        var alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        for (var i = 0; i < code.seq.length; i += 2) {
            var j = -1;
            for (var k = 0; k < p.length; k++)
                if (p[k] === code.seq[i] && q[k] === code.seq[i + 1]) {
                    j = k;
                    break;
                }
            if (j == -1) {
                p.push(code.seq[i]);
                q.push(code.seq[i + 1]);
                gc += ',' + code.seq[i] + ',' + code.seq[i + 1];
            }
            else {
                gc += alphabet[j];
            }
        }
        gc = gc.replace(/([A-Z]),/g, '$1');
    }
    else {
        gc += ',' + JSON.stringify(code.seq).replace('[', '').replace(']', '');
    }
    return gc;
}

var gc2code = function(gc) {
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
    var seq = [];
    var p = {}, q = {}, k = 0;
    var alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    while (data.length > 0) {
        var v = data.shift();
        if (v.match(/[A-Z]/)) {
            seq.push(p[v]);
            seq.push(q[v]);
        }
        else {
            v = parseInt(v);
            seq.push(v);
            p[alphabet[k]] = v;
            v = parseInt(data.shift());
            seq.push(v);
            q[alphabet[k]] = v;
            k++;
        }
    }
    return {frequency: f, seq: seq, n: seq.length, repeat: [r - 1, o - 1, seq.length]}
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
    for (var i = 0; i < trigger.length; i++) trigger[i] = parseInt(trigger[i])
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
            response.gc = code2gc(code);
            if (spec.misc && spec.misc.match(/T=/)) {
                args += ' 1';
                code = JSON.parse(es(encodeirz + args).toString().trim());
                code.repeat[0] = 1;
                response.tcode = code;
                response.tgc = code2gc(code);
            }
        }
        else {
            // console.log('encode error');
            response.trigger = trigger;
            code = rawcode(trigger);
            response.code = code;
            response.gc = code2gc(code);
        }
    }
    else {
        // console.log('decode error');
        response.trigger = trigger;
        code = rawcode(trigger);
        response.code = code;
        response.gc = code2gc(code);
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
