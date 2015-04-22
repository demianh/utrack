
var MongoClient = require('mongodb').MongoClient;

// Establish Database Connection
var db = null;
MongoClient.connect('mongodb://127.0.0.1:27017/wtrack', function(err, connection) {
	if(err) throw err;
	db = connection;

	// workaround to use the same name as Robomongo
	db.getCollection = db.collection;

	var out = function(err, docs) {
		console.log("-------------------------------------------");
		if (err){
			console.log(err);
		} else {
			console.log(docs);
		}
	};



	// ================== Queries ==================

	// --- find by Naviagtion Item
	//db.getCollection('log').find({ 'workflow.mainnav': 'Administration'}, out);

/*
	// --- count event types
	db.getCollection('log').aggregate([
		{ $group: {
			_id: '$event', count: { $sum: 1}
		}},
		{ $sort : { count : -1}}
	], out);


	// --- list actions per tab
	db.getCollection('log').aggregate([
		{ $group: {
		_id: '$workflow.mainnav', count: { $sum: 1}
		}},
		{ $sort : { count : -1}}
	], out);


	// --- main nav clicks
	db.getCollection('log').aggregate([
		{ $match: { event: 'webling_mainnav' } },
		{ $group: {
		_id: '$workflow.mainnav', count: { $sum: 1}
		}},
		{ $sort : { count : -1}}
	], out);
*/


	// --- session duration
	db.getCollection('log').find({ $or: [{'event': 'session_start'}, {'event': 'session_end'}]}).sort({ timestamp: 1 }).toArray(function(err, data){

		//console.log(data);
		var sessions = {};
		var times = [];
		data.forEach(function(row) {
			if(row.session){
				console.log(row.session.id, row.event);
				if (row.event == 'session_start'){
					sessions[row.session.id] = row.timestamp;
				}
				if (row.event == 'session_end'){
					if (sessions[row.session.id]){
						var seconds = Math.round((row.timestamp - sessions[row.session.id]) / 1000);
						times.push(seconds);
					}
				}
			}
		});

		function sortNumber(a,b) {
			return a - b;
		}
		times = times.sort(sortNumber);

		console.log(times);

		var total_time = times.reduce(function(pv, cv) { return pv + cv; }, 0);
		console.log('Total Time: ' + Math.round((total_time)/60/60) + ' hours');
		console.log('Median Time: ' + times[Math.floor(times.length/2)] + ' sec');
		console.log('Average Time: ' + Math.round(total_time/times.length) + ' sec');
		console.log('Samples: ' + times.length);
	});


	// --- section duration
	db.getCollection('log').find({'workflow.mainnav': { $ne: null}}).sort({ timestamp: 1 }).toArray(function(err, data){

		//console.log(data);
		var sessions = {};
		var times = {};
		data.forEach(function(row) {
			if(row.session){
				if(sessions[row.session.id]){
					// update session if section changed or session ended
					var old_section = sessions[row.session.id].section;
					if (old_section != row.workflow.mainnav || row.event == 'session_end'){
						if(!times[old_section]){
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
		Object.keys(times).map(function(value, index) {
			times[value] = Math.round(times[value]/1000) + ' sec';
		});

		console.log(times);
	});

});


