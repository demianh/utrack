

var wTrack = {
	lastEvent: null,
	plugins: [],
	elementTypes: {
		types: [],
		classes: [],
		maxDepth: 1
	},
	socket: null,
	trackedEvents: ['click','focus','blur','keypress','load'],
	keyboardStack: [],
	trace: [],
	init: function(){
		// overwrite global addEventListener Function
		if (EventTarget){
			var oldAddEventListener = EventTarget.prototype.addEventListener;
			EventTarget.prototype.addEventListener = function(eventName, eventHandler) {
				oldAddEventListener.call(this, eventName, function(event) {
					eventHandler(event);
					if (wTrack.trackedEvents.indexOf(event.type) >= 0) {
						wTrack.trackEvent(event);
					}
				});
			};
		}

		// adding dummy listeners for all events (otherwise the events aren't triggered)
		for (var idx in this.trackedEvents) {
			document.addEventListener(this.trackedEvents[idx], function (){}, false);
		}

		// add on close event
		window.onbeforeunload = function() {
			wTrack.Queue.push(new wTrack.TrackedEvent(
				'session_end',
				'session',
				'Browser Session ended'
			));
		};

		// start socket connection
		this.socket = io('http://localhost:3000');
		wTrack.Queue.push(new wTrack.TrackedEvent(
			'session_start',
			'session',
			'Browser Session started'
		));
	},
	trackEvent: function(event){


		// ignore events that have been logged already
		if (this.lastEvent == event){
			return;
		}
		this.lastEvent = event;

		// log event
		var te = new this.TrackedEvent();
		te.event = event.type;
		te.element = this.getElementType(event.srcElement);
		te.label = this.getElementLabel(event.srcElement);
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
			this.keyboardStack.push(te.data.input);
		}
		if (event.type == 'blur'){
			te.data.input = this.keyboardStack.join('');
			this.keyboardStack = [];
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

		this.Queue.push(te);

	},
	getElementLabel: function(element){
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
	},
	getElementType: function(element){
		// check if element contains any of the classes
		var detectedClass = this.elementHasClassRecursive(element, this.elementTypes.classes, this.elementTypes.maxDepth);

		var elementName = element.tagName;
		if (detectedClass){
			// get custom type for detected class
			for(var idx in this.elementTypes.types){
				if (this.elementTypes.types[idx][1].indexOf(detectedClass) >= 0){
					// overwrite element name with custom type
					elementName = this.elementTypes.types[idx][0];
					break;
				}
			}
		}
		return elementName;
	},
	elementHasClassRecursive: function(element, classNames, depth){
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
			return this.elementHasClassRecursive(element.parentNode, classNames, --depth);
		}
	},
	// register a new plugin
	registerPlugin: function(name, waitForDom, init){
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
	},
	registerElementType: function(type, classNames, searchDepth){
		var depth = searchDepth || 1;
		this.elementTypes.types.push([type, classNames, depth]);

		// rebuild classes list & max search depth
		var classes = [];
		var maxDepth = 1;
		for (var idx in this.elementTypes.types){
			classes = classes.concat(this.elementTypes.types[idx][1]);
			if (this.elementTypes.types[idx][2] > maxDepth){
				maxDepth = this.elementTypes.types[idx][2];
			}
		}
		this.elementTypes.maxDepth = maxDepth;
		this.elementTypes.classes = classes;
	},
	Queue: {
		push: function(trackedEvent){
			wTrack.traceEvent(trackedEvent);

			trackedEvent.workflow = wTrack.trace;

			console.log(trackedEvent);

			// remove event reference before sending
			trackedEvent.data.event = null;
			wTrack.socket.emit('trackedEvent', JSON.stringify(trackedEvent));
		}
	},
	traceEvent: function(trackedEvent){
		function endsWith(str, suffix) {
			return str.indexOf(suffix, str.length - suffix.length) !== -1;
		}

		var event = trackedEvent.event;

		// one level deeper
		if (endsWith(event, '_open')){
			wTrack.trace.push(trackedEvent.label);
		}

		// navigate on same level
		if (endsWith(event, '_nav')){
			wTrack.trace.pop();
			wTrack.trace.push(trackedEvent.label);
		}

		// one level back
		if (endsWith(event, '_close')){
			wTrack.trace.pop();
		}
	},

	TrackedEvent: function(event, element, label, workflow, step, type, sessionId, data) {
		this.event = event || null;
		this.element = element || null;
		this.label = label || null;

		this.workflow = workflow || null;
		this.step = step || null;
		this.type = type || null;
		this.sessionId = sessionId || null;

		this.data = data || {};

		this.timestamp = Date.now();
	}
};

wTrack.init();




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
		var dialogTitle = jQuery(event.target.parentNode.children).find(".ui-dialog-title").text();
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
			'main_nav',
			null,
			wTrack.getElementLabel(event.srcElement)
		));
	});
});


// =============== Custom Elements =================== //

wTrack.registerElementType('button', ['button', 'buttonFirst'], 2);
wTrack.registerElementType('treeNode', ['LibJsV3ComponentWeblingTreeNodeHead']);
wTrack.registerElementType('mainNav', ['weblingMenue'], 4);
wTrack.registerElementType('template', ['templatePreview'], 2);

