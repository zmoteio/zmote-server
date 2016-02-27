'use strict';

var es = require('child_process').execSync;
var heroku = (process.env.NODE_HOME || '').indexOf('heroku') > -1
var decodeir = heroku ? '/app/bin/decodeir ' : 'decodeir ';
var encodeir = heroku ? '/app/bin/encodeir ' : 'encodeir ';
var encodeirz = heroku ? '/app/bin/encodeirz ' : 'encodeirz ';

var code2gc = function(code, compress) {
    if (compress === undefined) compress = true;
    var gc = 'sendir,1:3,0,' + code.frequency + ',' + (code.repeat[0] + 1) + ',' + (code.repeat[1] + 1);
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
        gc = gc.replace(/([A-Z]),/g, "$1");
    }
    else {
        gc += ',' + JSON.stringify(code.seq).replace('[', '').replace(']', '');
    }
    return gc;
}

var rawcode = function(trigger) {
    var frequency = 38000;
    var seq = [];

    for (var i = 0; i < trigger.length; i++) {
        seq.push(Math.floor(trigger[i] * 1000.0 / frequency + 0.5));
    }

    return {frequency: frequency, n: seq.length, seq: seq, repeat: [0, 0, 0]};
}

var analyse = function(trigger) {
    var args, spec, code, tcode, gc, gc1, confidence = 0;
    var temp = JSON.parse(es(decodeir + trigger.join(' ')).toString().trim());
    if (temp.error === undefined) {
        spec = temp;
        confidence += 32;
        args = spec.protocol + ' ' + spec.device + ' ' + (spec.subdevice || -1) + ' ' + spec.obc;
        code = JSON.parse(es(encodeirz + args).toString().trim());
        if (code.error === undefined) {
            confidence += 64;
            code.repeat[0] = 1;
            gc = code2gc(code);
            if (spec.misc && spec.misc.match(/T=/)) {
                args += ' 1';
                tcode = JSON.parse(es(encodeirz + args).toString().trim());
                tcode.repeat[0] = 1;
                gc1 = code2gc(tcode);
            }
        }
        else {
            // console.log('encode error');
            code = rawcode(trigger);
            gc = code2gc(code);
        }
    }
    else {
        // console.log('decode error');
        code = rawcode(trigger);
        gc = code2gc(code);
    }
    return {confidence: confidence, spec: spec, gc: gc, gc1: gc1, code: code, tcode: tcode};
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
