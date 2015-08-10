/*
 * Copyright (c) 2015 Demian Holderegger
 * Licensed under the MIT license.
 */

/**
 * Home Controller, shows some DB statistics
 */

app.controller('HomeCtrl', function($scope, $http) {

	$scope.data = {};

	$http.get('/api/statistics').
		success(function(data, status, headers, config) {
			$scope.data = data;
		}).
		error(function(data, status, headers, config) {
			console.log(status, data);
		});
});
