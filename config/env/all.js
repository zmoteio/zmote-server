'use strict';

module.exports = {
	app: {
		title: 'zmote-server',
		description: 'Server for zmote',
		keywords: 'irblaster, remote, universal remote, esp8266'
	},
	mqtt_config: {
		host: '104.154.71.241',
		port: 2883,
		clientId: 'admin_server',
        username: process.env.MONGOLAB_URI.replace(/^mongodb:\/\//, '').replace(/:.*/, ''),
        password: process.env.MONGOLAB_URI.replace(/^mongodb:\/\/.*?:/, '').replace(/@.*/, '')
	},
	port: process.env.PORT || 3000,
	templateEngine: 'swig',
	sessionSecret: 'zmote-server-secret',
	sessionCollection: 'sessions',
	assets: {
		lib: {
			css: [
			],
			js: [
			]
		},
		css: [
		],
		js: [
		],
		tests: [
			'public/lib/angular-mocks/angular-mocks.js',
			'public/modules/*/tests/*.js'
		]
	}
};