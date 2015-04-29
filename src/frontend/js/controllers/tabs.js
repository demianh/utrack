app.controller('TabsCtrl', function($scope, $http) {

	$scope.data = {};

	$http.get('/api/tabClicks').
		success(function(data, status, headers, config) {
			$scope.data = data;
			//console.log(data);
		}).
		error(function(data, status, headers, config) {
			console.log(status, data);
		});
});