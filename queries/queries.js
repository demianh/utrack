
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



	// ================== Query Testing ==================


	// --- get time used in workflows
	db.getCollection('log').aggregate([
		{ $match: {
			$or: [{ event: "dialog_open" }, { event: "dialog_close" }]
		}},
		{ $project: {
			'workflow': '$workflow',
			'event': '$event',
			'session': '$session',
			'timestamp': '$timestamp'
		}},
		{ $sort : { timestamp : 1}}
	], function(err, data){
		console.log(data);


		var sessions = {};
		var times = {};
		data.forEach(function(row) {
			if(row.session){
				var section = [row.workflow.mainnav, row.workflow.subnav, row.workflow.dialog.join(' / ')].join(' / ');
				if(sessions[row.session.id]){
					// update session if section changed or session ended
					var old_section = sessions[row.session.id].section;
					if (old_section != section || row.event == 'session_end'){
						if(!times[old_section]){
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
		Object.keys(times).map(function(value, index) {
			times[value] = Math.round(times[value]/1000) + ' sec';
		});

		console.log(times);

	});


});


