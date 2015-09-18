'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	errorHandler = require('./errors.server.controller'),
	Widget = mongoose.model('Widget'),
	Gadget = mongoose.model('Gadget'),
	UserRemote = mongoose.model('UserRemote'),
	Remote = mongoose.model('Remote'),
	Command = mongoose.model('Command'),
	_ = require('lodash'),
	q = require('q');


exports.list = function(req, res) {
	var ip = req.ip.replace(/.*:/, '');
	console.log("External IP: ", ip);
	Widget.find({$or:[ 
						{$and:[{extIP: ip}, {connected: true }]},
						{clients: req.client._id}
					]
				}).exec(function(err, widgets) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.json(widgets);
		}
	});
};

exports.listGadget = function (req, res) {
	res.json(req.gadget);
}
exports.listGadgets = function (req, res) {
	Gadget.find({widget: req.widget._id}).populate('remote userRemote')
		.then(function (gadgets) {
			res.json(gadgets);
		}, function (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		});
}
exports.addGadget = function (req, res) {
	console.log("addGadget");
	if (!mongoose.Types.ObjectId.isValid(req.body.remote)) {
		console.log("Bad obj id");
    	return res.status(400).send({
      		message: 'Remote is invalid'
    	});
  	}
	var gadget = new Gadget({ 
		createdBy: req.body.client._id, 
		name: req.body.name, 
		remote:  req.body.remote,
		widget: req.widget._id
	});
	gadget.save()
		.then(function (g) {
			console.log("gadget save", req.widget, g);
			req.widget.gadgets.push(g._id);
			return req.widget.save();
		})
		.then(function () {
			res.json(gadget);
		}, function (err) {
			console.log("save error", err);
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		});
};
exports.updateGadget = function (req, res) {
	req.gadget.name = req.body.name;
	if (req.body.remote)
		req.gadget.remote = req.body.remote;
	req.gadget.save(function (err) {
	    if (err) {
	      return res.status(400).send({
	        message: errorHandler.getErrorMessage(err)
	      });
	    } else {
	      res.json(req.gadget);
	    }
  	});
};
exports.removeGadget = function (req, res) {
	var ndx = _.findIndex(req.widget.gadgets, function (g) {
		return g._id.toString() == req.gadget._id.toString();
	});
	console.log("ndx=", ndx);
	if (ndx < 0) 
		return res.status(400).send({
      		message: "Remote's entry not found in widget"
    	});
	req.widget.gadgets.splice(ndx, 1);
	req.widget.save()
		.then(function () {
			if (req.gadget.userRemote)
				return req.gadget.userRemote.remove();
			return true;
		})
		.then(function () {
			return req.gadget.remove();
		})
		.then(function () {
			console.log("suvvess");
			res.json(req.gadget);
		}, function (err) {
			console.log("err", err);
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		});
};
exports.updateUserRemote = function (req, res) {
	//var userRemote = req.gadget.userRemote;
	var p;
	delete req.body._id;
	var userRemote = new UserRemote(req.body);
	/*if (req.gadget.userRemote) { // Updating
		var upsertRec = userRemote.toObject();
		delete upsertRec._id;
		p = Gadget.update({_id: req.gadget.userRemote._id}, upsertRec, {upsert: true}).save();
	} else { */// New userRemote
		console.log("Saving", req.body);
		p = userRemote.save()
			.then(function () {
				if (req.gadget.userRemote)
					return req.gadget.userRemote.remove();
				return true;
			})
			.then(function () {
				req.gadget.userRemote = userRemote._id;
				return req.gadget.save();
			})
			.then(function (g) {
				req.gadget = g;
				return Gadget.populate(req.gadget, 'userRemote');
			})
			.then(function (gadget) {
				res.json(gadget);
			}, function (err) {
				console.log("err", err);
				return res.status(400).send({
						message: errorHandler.getErrorMessage(err)
					});
			});
};
/*
 * Client has access to widget
 */
