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