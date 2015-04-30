

var wTrack = (function() {
	var appId = null;
	var userId = null;
	var sessionId = null;
	var lastEvent = null;
	var lastLog = null;
	var plugins = [];
	var getters = {};
	var elementTypes = {
		types: [],
		classes: [],
		maxDepth: 1
	};
	var socket = null;
	var trackedEvents = ['click','focus','blur','keypress','load'];
	var keyboardStack = [];
	var trace = {
		mainnav: null,
		subnav: null,
		dialog: []
	};

	var init = function(options){
		sessionId = generateGuid();
		appId = (options ? (options.appId || null) : null );
		userId = getCookie('wTrackUserId');
		if (!userId) {
			userId = generateGuid();
			setCookie('wTrackUserId', userId);
		}

		// overwrite global addEventListener Function
		if (EventTarget){
			var oldAddEventListener = EventTarget.prototype.addEventListener;
			EventTarget.prototype.addEventListener = function(eventName, eventHandler) {
				oldAddEventListener.call(this, eventName, function(event) {
					eventHandler(event);
					if (trackedEvents.indexOf(event.type) >= 0) {
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
		//socket = io('http://localhost:3000');
		socket = io('https://log.usystems.ch:3000');
		Queue.push(new TrackedEvent(
			'session_start',
			'session',
			'Browser Session started'
		));
	};

	var generateGuid = function(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	};

	var trackEvent = function(event){

		// ignore events that have been logged already
		if (lastEvent == event){
			return;
		}
		lastEvent = event;

		// log event
		var te = new TrackedEvent();
		te.event = event.type;
		te.element = getElementType(event.srcElement);
		te.label = getElementLabel(event.srcElement);
		if (event.x){
			te.data.coordinates = {x: event.x, y: event.y};
		}

		// for debug purposes
		te.data.event = event;

		// focus
		if (event.type == 'keypress'){
			if (event.srcElement.tagName != 'INPUT'){
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

	var setCookie = function(cname, cvalue) {
		var d = new Date();
		d.setTime(d.getTime() + (5*365*24*60*60*1000));
		document.cookie = cname + "=" + cvalue + "; " + "expires="+d.toUTCString();
	};

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

	// register a new plugin
	var registerPlugin = function(name, waitForDom, init){
		if(!waitForDom || document.readyState === "complete") {
			init();
			console.log('wTrack plugin loaded: '+name);
		} else {
			// wait until dom is loaded
			document.addEventListener("DOMContentLoaded", function () {
				init();
				console.log('wTrack plugin loaded: '+name);
			}, false);
		}
	};

	// register a new getter
	var registerGetter = function(name, func){
		if (typeof func == "function"){
			getters[name] = func;
			console.log('wTrack getter loaded: '+name);
		} else {
			console.error('wTrack getter expects a function: '+name);
		}
	};

	// call a getter
	var callGetter = function(name){
		var value;
		//debugger;
		if (typeof getters[name] !== "undefined"){
			value = getters[name]();
		}
		console.log('wTrack getter "'+name+'": '+value);
		return value;
	};

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

		console.log(trace);
	};

	var getLastLog = function(){
		return lastLog;
	};

	var Queue = {
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
			trackedEvent.appId = appId;

			lastLog = trackedEvent;
			console.log(trackedEvent);

			// remove event reference before sending
			trackedEvent.data.event = null;
			socket.emit('trackedEvent', JSON.stringify(trackedEvent));
		}
	};

	var TrackedEvent = function(event, element, label, workflow, step, type, data) {
		this.event = event || null;
		this.element = element || null;
		this.label = label || null;

		this.workflow = workflow || null;
		this.step = step || null;
		this.type = type || null;

		this.data = data || {};

		this.session = {
			id: sessionId || null,
			userId: userId || null,
			userAgent: navigator.userAgent
		};

		this.timestamp = Date.now();
	};

	// Public API
	return {
		init: init,
		registerPlugin: registerPlugin,
		registerGetter: registerGetter,
		registerElementType: registerElementType,
		getLastLog: getLastLog,

		TrackedEvent: TrackedEvent,
		Queue: Queue,
		// TODO : remove this from public api
		getElementLabel: getElementLabel
	};
})();

wTrack.init({appId: 'demo'});




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

		// remove numbers from titles to make them comparable
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
			wTrack.getElementLabel(event.srcElement)
		));
	});
});

wTrack.registerPlugin('webling.subnav', true, function(){
	jQuery(document).on('click', '.LibJsV3ComponentViewerPanelList li.LibJsV3ComponentWeblingTreeNodeHead > div, .splitviewMenue li > div', function(event) {
		wTrack.Queue.push(new wTrack.TrackedEvent(
			'webling_subnav',
			null,
			wTrack.getElementLabel(event.srcElement)
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
wTrack.registerElementType('treeNode', ['LibJsV3ComponentWeblingTreeNodeHead']);
wTrack.registerElementType('mainNav', ['weblingMenue'], 4);
wTrack.registerElementType('template', ['templatePreview'], 2);

