

var wTrack = (function() {

	/*** Options ***/

	/**
	 * list of event types that are tracked
	 * @type {string[]}
	 */
	var trackedEvents = ['click','focus','blur','keypress','load'];

	/**
	 * URL to server where the server.js is running
	 * @type {string}
	 */
	var remoteUrl = 'https://log.usystems.ch:3000';

	/**
	 * enable verbose console log output
	 * @type {boolean}
	 */
	var debug = false;


	/*** Local Variables ***/

	var appId = null;
	var userId = null;
	var sessionId = null;
	var lastEvent = null;
	var lastLog = null;
	var getters = {};
	var elementTypes = {
		types: [],
		classes: [],
		maxDepth: 1
	};
	var socket = null;
	var keyboardStack = [];
	var trace = {
		mainnav: null,
		subnav: null,
		dialog: []
	};

	/*** Local Functions ***/

	/**
	 * wTrack initialization
	 * @param {object} options - init options, currently supported: {string} appId - unique application identifier
	 */
	var init = function(options){
		sessionId = generateGuid();
		appId = (options ? (options.appId || null) : null );
		userId = getCookie('wTrackUserId');
		if (!userId) {
			userId = generateGuid();
			setCookie('wTrackUserId', userId);
		}

		// overwrite global addEventListener function with own function
		if (EventTarget){
			var oldAddEventListener = EventTarget.prototype.addEventListener;
			EventTarget.prototype.addEventListener = function(eventName, eventHandler) {
				oldAddEventListener.call(this, eventName, function(event) {
					// call the event handler, equal to the original function
					eventHandler(event);
					// check if this type of event is tracked
					if (trackedEvents.indexOf(event.type) >= 0) {
						// track event and enrich with more data
						trackEvent(event);
					}
				});
			};
		}

		// adding dummy listeners for all events (otherwise the events aren't triggered)
		for (var idx in trackedEvents) {
			document.addEventListener(trackedEvents[idx], function (){}, false);
		}

		// add on close event
		window.onbeforeunload = function() {
			Queue.push(new TrackedEvent(
				'session_end',
				'session',
				'Browser Session ended'
			));
		};

		// start socket connection
		socket = io(remoteUrl);
		Queue.push(new TrackedEvent(
			'session_start',
			'session',
			'Browser Session started'
		));
	};

	/**
	 * generate rfc4122 version 4 compliant guid
	 * @returns {string|*} guid
	 */
	var generateGuid = function(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	};

	/**
	 * enriches the event data with additional data
	 * @param {Event} event - Source event object
	 */
	var trackEvent = function(event){

		// ignore events that have been logged already
		if (lastEvent == event){
			return;
		}
		lastEvent = event;
		event.target = event.target || event.srcElement;

		// log event
		var te = new TrackedEvent();
		te.event = event.type;
		te.element = getElementType(event.target);
		te.label = getElementLabel(event.target);
		if (event.x){
			te.data.coordinates = {x: event.x, y: event.y};
		}

		// for debug purposes
		te.data.event = event;

		// focus
		if (event.type == 'keypress'){
			if (event.target.tagName != 'INPUT'){
				return;
			}
			te.data.input = String.fromCharCode(event.charCode);
			keyboardStack.push(te.data.input);
		}
		if (event.type == 'blur'){
			te.data.input = keyboardStack.join('');
			keyboardStack = [];
		}

		if (event.type == 'click'){

			// convert properties to attributes in inputs
			var elems = document.getElementsByTagName("input");
			for(var i = 0; i < elems.length; i++) {
				// set attribute to property value
				elems[i].setAttribute("value", elems[i].value);
			}

			// Add Full Body HTML
			te.data.html = document.documentElement.outerHTML;

			// Screen Measurements
			var html = document.documentElement;
			te.data.screenWidth = Math.max(html.clientWidth, window.innerWidth || 0);
			te.data.screenHeight = Math.max(html.clientHeight, window.innerHeight || 0);
			te.data.scrollTop = (window.pageYOffset || html.scrollTop)  - (html.clientTop || 0);
			te.data.scrollLeft = (window.pageXOffset || html.scrollLeft) - (html.clientLeft || 0);
		}

		Queue.push(te);

	};

	/**
	 * tries to get any text that is suitable as an element label
	 * @param {HTMLElement} element - source html element
	 */
	var getElementLabel = function(element){
		var parseElement = function(element){
			if (element.innerText){
				return element.innerText;
			}
			if (element.textContent){
				return element.textContent;
			}
			if (element.title){
				return element.title;
			}
			if (element.placeholder){
				return element.placeholder;
			}
			if (element.alt){
				return element.alt;
			}
			if (element.name){
				return element.name;
			}
			if (element.value){
				return element.value;
			}

			// check siblings
			if(element.previousSibling && element.previousSibling.innerText){
				return element.previousSibling.innerText;
			}
			if(element.previousSibling && element.previousSibling.textContent){
				return element.previousSibling.textContent;
			}
			if(element.nextSibling && element.nextSibling.innerText){
				return element.nextSibling.innerText;
			}
			if(element.nextSibling && element.nextSibling.textContent){
				return element.nextSibling.textContent;
			}
		};

		var label = parseElement(element);
		if (label){
			label = label.trim();
			if (label.length > 100){
				label = label.substring(0,97) + '...';
			}
		}
		return label;
	};

	/**
	 * get element type and check for registered custom elements
	 * @param {HTMLElement} element - source html element
	 * @returns {string}
	 */
	var getElementType = function(element){
		// check if element contains any of the classes
		var detectedClass = elementHasClassRecursive(element, elementTypes.classes, elementTypes.maxDepth);

		var elementName = element.tagName;
		if (detectedClass){
			// get custom type for detected class
			for(var idx in elementTypes.types){
				if (elementTypes.types[idx][1].indexOf(detectedClass) >= 0){
					// overwrite element name with custom type
					elementName = elementTypes.types[idx][0];
					break;
				}
			}
		}
		return elementName;
	};

	/**
	 * checks parent elements recursively for classes
	 * @param {HTMLElement} element - source html element
	 * @param {string[]} classNames - array of classes to check for
	 * @param {int} depth - current search depth
	 * @returns {boolean}
	 */
	var elementHasClassRecursive = function(element, classNames, depth){
		if (!element || depth <= 0){
			return false;
		}
		if (element.classList){
			for(var idx in classNames){
				if (Array.prototype.indexOf.call(element.classList, classNames[idx]) >= 0){
					return classNames[idx];
				}
			}
		}
		// class not found, check parent element
		if (classNames){
			return elementHasClassRecursive(element.parentNode, classNames, --depth);
		}
	};

	/**
	 * set cookie
	 * @param {string} cname - cookie name
	 * @param {string} cvalue - cookie value
	 */
	var setCookie = function(cname, cvalue) {
		var d = new Date();
		d.setTime(d.getTime() + (5*365*24*60*60*1000));
		document.cookie = cname + "=" + cvalue + "; " + "expires="+d.toUTCString();
	};

	/**
	 * get cookie
	 * @param {string} cname - cookie name
	 * @returns {string}
	 */
	var getCookie = function(cname) {
		var name = cname + "=";
		var ca = document.cookie.split(';');
		for(var i=0; i<ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1);
			if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
		}
		return "";
	};

	/**
	 * register a new plugin
	 * @param {string} name - plugin identifier
	 * @param {boolean} waitForDom - set true if initialization should wait until DOM is loaded
	 * @param {function} init - plugin init function
	 */
	var registerPlugin = function(name, waitForDom, init){
		if(!waitForDom || document.readyState === "complete") {
			init();
			if(debug) console.log('wTrack plugin loaded: '+name);
		} else {
			// wait until dom is loaded
			document.addEventListener("DOMContentLoaded", function () {
				init();
				if(debug) console.log('wTrack plugin loaded: '+name);
			}, false);
		}
	};

	/**
	 * register a new custom getter
	 * getters can be used to inject application specific information
	 * @param {string} name - name of the getter (currently supported: mainnav, subnav)
	 * @param {function} func - getter callback function
	 */
	var registerGetter = function(name, func){
		if (typeof func == "function"){
			getters[name] = func;
			if(debug) console.log('wTrack getter loaded: '+name);
		} else {
			console.error('wTrack getter expects a function: '+name);
		}
	};


	/**
	 * call a getter by name
	 * @param {string} name - getter name
	 * @returns {string|null}
	 */
	var callGetter = function(name){
		var value = null;
		if (typeof getters[name] !== "undefined"){
			value = getters[name]();
		}
		if(debug) console.log('wTrack getter "'+name+'": '+value);
		return value;
	};

	/**
	 * register a custom element type
	 * this can be used to introduce own application specific element types
	 * e.g elements that are marked with a class <span class="button">
	 * instead of using a tag <button> can be rewritten
	 * @param {string} type - the name of the new type
	 * @param {string[]} classNames - array of classes to search for
	 * @param {int} searchDepth - how many levels to search for (starting at source element, going up the parents)
	 */
	var registerElementType = function(type, classNames, searchDepth){
		var depth = searchDepth || 1;
		elementTypes.types.push([type, classNames, depth]);

		// rebuild classes list & max search depth
		var classes = [];
		var maxDepth = 1;
		for (var idx in elementTypes.types){
			classes = classes.concat(elementTypes.types[idx][1]);
			if (elementTypes.types[idx][2] > maxDepth){
				maxDepth = elementTypes.types[idx][2];
			}
		}
		elementTypes.maxDepth = maxDepth;
		elementTypes.classes = classes;
	};

	/**
	 * Build the trace by processing the events
	 * @param {TrackedEvent} trackedEvent - the tracked event
	 */
	var traceEvent = function(trackedEvent){
		function endsWith(str, suffix) {
			return str.indexOf(suffix, str.length - suffix.length) !== -1;
		}

		var event = trackedEvent.event;

		// mainnav
		if (endsWith(event, '_mainnav')){
			trace.mainnav = trackedEvent.label;
			// Reset Subnav
			trace.subnav = null;
		}

		// subnav
		if (endsWith(event, '_subnav')){
			trace.subnav = trackedEvent.label;
		}

		// one level deeper
		if (endsWith(event, '_open')){
			trace.dialog.push(trackedEvent.label);
		}

		// navigate on same level
		if (endsWith(event, '_nav')){
			trace.dialog.pop();
			trace.dialog.push(trackedEvent.label);
		}

		// one level back
		if (endsWith(event, '_close')){
			trace.dialog.pop();
		}

		if(debug) console.log(trace);
	};

	/**
	 * The Event Queue which receives events and sends them to the backend
	 * @type {{push: Function}} - receives a TrackedEvent object and sends it to the backend
	 */
	var Queue = {
		// push elements into the queue and send to the backend.
		push: function(trackedEvent){
			traceEvent(trackedEvent);

			// try to get workflow info if not avilable
			if (!trace.mainnav){
				trace.mainnav = callGetter('mainnav');
			}
			if (!trace.subnav){
				trace.subnav = callGetter('subnav');
			}

			trackedEvent.workflow = trace;

			lastLog = trackedEvent;
			if(debug) console.log(trackedEvent);

			// remove event reference before sending
			trackedEvent.data.event = null;
			socket.emit('trackedEvent', JSON.stringify(trackedEvent));
		}
	};

	/**
	 * TrackedEvent Object which contains all data that is beeing sent to the backend
	 * @param {string} event - event name
	 * @param {string} element - tag name of source element
	 * @param {string} label - text, label, title or description of element
	 * @param {object} workflow - worflow object
	 * @param {object} data - additional event data (e.g html source, sizes etc.)
	 * @constructor
	 */
	var TrackedEvent = function(event, element, label, workflow, data) {
		this.event = event || null;
		this.element = element || null;
		this.label = label || null;
		this.workflow = workflow || null;
		this.data = data || {};

		this.session = {
			id: sessionId || null,
			userId: userId || null,
			appId: appId || null,
			userAgent: navigator.userAgent
		};

		this.timestamp = Date.now();
	};

	/*** Expose Public API Functions ***/

	return {
		init: init,
		registerPlugin: registerPlugin,
		registerGetter: registerGetter,
		registerElementType: registerElementType,
		TrackedEvent: TrackedEvent,
		Queue: Queue,
		// TODO : remove this from public api
		getElementLabel: getElementLabel
	};
})();

