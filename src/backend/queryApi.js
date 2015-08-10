/*
 * Copyright (c) 2015 Demian Holderegger
 * Licensed under the MIT license.
 */

// This file contains all REST API functions and definitions


// Establish Database Connection
var db = null;
var MongoClient = require('mongodb').MongoClient;
MongoClient.connect('mongodb://127.0.0.1:27017/wtrack', function(err, connection) {
	if(err) throw err;
	db = connection;

	// workaround to use the same name as Robomongo
	db.getCollection = db.collection;

});

exports.endpoints = [];

// ================== Helper Functions =========
/**
 * Converts a workflow object into a human readable text
 * @param {object} workflow - object of workflow as received from the database
 * @param {boolean} ignoreFirst - if true, the mainnav will be replaced with *
 * @param {boolean} ignoreSecond - if true, the subnav will be replaced with *
 * @returns {string}
 */
function getWorkflowAsString(workflow, ignoreFirst, ignoreSecond){
	return [
		(ignoreFirst ? '*': workflow.mainnav),
		(ignoreSecond ? '*': workflow.subnav),
		workflow.dialog.join(' / ')
	].join(' / ');
}
/**
 * Sort a javascript object by key value.
 * Note that JavaScript objects are not ordered, but in some cases, the order is respected.
 * @param {object} obj - object to sort
 * @returns {{string}} - sorted object
 */

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

exports.endpoints.push([
	'eventTypes',
	'list of all event types, sorted by number of uses',
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
	'count actions per tab',
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

exports.endpoints.push([
	'tabClicks',
	'click count of main navigation',
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

exports.endpoints.push([
	'tabDuration',
	'time spent per tab (minutes)',
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

exports.endpoints.push([
	'sessionDuration',
	'session duration statistics',
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

exports.endpoints.push([
	'workflowList',
	'list of all workflows, including count of event per workflow',
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

exports.endpoints.push([
	'workflowBeforeErrors',
	'a list of actions that happened before an error',
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

exports.endpoints.push([
	'sessionErrors',
	'a list of sessions with errors',
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

exports.endpoints.push([
	'workflowTimeTotal',
	'time spent in each workflow (seconds)',
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

exports.endpoints.push([
	'exitpoints',
	'exitpoints (last button clicked before dialog closed / workflow ended)',
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


				// CSV Output for Excel Export
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

exports.endpoints.push([
	'firstworkflows',
	'first workflows started by new users',
	function(req, res) {

		// data cleanup, ignore these workflows
		var ignoredWorkflows = ['Block zur Startseite hinzufügen','Block entfernen','Oops, es ist ein Fehler aufgetreten...'];

		db.getCollection('log').aggregate(
			[ { $match : {} }, { $sort : {"session.userId": 1, timestamp : 1}} ],
			function (err, events) {

				var workflows = {};
				var oldUserId = false;
				var userWorkflowFound = false;

				events.forEach(function (event) {

					// new user, reset found workflow
					if (event.session.userId != oldUserId) {
						userWorkflowFound = false;
					}

					if (userWorkflowFound === false && event.workflow.dialog[0]){
						var dialog = event.workflow.dialog[0];

						if (ignoredWorkflows.indexOf(dialog) < 0){
							var workflow_str = getWorkflowAsString(event.workflow, false, true);
							if (!workflows[workflow_str]){
								workflows[workflow_str] = 1;
							} else {
								workflows[workflow_str]++;
							}
							userWorkflowFound = true;
						}
					}
					oldUserId = event.session.userId;
				});

				workflows = sortObject(workflows);

				/*
				// CSV Output for Excel Export
				Object.keys(workflows).forEach(function(key) {
					console.log(key +';'+ workflows[key]);
				});
				*/

				res.json(workflows);
			}
		)
	}
]);

exports.endpoints.push([
	'users',
	'list of user ids',
	function(req, res) {
		db.getCollection('log').distinct('session.userId', function (err, data) {
			res.json(data);
		});
	}
]);

exports.endpoints.push([
	'users/:id',
	'list all events of a user',
	function(req, res) {
		db.getCollection('log').aggregate(
			[ { $match : { "session.userId" : req.params.id } }, { $sort : { timestamp : 1}} ],
			function (err, data) {
				res.json(data);
			}
		)
	}
]);

exports.endpoints.push([
	'sessions',
	'a list of all sessions',
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

exports.endpoints.push([
	'sessions/:id',
	'events of a session',
	function(req, res) {
		db.getCollection('log').aggregate(
			[ { $match : { "session.id" : req.params.id } }, { $sort : { timestamp : 1}} ],
			function (err, data) {
				res.json(data);
			}
		)
	}
]);

exports.endpoints.push([
	'statistics',
	'database statistics',
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


// auto generated documentation (list of endpoints and description)
exports._documentation = function(req, res){
	var html = '<h3>REST API Endpoints</h3>';
	for (var i in exports.endpoints){
		html += '<b><a href="/api/'+exports.endpoints[i][0]+'">/api/'+exports.endpoints[i][0]+'</a></b>' +
			'<br>'+exports.endpoints[i][1]+'<br><br>';
	}
	res.send(html);
};
