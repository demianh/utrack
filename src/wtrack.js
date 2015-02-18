
var oldAddEventListener = EventTarget.prototype.addEventListener;

EventTarget.prototype.addEventListener = function(eventName, eventHandler) {
	oldAddEventListener.call(this, eventName, function(event) {
		eventHandler(event);
		if (event.type != 'mousemove'){

			var te = new TrackedEvent();
			te.event = event.type;
			te.element = event.srcElement.tagName;
			te.label = event.srcElement.innerText;
			te.coordinates.x = event.x;
			te.coordinates.y = event.y;

			console.log(te, event);
			//event.srcElement.classList.add("wtrack-event");
		}
	});
};

function TrackedEvent() {
	this.event = null;
	this.element = null;
	this.label = null;
	this.coordinates = {
		x: null,
		y: null
	};
	this.workflow = null;
	this.step = null;
	this.type = null;
	this.sessionId = null;
	this.screenshotId = null;

	this.timestamp = Date.now();
}