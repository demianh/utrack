/*
 * Copyright (c) 2015 Demian Holderegger
 * Licensed under the MIT license.
 */

/**
 * Sessions List Controller
 */

app.controller('SessionsListCtrl', function($scope, $http) {

	$scope.data = {};

	$http.get('/api/sessions').
		success(function(data, status, headers, config) {
			$scope.data = data;
		}).
		error(function(data, status, headers, config) {
			console.log(status, data);
		});
});