var phantom = require('phantom');

var debug = false;

/**
 * Screenshot Module
 * Generates Screenshots with PhantomJS
 * @returns {{fromHTML: Function}}
 */
var screenshot = function() {

	var renderQueue = [];
	var isRendering = false;
	var page = null;

	// only start phantom once and reuse it for multiple screenshots (faster)
	phantom.create("--web-security=no", "--ignore-ssl-errors=yes", function (ph) {
		ph.createPage(function (newpage) {

			page = newpage;
			page.onResourceRequested(function(requestData, networkRequest){
				// do not load .js files, javascript should not be executed within phantom
				// runs in context of phantom
				var path = requestData['url'].split('?');
				if (path[0].substring(path[0].length - 3, path[0].length) == '.js') {
					//console.log('Aborting loading file: ' + requestData['url']);
					networkRequest.abort();
				} else {
					//console.log('Loading: ' + requestData['url']);
				}
			});

		});
	});

	// Render HTML Markup from Queue
	var render = function(){
		if (!renderQueue.length){
			console.log('Render Queue Empty!');
			return;
		}
		if (!page){
			console.log('Phantom Browser not ready...');
			return;
		}
		if(isRendering){
			console.log('Already rendering...');
			return;
		} else {
			isRendering = true;
		}

		// get data from queue
		var args = renderQueue.shift();
		var data = args[0];
		var filename = args[1];

		console.log("Generating Screenshot "+filename+"...");

		if (debug){
			var fs = require('fs');
			fs.writeFile(filename + '.html', data.html, function(err) {
				if(err) {
					console.log(err);
				}
			});
		}

		page.set('viewportSize', {width: data.screenWidth, height: data.screenHeight}, function(){
			page.set('clipRect', {top:0,left:0, width:data.screenWidth, height:data.screenHeight}, function(){

				// prepare content, remove script tags. Javascript should not be executed within phantom
				var html = data.html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

				page.set('content', html, function(){

					// wait for webpage to be loaded
					setTimeout(function(){
						page.evaluate(
							function (data) {
								// adding a click highlighter to mark the click position
								var clickHighlighter = document.createElement('div');
								clickHighlighter.style.cssText = 'position:absolute;width:20px;height:20px;border-radius:10px;opacity:0.5;z-index:99999999;background:#F00;';
								clickHighlighter.style.top = data.coordinates.y + data.scrollTop - 10 + 'px';
								clickHighlighter.style.left = data.coordinates.x + data.scrollLeft - 10 + 'px';
								document.body.appendChild(clickHighlighter);
								return data;
							},
							function (result) {
								page.set('scrollPosition', {top: data.scrollTop, left: data.scrollLeft}, function(){
									page.render(filename, {}, function(){
										console.log('rendering done: ' + filename);

										// render next screenshot
										isRendering = false;
										render();
									});
								});
							},
							data
						);
					}, 15 * 1000); // wait 15 seconds for page to be completely loaded
				});
			});
		});
	};

	return {
		/**
		 * Generate Image from HTML source. External resources are loaded except *.js files
		 * @param {object} data - conatains all screenshot data (html, screenWidth, screenHeight, scrollTop, scrollLeft)
		 * @param {string} filename - filename where the image is stored
		 */
		fromHTML: function(data, filename){
			// Adding HTML to the render Queue
			renderQueue.push([data, filename]);
			render();
		}
	}
};

module.exports = screenshot;
