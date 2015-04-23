
var MongoClient = require('mongodb').MongoClient;

var out = function(err, docs) {
	console.log("-------------------------------------------");
	if (err){
		console.log(err);
	} else {
		console.log(docs);
	}
};

var outJSON = function(err, docs) {
	console.log("-------------------------------------------");
	if (err){
		console.log(err);
	} else {
		console.log(docs);
	}
};

// Establish Database Connection
var db = null;
MongoClient.connect('mongodb://127.0.0.1:27017/wtrack', function(err, connection) {
	if(err) throw err;
	db = connection;

	// workaround to use the same name as Robomongo
	db.getCollection = db.collection;

});

// ================== Queries ==================

// --- list event types
exports.eventTypes = function(req, res){
	db.getCollection('log').aggregate([
		{ $group: {
			_id: '$event', count: { $sum: 1}
		}},
		{ $sort : { count : -1}}
	], function(err, data){
		res.json(data);
	});
};

// --- list actions per tab
exports.tabActions = function(req, res) {
	db.getCollection('log').aggregate([
		{
			$group: {
				_id: '$workflow.mainnav', count: {$sum: 1}
			}
		},
		{$sort: {count: -1}}
	], function(err, data){
		res.json(data);
	});
};

// --- main nav clicks
exports.tabClicks = function(req, res) {
	db.getCollection('log').aggregate([
		{$match: {event: 'webling_mainnav'}},
		{
			$group: {
				_id: '$workflow.mainnav', count: {$sum: 1}
			}
		},
		{$sort: {count: -1}}
	], function(err, data){
		res.json(data);
	});
};

// --- duration per tab
exports.tabDuration = function(req, res) {
	db.getCollection('log').find({'workflow.mainnav': {$ne: null}}).sort({timestamp: 1}).toArray(function (err, data) {

		//console.log(data);
		var sessions = {};
		var times = {};
		data.forEach(function (row) {
			if (row.session) {
				if (sessions[row.session.id]) {
					// update session if section changed or session ended
					var old_section = sessions[row.session.id].section;
					if (old_section != row.workflow.mainnav || row.event == 'session_end') {
						if (!times[old_section]) {
							times[old_section] = row.timestamp - sessions[row.session.id].timestamp;
						} else {
							times[old_section] += row.timestamp - sessions[row.session.id].timestamp
						}
						sessions[row.session.id] = {
							section: row.workflow.mainnav,
							timestamp: row.timestamp
						};
					}
				} else {
					// start session
					sessions[row.session.id] = {
						section: row.workflow.mainnav,
						timestamp: row.timestamp
					};
				}
			}
		});

		// convert to seconds
		Object.keys(times).map(function (value, index) {
			times[value] = Math.round(times[value] / 1000) + ' sec';
		});

		res.json(times);
	});
};

// --- session duration
exports.sessionDuration = function(req, res) {
	db.getCollection('log').find({$or: [{'event': 'session_start'}, {'event': 'session_end'}]}).sort({timestamp: 1}).toArray(function (err, data) {

		//console.log(data);
		var sessions = {};
		var times = [];
		data.forEach(function (row) {
			if (row.session) {
				//console.log(row.session.id, row.event);
				if (row.event == 'session_start') {
					sessions[row.session.id] = row.timestamp;
				}
				if (row.event == 'session_end') {
					if (sessions[row.session.id]) {
						var seconds = Math.round((row.timestamp - sessions[row.session.id]) / 1000);
						times.push(seconds);
					}
				}
			}
		});

		times = times.sort(function(a, b) {
			return a - b;
		});

		var total_time = times.reduce(function (pv, cv) {
			return pv + cv;
		}, 0);

		res.json({
			'Total Time': Math.round((total_time) / 60 / 60) + ' hours',
			'Median Time': times[Math.floor(times.length / 2)] + ' sec',
			'Average Time': Math.round(total_time / times.length) + ' sec',
			'Samples': times.length
		});
	});
};

// --- get list of workflows
exports.workflowList = function(req, res) {
	db.getCollection('log').aggregate([
		{$match: {'workflow.dialog.0': {$exists: true}}},
		{
			$group: {
				_id: '$workflow', count: {$sum: 1}
			}
		},
		{$sort: {count: -1}}
	], function (err, data) {
		res.json(data);
	});
};


// --- get time used in workflows
exports.workflowTimeTotal = function(req, res) {
	db.getCollection('log').aggregate([
		{
			$match: {
				$or: [{event: "dialog_open"}, {event: "dialog_close"}]
			}
		},
		{
			$project: {
				'workflow': '$workflow',
				'event': '$event',
				'session': '$session',
				'timestamp': '$timestamp'
			}
		},
		{$sort: {timestamp: 1}}
	], function (err, data) {
		//console.log(data);


		var sessions = {};
		var times = {};
		data.forEach(function (row) {
			if (row.session) {
				var section = [row.workflow.mainnav, row.workflow.subnav, row.workflow.dialog.join(' / ')].join(' / ');
				if (sessions[row.session.id]) {
					// update session if section changed or session ended
					var old_section = sessions[row.session.id].section;
					if (old_section != section || row.event == 'session_end') {
						if (!times[old_section]) {
							times[old_section] = row.timestamp - sessions[row.session.id].timestamp;
						} else {
							times[old_section] += row.timestamp - sessions[row.session.id].timestamp
						}

						sessions[row.session.id] = {
							section: section,
							timestamp: row.timestamp
						};
					}
				} else {
					// start session
					sessions[row.session.id] = {
						section: section,
						timestamp: row.timestamp
					};
				}
			}
		});

		// convert to seconds
		Object.keys(times).map(function (value, index) {
			times[value] = Math.round(times[value] / 1000) + ' sec';
		});

		res.json(times);

	});
};




// auto generated documentation (list of endpoints)
exports._documentation = function(req, res){
	var html = '<h3>API Endpoints</h3>';
	Object.keys(exports).forEach(function(endpoint) {
		// ignore endpoints starting with _
		if (endpoint.charAt(0) != '_'){
			html += '<a href="/api/'+endpoint+'">'+endpoint+'</a><br>';
		}
	});
	res.send(html);
};