function isClientAdded(clients, client) {
	var ndx = _.findIndex(clients, function (c) {
		//console.log("Checking", c, client, (c.toString() == client.toString()));
		return (c.toString() == client.toString());
	});
	if (ndx < 0)
		return false;
	return true;
}
exports.auth = function(req, res, next) {
	if (isClientAdded(req.widget.clients, req.client._id)) {
		console.log("Previous access: authorized");
		next();
	} else if (req.widget.connected && req.widget.extIP == req.ip.replace(/.*:/, '')) {
		console.log("IP match: authorized");
		console.log("clients", req.widget.clients);
		console.log("req.client", req.client._id.toString());
		console.log("Adding client to authorize list");
		req.widget.clients.push(req.client._id);
		req.widget.save()
			.then(function () { 
				console.log("Saved");
				next(); 
			}, next);
	} else 
		return res.status(403).send('Widget auth fail');
};

var mqtt    = require('mqtt');
var config = require('../../config/config');
var mqttReady;

function mqttInit() {
	mqttReady = q.defer();
	var mqttClient = mqtt.connect(config.mqtt_config);
	console.log("mqttCOnnect", config.mqtt_config);
	mqttClient.on('connect', function () {
		mqttReady.resolve(mqttClient);
	});
	mqttClient.on('message', function (topic, message) {
		var msg = JSON.parse(message.toString());
		console.log("MQTT Message", msg);
      	var path = topic.split('/');
      	var chipID = path[2];
      	if (!msg.id)
      		return;
      	Command.findById(msg.id)
      		.then(function (cmd) {
      			if (!cmd)
      				return;
      			cmd.response = JSON.stringify(msg.response);
      			cmd.status = "completed";
      			return cmd.save();
      		})
      		.then(function () {
      			// Check if there are any other outstanding commands
      			// to this widget
      			return Command.find({chipID: chipID, status: "pending"});
      		})
      		.then(function (pendCommands) {
      			// If not, we an unsubscribe to it
      			if (pendCommands && pendCommands.length)
      				return;
      			mqttClient.unsubscribe('zmote/widget/'+chipID);
      		}, function (err) {
      			console.log("Error handling MQTT message: " + err, err.stack);
      		});
	});
}
function pubCommand(widget, command) {
	if (!mqttReady)
		mqttInit();
	console.log("pubCOmmand");
	return mqttReady.promise.then(function (client) {
		console.log("Publisj");
		client.subscribe('zmote/widget/'+widget.chipID);
		client.publish('zmote/towidget/'+widget.chipID, JSON.stringify(command), {qos:1});
		return true;
	});
}
exports.sendCommand = function (req, res) {
	var cmd = new Command({
		widget: req.widget._id
	});
	var mqttPkt = {
		command: req.method,
		url: req.url.replace(/^.*\/api\//, '/api/'),
		postdata: JSON.stringify(req.body),
		id: cmd._id
	};
	console.log("snedCOmmand", mqttPkt);
	cmd.save()
		.then(function () {
			return pubCommand(req.widget, mqttPkt);
		})
		.then(function () {
			res.json(cmd);
		}, 
		function (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		});
};
exports.sendResponse = function (req, res) {
	Command.findById(req.params.commandId)
		.then(function (cmd) {
			if (!cmd)
				return res.status(404).send({
					message: "Command ID invalid"
				});
			if (cmd.status == "pending")
				res.json(cmd);
			else
				res.json(JSON.parse(cmd.response));
		}, function (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		});
};

exports.widgetById = function (req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Widget is invalid'
    });
  }

  Widget.findById(id).populate('gadgets').exec(function (err, widget) {
    if (err) {
      return next(err);
    } else if (!widget) {
      return res.status(404).send({
        message: 'No widget with that identifier has been found'
      });
    }
    Gadget.populate(widget.gadgets, 'remote userRemote', function (err, gadgets) {
    	if (err)
    		return next(err);
	    req.widget = widget;
	    req.widget.gadgets = gadgets;
	    next();
    });
  });
};

exports.gadgetById = function (req, res, next, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Gadget is invalid'
    });
  }

  Gadget.findById(id).populate('remote userRemote')
  .exec(function (err, gadget) {
  	if (err) {
      return next(err);
    } else if (!gadget) {
      return res.status(404).send({
        message: 'No gadget with that identifier has been found'
      });
    }
    req.gadget = gadget;
    next();
  });
};

