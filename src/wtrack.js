

var wTrack = {
	lastEvent: null,
	plugins: [],
	trackedEvents: ['click','focus','blur','keyup','load'],
	init: function(){
		// overwrite global addEventListener Function
		var oldAddEventListener = EventTarget.prototype.addEventListener;
		EventTarget.prototype.addEventListener = function(eventName, eventHandler) {
			oldAddEventListener.call(this, eventName, function(event) {
				eventHandler(event);
				if (wTrack.trackedEvents.indexOf(event.type) >= 0) {
					wTrack.trackEvent(event);
				}
			});
		};

		// adding dummy listeners for all events (otherwise the events aren't triggered)
		for (var idx in this.trackedEvents) {
			document.addEventListener(this.trackedEvents[idx], function (){}, false);
		}
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
		te.element = event.srcElement.tagName;
		te.label = this.getElementLabel(event.srcElement);
		te.coordinates.x = event.x;
		te.coordinates.y = event.y;

		// focus
		if (event.type = 'keyup'){
			if (event.srcElement.tagName != 'INPUT'){
				return;
			}
			te.label = String.fromCharCode(event.keyCode);
		}

		console.log(event);
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
	Queue: {
		push: function(trackedEvent){
			console.log(trackedEvent);
		}
	},
	TrackedEvent: function(event, element, label, coordinates, workflow, step, type, sessionId, screenshotData) {
		this.event = event || null;
		this.element = element || null;
		this.label = label || null;
		this.coordinates = coordinates || {
			x: null,
			y: null
		};
		this.workflow = workflow || null;
		this.step = step || null;
		this.type = type || null;
		this.sessionId = sessionId || null;
		this.screenshotData = screenshotData || null;

		this.timestamp = Date.now();
	}
};

wTrack.init();




// =============== Plugins =================== //

wTrack.registerPlugin('jquery.ui.dialog', true, function(){
	jQuery(window).bind("dialogbeforeclose", function(event, ui) {
		wTrack.Queue.push(new wTrack.TrackedEvent(
			'dialogbeforeclose',
			null,
			'Dialog closed'
		));
	});
	jQuery(window).bind("dialogopen", function(event, ui) {
		wTrack.Queue.push(new wTrack.TrackedEvent(
			'dialogopen',
			null,
			'Dialog opened'
		));
	});
});
