'use strict';

var app = angular.module('wTrack', ['ui.router', 'highcharts-ng']);

app.config(function($stateProvider, $urlRouterProvider) {
	//
	// For any unmatched url, redirect to /state1
	$urlRouterProvider.otherwise("/");
	//
	// Now set up the states
	$stateProvider
		.state('home', {
			url: "/",
			templateUrl: "templates/home.html"
		})
		.state('logs', {
			url: "/logs",
			templateUrl: "templates/logs.html"
		})
		.state('statistics', {
			url: "/statistics",
			templateUrl: "templates/statistics/tabs.html"
		})
		.state('tabs', {
			url: "/statistics/tabs",
			templateUrl: "templates/statistics/tabs.html",
			controller: "TabsCtrl"
		})
		.state('usage', {
			url: "/statistics/usage",
			templateUrl: "templates/statistics/usage.html",
			controller: "UsageCtrl"
		})
		.state('workflows', {
			url: "/statistics/workflows",
			templateUrl: "templates/statistics/workflows.html",
			controller: "WorkflowsCtrl"
		});
});


/*
var socket = io('http://localhost:3000');
socket.on('trackedEvent', function(msg){
	var data = JSON.parse(msg);
	$('#messages').prepend($('<li>' +
	'<i class="fa fa-dot-circle-o bg-blue"></i>' +
	'<div class="timeline-item">' +
		'<h3 class="timeline-header">' +
		data.event + ' on ' + data.label +
		'</h3>' +
		'<div class="timeline-body">' +
		msg +
		(data.data.screenshotUrl ? '<br><a href="../backend/'+data.data.screenshotUrl+'" target="_blank">Screenshot</a>' : '') +
		'</div>' +
	'</div>' +
	'</li>'));
});
	*/