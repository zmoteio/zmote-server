#!/bin/env node

var mongoose = require('mongoose');
require('../app/models/remote.server.model.js');
var Remote = mongoose.model('Remote');

mongoose.connect('mongodb://localhost/zmote-server-dev', function(err) {
	if (err) {
		console.error('Could not connect to MongoDB!');
		console.log(err);
	} else {
		readDB();
	}
});

function readDB() {
	var lineReader = require('line-reader');
	var nim = 0, nign = 0;
	var nsaved = 0, nerr = 0;
	lineReader.eachLine('import.json', function(line, last) {
	  //console.log(line);
	  if (!line.match(/^\{"brand":"/)) {
	  	++nign;
	  	return;
	  }
	  var remote = JSON.parse(line);
	  var rec = new Remote(remote);
	  rec.save().then(function () { 
	  	++nsaved;
	  }, function (err) {
	  	console.error(err);
	  	++nerr;
	  })
	  ++nim;
	  // do whatever you want with line...
	  if(last){
	    // or check if it's the last one
	    console.log("%d lines imported; %d ignored", nim, nign);
	    console.log("%d saved; %d ignored", nsaved, nerr);
	  }
	});
}
