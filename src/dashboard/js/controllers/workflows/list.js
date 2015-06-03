/**
 * Workflow List Controller
 */

app.controller('WorkflowsListCtrl', function($scope, $http) {

	$scope.data = {};
	$scope.chartConfig = {};

	$http.get('/api/workflowTimeTotal').
		success(function(data, status, headers, config) {
			$scope.data = data;
			//console.log(data);

			// update chart
			var chartdata = [];
			for (key in $scope.data) {
				chartdata.push([key, $scope.data[key]])
			}
			$scope.chartConfig.series[0].data = chartdata;
		}).
		error(function(data, status, headers, config) {
			console.log(status, data);
		});

	$scope.chartConfig = {
		options: {
			chart: {
				type: 'bar'
			},
			tooltip: {
				style: {
					padding: 10,
					fontWeight: 'bold'
				}
			}
		},
		// The below properties are watched for changes.
		series: [{
			data: []
		}],
		title: {
			text: ''
		},
		loading: false,
		size: {
			width: 400,
			height: 1200
		},
		func: function (chart) {
			// setup some logic for the chart
		}
	};
});