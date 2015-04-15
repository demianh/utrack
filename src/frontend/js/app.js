var socket = io('http://localhost:3000');
socket.on('trackedEvent', function(msg){
	var data = JSON.parse(msg);
	$('#messages').prepend($('<li>' +
	'<i class="fa fa-dot-circle-o bg-blue"></i>' +
	'<div class="timeline-item">' +
		'<h3 class="timeline-header">' +
		data.event + ' on ' + data.label +
		'</h3>' +
		'<div class="timeline-body">' +
		msg +
		(data.data.screenshotUrl ? '<br><a href="../backend/'+data.data.screenshotUrl+'" target="_blank">Screenshot</a>' : '') +
		'</div>' +
	'</div>' +
	'</li>'));
});