wTrack.init({appId: window.location.hostname});




// =============== Plugins =================== //

wTrack.registerPlugin('jquery.ui.dialog', true, function(){
	jQuery(window).bind("dialogbeforeclose", function(event, ui) {
		wTrack.Queue.push(new wTrack.TrackedEvent(
			'dialog_close',
			'dialog',
			'Dialog closed'
		));
	});
	jQuery(window).bind("dialogopen", function(event, ui) {
		// getting the dialog title is kind of an ugly hack
		var dialogTitle = jQuery(event.target.parentNode.children).find(".ui-dialog-title").text().trim();

		if (dialogTitle.length < 1){
			dialogTitle = '[untitled]';
		}

		// remove numbers from titles and replace with X to make the strings comparable
		dialogTitle = dialogTitle.replace(/[0-9]+/g, "X");

		wTrack.Queue.push(new wTrack.TrackedEvent(
			'dialog_open',
			'dialog',
			dialogTitle
		));
	});
});

wTrack.registerPlugin('webling.mainnav', true, function(){
	jQuery(document).on('click', '.weblingMenue > div > div', function(event) {
		wTrack.Queue.push(new wTrack.TrackedEvent(
			'webling_mainnav',
			null,
			wTrack.getElementLabel(event.target || event.srcElement)
		));
	});
});

