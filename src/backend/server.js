var express = require('express');
var app = express();
var http = require('http').Server(app);
var https = require('https');
var cors = require('cors');
var basicAuth = require('basic-auth');
var fs = require('fs');
var io = require('socket.io')(http);
var screenshot = require('./screenshot.js')();
var MongoClient = require('mongodb').MongoClient;
var queryApi = require('./query');

var config = require('./_config.json');

if (config.ssl.enabled){
	var privateKey  = fs.readFileSync(config.ssl.privateKey, 'utf8');
	var certificate = fs.readFileSync(config.ssl.certificate, 'utf8');
	var credentials = {key: privateKey, cert: certificate};
	var httpsServer = https.createServer(credentials, app);
}

// Establish Database Connection
var DB = null;
MongoClient.connect(config.mongoDB.connection, function(err, connection) {
	if(err) throw err;
	DB = connection;
});

// ################### Express Webserver ###################

var auth = function (req, res, next) {
	function unauthorized(res) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		return res.sendStatus(401);
	}
	var user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		return unauthorized(res);
	}
	if (user.name === config.basicAuth.user && user.pass === config.basicAuth.pass) {
		return next();
	} else {
		return unauthorized(res);
	}
};

app.use(cors({origin: true, credentials: true}));
app.use('/client', express.static(__dirname + '/../client'));
app.use('/app', auth, express.static(__dirname + '/../frontend'));
app.use('/screenshots', auth, express.static(__dirname + '/../backend/screenshots'));

app.get('/', function(req, res){
	res.send('<h3>wTrack Server</h3><a href="/app">Admin Tool</a><br><a href="/api">API</a>');
});

// Query JSON API
app.get('/api', auth, queryApi._documentation);

// auto generate api routes
Object.keys(queryApi).forEach(function(endpoint) {
	// ignore endpoints starting with _
	if (endpoint.charAt(0) != '_'){
		app.get('/api/'+endpoint, auth, queryApi[endpoint]);
	}
});

// finally 404 Route
app.get('*', function(req, res){
	res.status(404).send('<h1>Not Found</h1><p>The requested URL was not found on this server.</p>');
});


// ################### Websockets ###################

io.on('connection', function(socket){
	socket.on('trackedEvent', function(msg){
		var eventData = JSON.parse(msg);

		var imageName = null;
/*		if (eventData && eventData.data && eventData.data.html){
			imageName = 'screenshots/wbl_' + Date.now() + '.png';
			screenshot.fromHTML(eventData.data, imageName);
		}*/

		// add image url and send to loggers
		var copy = JSON.parse(JSON.stringify(eventData));
		copy.data.screenshotUrl = imageName;
		copy.data.html = null;
		io.emit('trackedEvent', JSON.stringify(copy));

		// persist data in DB
		DB.collection('log').insert(copy, function(err, docs) {});
	});
});

http.listen(config.webserver.port, function(){
	console.log('http listening on *:'+config.webserver.port);
});

if (config.ssl.enabled) {
	httpsServer.listen(config.webserver.portSSL, function () {
		console.log('https listening on *:' + config.webserver.portSSL);
	});
}
