var phantom = require('phantom');
var fs = require('fs');
var url = require('url');

var debug = false;

var screenshot = function() {
	return {
		fromHTML: function(html, filename){
			console.log("Generating Screenshot "+filename+"...");

			if (debug){
				fs.writeFile(filename + '.html', html, function(err) {
					if(err) {
						console.log(err);
					}
				});
			}

			phantom.create("--web-security=no", "--ignore-ssl-errors=yes", function (ph) {
				ph.createPage(function (page) {

					page.set('onResourceRequested', function(requestData, networkRequest){
						//console.log(requestData, networkRequest);
						//console.log(requestData['url'], networkRequest);

						var path = url.parse(requestData['url']).pathname
						if (false && path.substring(path.length - 3, path.length) == '.js') {
							console.log('Disabling JavaScript files. Aborting: ' + requestData['url']);
							/* NOT WORKING!!
							networkRequest['abort()']();
							if(networkRequest.abort){

								networkRequest.abort();
							}
							*/
						}
					});

					page.set('onResourceReceived', function (res) {
						console.log("Resource received: "+res.url)
					})

					page.set('viewportSize', {width:1280,height:900}, function(){
						page.set('clipRect', {top:0,left:0,width:1280,height:900}, function(){

							page.set('content', html, function(){

								// wait for webpage to be loaded
								setTimeout(function(){
									page.render(filename, function(finished){
										console.log('rendering done');
										ph.exit();
									});
								}, 10*1000);
							});
						});
					});
				});
			});
		}
	}
};

module.exports = screenshot;