wTrack.registerPlugin('webling.subnav', true, function(){
	jQuery(document).on('click', '.LibJsV3ComponentViewerPanelList li.LibJsV3ComponentWeblingTreeNodeHead > div, .splitviewMenue li > div', function(event) {
		wTrack.Queue.push(new wTrack.TrackedEvent(
			'webling_subnav',
			null,
			wTrack.getElementLabel(event.target || event.srcElement)
		));
	});
});


// =============== Getters =================== //

wTrack.registerGetter('mainnav', function(){
	return jQuery('.weblingMenue > div > div.selected').text();
});

wTrack.registerGetter('subnav', function(){
	var subnav;

	// Member, Material, Webseite, Dokumente, Administration
	subnav = jQuery('.LibJsV3ComponentViewerPanelList li.LibJsV3ComponentWeblingTreeNodeHead > div.LibJsV3ComponentWeblingTreeNodeSelected:visible').text().trim();
	if (subnav){
		return subnav;
	}

	// Buchhaltung
	subnav = jQuery('.splitviewMenue li.selected > div:visible').text().trim();
	if (subnav){
		return subnav;
	}

	return subnav;
});


// =============== Custom Elements =================== //

wTrack.registerElementType('button', ['button', 'buttonFirst'], 2);
wTrack.registerElementType('treeNode', ['LibJsV3ComponentWeblingTreeNodeHead'], 1);
wTrack.registerElementType('mainNav', ['weblingMenue'], 4);
wTrack.registerElementType('template', ['templatePreview'], 2);
