var express = require('express');
var app = express();
var basicAuth = require('basic-auth');
var http = require('http').Server(app);
var fs = require('fs');
var io = require('socket.io')(http);
var screenshot = require('./screenshot.js')();
var MongoClient = require('mongodb').MongoClient;
var queryApi = require('./query');


// Establish Database Connection
var DB = null;
MongoClient.connect('mongodb://127.0.0.1:27017/wtrack', function(err, connection) {
	if(err) throw err;
	DB = connection;
});

// ################### Express Webserver ###################

var auth = function (req, res, next) {
	function unauthorized(res) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		return res.send(401);
	}
	var user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		return unauthorized(res);
	}
	if (user.name === 'foo' && user.pass === 'bar') {
		return next();
	} else {
		return unauthorized(res);
	}
};

app.use('/app', auth, express.static(__dirname + '/../frontend'));

app.get('/', function(req, res){
	//res.sendFile(__dirname + '/index.html');
	res.send('<h3>wTrack Server</h3><a href="http://localhost/projects/demianh/wtrack/src/frontend/">Admin Tool</a><br><a href="/api">API</a>');
});

app.get("/screenshots/*", function(req, res){
	fs.exists(__dirname + req.path, function (exists) {
		if (exists){
			res.sendFile(__dirname + req.path);
		} else {
			res.send('<h1>Not Found</h1><p>The requested URL was not found on this server.</p>', 404);
		}
	});
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
	res.send('<h1>Not Found</h1><p>The requested URL was not found on this server.</p>', 404);
});

http.listen(3000, function(){
	console.log('listening on *:3000');
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
