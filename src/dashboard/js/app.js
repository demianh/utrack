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
			templateUrl: "templates/home.html",
			controller: "HomeCtrl"
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
			controller: "StatisticsTabsCtrl"
		})
		.state('tabusage', {
			url: "/statistics/tabusage",
			templateUrl: "templates/statistics/tabusage.html",
			controller: "StatisticsTabusageCtrl"
		})
		.state('tabtime', {
			url: "/statistics/tabtime",
			templateUrl: "templates/statistics/tabtime.html",
			controller: "StatisticsTabtimeCtrl"
		})
		.state('workflows-list', {
			url: "/workflows/list",
			templateUrl: "templates/workflows/list.html",
			controller: "WorkflowsListCtrl"
		})
		.state('sessions-details', {
			url: "/sessions/:id",
			templateUrl: "templates/sessions/details.html",
			controller: "SessionsDetailsCtrl"
		})
		.state('sessions-errors', {
			url: "/sessionerrors",
			templateUrl: "templates/sessions/listerrors.html",
			controller: "SessionsListErrorsCtrl"
		})
		.state('sessions', {
			url: "/sessions",
			templateUrl: "templates/sessions/list.html",
			controller: "SessionsListCtrl"
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