/*
 * Copyright (c) 2015 Demian Holderegger
 * Licensed under the MIT license.
 */

/**
 * Session Details Controller
 */

app.controller('SessionsDetailsCtrl', function($scope, $stateParams, $http) {

	var id = $stateParams.id;

	$scope.data = {};

	$scope.sessionStartTime = 0;
	$scope.Math = window.Math;

	$http.get('/api/sessions/'+id).
		success(function(data, status, headers, config) {
			$scope.data = data;
			if($scope.data.length > 0){
				$scope.sessionStartTime = $scope.data[0].timestamp;
			}
			console.log(data);
		}).
		error(function(data, status, headers, config) {
			console.log(status, data);
		});
});