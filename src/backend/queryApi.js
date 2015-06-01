
var MongoClient = require('mongodb').MongoClient;

// Establish Database Connection
var db = null;
MongoClient.connect('mongodb://127.0.0.1:27017/wtrack', function(err, connection) {
	if(err) throw err;
	db = connection;

	// workaround to use the same name as Robomongo
	db.getCollection = db.collection;

});

exports.endpoints = [];

// ================== Helper Functions =========

function getWorkflowAsString(workflow){
	return [workflow.mainnav, workflow.subnav, workflow.dialog.join(' / ')].join(' / ');
}

function sortObject(obj) {
	var arr = [];
	for (var prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			arr.push({
				'key': prop,
				'value': obj[prop]
			});
		}
	}
	arr.sort(function(a, b) { return b.value - a.value; });

	var retObj = {};
	for (var idx in arr) {
		retObj[arr[idx]['key']] = arr[idx]['value']
	}

	return retObj; // returns array
}

// ================== Queries ==================

// --- list event types
exports.endpoints.push([
	'eventTypes',
	function(req, res){
		db.getCollection('log').aggregate([
			{ $group: {
				_id: '$event', count: { $sum: 1}
			}},
			{ $sort : { count : -1}}
		], function(err, data){
			res.json(data);
		});
	}
]);

// --- list actions per tab
exports.endpoints.push([
	'tabActions',
	function(req, res) {
		db.getCollection('log').aggregate([
			{$match: {event: 'click'}},
			{
				$group: {
					_id: '$workflow.mainnav', count: {$sum: 1}
				}
			},
			{$sort: {count: -1}}
		], function(err, data){
			res.json(data);
		});
	}
]);

// --- main nav clicks
exports.endpoints.push([
	'tabClicks',
	function(req, res) {
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
	}
]);

// --- duration per tab
exports.endpoints.push([
	'tabDuration',
	function(req, res) {
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
							var steptime = row.timestamp - sessions[row.session.id].timestamp;

							// if idle time is more than two minutes, do not record time
							if (steptime > 120*1000){
								steptime = 0;
							}

							// reduce idle times to max 20 seconds
							// user is probably not really using the site during that time
							steptime = Math.min(steptime, 20*1000);

							if (!times[old_section]) {
								times[old_section] = steptime;
							} else {
								times[old_section] += steptime;
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

			// convert to minutes
			Object.keys(times).map(function (value, index) {
				times[value] = Math.round(times[value] / 1000 / 60);
			});

			times = sortObject(times);

			res.json(times);
		});
	}
]);

// --- session duration
exports.endpoints.push([
	'sessionDuration',
	function(req, res) {
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
	}
]);

// --- get list of workflows
exports.endpoints.push([
	'workflowList',
	function(req, res) {
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
	}
]);

// --- get a list of actions that happened before an error
exports.endpoints.push([
	'workflowBeforeErrors',
	function(req, res) {
		db.getCollection('log').find(
			{},
			{"sort": [["session.id", "desc"],["timestamp", "desc"]]}
		).toArray(function (err, data) {
				var list = {};
				var isErrorState = 0;
				var errorEvent;


				data.forEach(function(event) {

					if(event.workflow.dialog.indexOf('Oops, es ist ein Fehler aufgetreten...') >= 0){
						//console.log(event.workflow.dialog);
						isErrorState = event.session.id;
						errorEvent = event;
					} else {
						// reset state if session changed
						if (isErrorState && isErrorState != event.session.id){
							isErrorState = 0;
						}

						if (isErrorState){
							// log error
							if (event.label != "Browser Session ended"){
								var workflowname = event.event + ': '+ event.label + ' - ' + getWorkflowAsString(event.workflow);
								//console.log(workflowname);
								//console.log((errorEvent.timestamp-event.timestamp)/1000);
							}

							isErrorState = 0;
						}
					}
				});
				res.json(list);
			});
	}
]);

// --- get a list of sessions with errors
exports.endpoints.push([
	'sessionErrors',
	function(req, res) {

		db.getCollection('log').aggregate([
			{$match: {
				"workflow.dialog": { $in: ["Oops, es ist ein Fehler aufgetreten..."]}
			}},
			{
				$group: {
					_id: '$session.id',
					timestamp: {$first: '$timestamp'},
					session: {$first: '$session'},
					count: {$sum: 1}
				}
			},
			{$sort: {timestamp: -1}}
		], function (err, data) {
			res.json(data);
		});
	}
]);


