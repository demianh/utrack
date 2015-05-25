app.controller('StatisticsTabusageCtrl', function($scope, $http) {

	$scope.data = {};
	$scope.chartConfig = {};

	$http.get('/api/tabActions').
		success(function(data, status, headers, config) {
			$scope.data = data;
			//console.log(data);

			// update chart
			var chartdata = [];
			$scope.data.forEach(function(entry) {
				chartdata.push([entry['_id'],entry['count']])
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