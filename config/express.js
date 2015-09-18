'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs'),
    http = require('http'),
    express = require('express'),
    morgan = require('morgan'),
    bodyParser = require('body-parser'),
    compress = require('compression'),
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    helmet = require('helmet'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    session = require('express-session'),
    MongoStore = require('connect-mongo')(session),
    //flash = require('connect-flash'),
    config = require('./config'),
    consolidate = require('consolidate'),
    path = require('path');


module.exports = function(db) {
    // Initialize express app
    var app = express();

    // Globbing model files
    config.getGlobbedFiles('./app/models/*.js').forEach(function(modelPath) {
        require(path.resolve(modelPath));
    });
    // Setting application local variables
    app.locals.title = config.app.title;
    app.locals.description = config.app.description;
    app.locals.keywords = config.app.keywords;
    app.locals.jsFiles = config.getJavaScriptAssets();
    app.locals.cssFiles = config.getCSSAssets();

    // Passing the request url to environment locals
    app.use(function(req, res, next) {
        res.locals.url = req.protocol + '://' + req.headers.host + req.url;
        next();
    });

    // Enable CORS for *all* URLs
    // FIXME: Make it stricter
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", (req.get('Origin')||"*")); // sticking orgin from req back in the response.
        res.header("Access-Control-Allow-Credentials", "true");
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Length, X-Requested-With");
        // intercept OPTIONS method
        if ('OPTIONS' == req.method) {
            res.send(200);
        } else {
            next();
        }
    });
    /*var clients = require('../app/controllers/clients.server.controller');*/
    passport.use(new LocalStrategy({
        usernameField: '_id',
        passwordField: 'secret'
    }, function(id, secret, done) {
        var Client = require('mongoose').model('Client')
        Client.findById(id, function(err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            if (secret !== user.secret) {
                return done(null, false);
            }
            return done(null, user);
        });
    }));
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        var Client = require('mongoose').model('Client')
        Client.findById(id, function(err, user) {
            done(err, user);
        });
    });

    // Should be placed before express.static
    app.use(compress({
        filter: function(req, res) {
            return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
        },
        level: 9
    }));

    // Showing stack errors
    app.set('showStackError', true);

    // Environment dependent middleware
    if (process.env.NODE_ENV === 'development') {
        // Enable logger (morgan)
        app.use(morgan('dev'));

        // Disable views cache
        app.set('view cache', false);
    } else if (process.env.NODE_ENV === 'production') {
        app.locals.cache = 'memory';
    }

    // Request body parsing middleware should be above methodOverride
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());
    app.use(methodOverride());
    app
        .use(cookieParser('snQWHg5PSJrjizPAdSoM'))
        .use(session({
            resave: true,
            saveUninitialized: true,
            secret: 'Py9J2mBgbxs53JCjFwqT',
            key: 'zmote-auth',
            store: new MongoStore({
                mongooseConnection: db.connection,
                //db: db.connection.db
            }),
        }))
        .use(passport.initialize())
        .use(passport.session())
        ;


    // Use helmet to secure Express headers
    app.use(helmet.xframe());
    app.use(helmet.xssFilter());
    app.use(helmet.nosniff());
    app.use(helmet.ienoopen());
    app.disable('x-powered-by');

    // Setting the app router and static folder
    app.use(express.static(path.resolve('./public')));

    // Globbing routing files
    config.getGlobbedFiles('./app/routes/**/*.js').forEach(function(routePath) {
        require(path.resolve(routePath))(app);
    });
    app.enable('trust proxy');
    /*	// Assume 'not found' in the error msgs is a 404. this is somewhat silly, but valid, you can do whatever you like, set properties, use instanceof etc.
    	app.use(function(err, req, res, next) {
    		// If the error object doesn't exists
    		if (!err) return next();

    		// Log it
    		console.error(err.stack);

    		// Error page
    		res.status(500).render('500', {
    			error: err.stack
    		});
    	});

    	// Assume 404 since no middleware responded
    	app.use(function(req, res) {
    		res.status(404).render('404', {
    			url: req.originalUrl,
    			error: 'Not Found'
    		});
    	});*/

    // Return Express server instance
    return app;
};
