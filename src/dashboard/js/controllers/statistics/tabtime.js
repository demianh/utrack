/**
 * Tab Time Controller
 */

app.controller('StatisticsTabtimeCtrl', function($scope, $http) {

	$scope.data = {};
	$scope.chartConfig = {};

	$http.get('/api/tabDuration').
		success(function(data, status, headers, config) {
			$scope.data = data;
			//console.log(data);

			// update chart
			var chartdata = [];
			Object.keys($scope.data).forEach(function(key) {
				chartdata.push([key,$scope.data[key]])
			});
			$scope.chartConfig.series[0].data = chartdata;
		}).
		error(function(data, status, headers, config) {
			console.log(status, data);
		});

	$scope.chartConfig = {
		options: {
			chart: {
				type: 'pie'
			},
			tooltip: {
				style: {
					padding: 10,
					fontWeight: 'bold'
				}
			},
			plotOptions: {
				pie: {
					dataLabels: {
						enabled: true
					},
					showInLegend: true
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
			height: 400
		},
		func: function (chart) {
			// setup some logic for the chart
		}
	};
});