// --- get time used in workflows
exports.endpoints.push([
	'workflowTimeTotal',
	function(req, res) {
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
					var section = getWorkflowAsString(row.workflow);
					if (sessions[row.session.id]) {
						// update session if section changed or session ended
						var old_section = sessions[row.session.id].section;
						if (old_section != section || row.event == 'session_end') {
							var steptime = row.timestamp - sessions[row.session.id].timestamp;

							// if idle time is more than two minutes, do not record time
							if (steptime > 120*1000){
								steptime = 0;
							}

							// reduce idle times to max 20 seconds
							// user is probably not using the site during that time
							steptime = Math.min(steptime, 20*1000);

							if (!times[old_section]) {
								times[old_section] = steptime;
							} else {
								times[old_section] += steptime;
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
				times[value] = Math.round(times[value] / 1000);
			});

			times = sortObject(times);

			res.json(times);

		});
	}
]);

// --- get exitpoints (last button clicked before dialog close)
exports.endpoints.push([
	'exitpoints',
	function(req, res) {
		db.getCollection('log').aggregate(
			[ { $match : { "event": "click"} }, { $sort : {"session.id": 1, timestamp : 1}} ],
			function (err, events) {

				var exitpoints = {};
				var lastButton = false;
				var lastDialog = '';

				events.forEach(function (event) {

					if (lastButton && event.workflow.dialog[0] != lastDialog){

						// workaround: some clicks were recorded after the close event (-> wrong workflow)
						// if there is a button element or close label, we assume it belongs to the workflow before
						// but this is not really reliable
						var button;
						if (event.label == 'close' || event.element == 'button'){
							button = event.label;
						} else {
							button = lastButton
						}

						// record last button click
						if (!exitpoints[lastDialog]){
							exitpoints[lastDialog] = {};
						}
						if (!exitpoints[lastDialog][button]){
							exitpoints[lastDialog][button] = 1;
						} else {
							exitpoints[lastDialog][button]++;
						}

						//console.log(event.session.id + '; ' + lastDialog + '; ' + button);
						lastButton = false;
					}

					if (event.workflow && event.workflow.dialog[0]){
						if (event.event == 'click'){
							lastButton = event.label;
						}
					}
					lastDialog = event.workflow.dialog[0];
				});


				// CSV Output for Word Export
				/*
				Object.keys(exitpoints).forEach(function(key) {
					Object.keys(exitpoints[key]).forEach(function(key2) {

						console.log(key +';'+ key2 +';'+ exitpoints[key][key2]);
					});
				});
				*/

				res.json(exitpoints);
			}
		)
	}
]);

// --- get list of users
exports.endpoints.push([
	'users',
	function(req, res) {
		db.getCollection('log').distinct('session.userId', function (err, data) {
			res.json(data);
		});
	}
]);

// --- get sessions of a user
exports.endpoints.push([
	'users/:id',
	function(req, res) {
		db.getCollection('log').aggregate(
			[ { $match : { "session.userId" : req.params.id } }, { $sort : { timestamp : 1}} ],
			function (err, data) {
				res.json(data);
			}
		)
	}
]);

// --- get a list of sessions
exports.endpoints.push([
	'sessions',
	function(req, res) {
		db.getCollection('log').aggregate([
			{$sort: {timestamp: 1}},
			{$group: {
				_id: '$session.id',
				timestamp: {$first: '$timestamp'},
				session: {$first: '$session'}
			}}
		], function (err, data) {
			res.json(data);
		})
	}
]);

// --- get session details
exports.endpoints.push([
	'sessions/:id',
	function(req, res) {
		db.getCollection('log').aggregate(
			[ { $match : { "session.id" : req.params.id } }, { $sort : { timestamp : 1}} ],
			function (err, data) {
				res.json(data);
			}
		)
	}
]);

// --- DB Statistics
exports.endpoints.push([
	'statistics',
	function(req, res) {
		var statistics = {};
		// rowCount
		db.getCollection('log').count([],
			function (err, data) {
				statistics['rowCount'] = data;
				// sessionCount
				db.getCollection('log').distinct('session',
					function (err, data) {
						statistics['sessionCount'] = data.length;
						// userCount
						db.getCollection('log').distinct('session.userId',
							function (err, data) {
								statistics['userCount'] = data.length;
								res.json(statistics);
							}
						)
					}
				)
			}
		)
	}
]);


// auto generated documentation (list of endpoints)
exports._documentation = function(req, res){
	var html = '<h3>API Endpoints</h3>';
	for (var i in exports.endpoints){
		html += '<a href="/api/'+exports.endpoints[i][0]+'">'+exports.endpoints[i][0]+'</a><br>';
	}
	res.send(html);
};
