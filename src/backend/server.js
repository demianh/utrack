var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var screenshot = require('./screenshot.js')();

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
	socket.on('trackedEvent', function(msg){
		io.emit('trackedEvent', msg);
		var eventData = JSON.parse(msg);

		var imageName = null;
		if (eventData && eventData.data && eventData.data.html){
			imageName = 'screenshots/wbl_' + Date.now() + '.png';
			screenshot.fromHTML(eventData.data.html, imageName);
		}
	});
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});
