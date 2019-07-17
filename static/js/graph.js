queue()
   .defer(d3.json, "/donorsUS/projects")
    .defer(d3.json, "/donorsUS/states")
   .await(makeGraphs);

function makeGraphs(error, projectsJson, statesJSON) {

    var stateJson = statesJSON;

   //Clean projectsJson data
   var donorsUSProjects = projectsJson;
   var dateFormat = d3.time.format("%Y-%m-%d %H:%M:%S");
   donorsUSProjects.forEach(function (d) {
       d["date_posted"] = dateFormat.parse(d["date_posted"]);
       d["date_posted"].setDate(1);
       d["total_donations"] = +d["total_donations"];
   });

   //Create a Crossfilter instance
   var ndx = crossfilter(donorsUSProjects);

   //Define Dimensions
   var dateDim = ndx.dimension(function (d) {
       return d["date_posted"];
   });
   var resourceTypeDim = ndx.dimension(function (d) {
       return d["resource_type"];
   });
   var povertyLevelDim = ndx.dimension(function (d) {
       return d["poverty_level"];
   });
   var stateDim = ndx.dimension(function (d) {
       return d["school_state"];
   });
   var totalDonationsDim = ndx.dimension(function (d) {
       return d["total_donations"];
   });

   var fundingStatus = ndx.dimension(function (d) {
       return d["funding_status"];
   });
   var reachedDim = ndx.dimension(function(d) {
       return d["students_reached"]
   })


   //Calculate metrics
   var numProjectsByDate = dateDim.group();
   var totalDonationsByDate = dateDim.group().reduceSum(function(d) {
       return d["total_donations"];
   });
   var studentsReachedByDate = dateDim.group().reduceSum(function(d) {
       return d["students_reached"];
   })
   var numProjectsByResourceType = resourceTypeDim.group();
   var numProjectsByPovertyLevel = povertyLevelDim.group();
   var numProjectsByFundingStatus = fundingStatus.group();
   var totalDonationsByState = stateDim.group().reduceSum(function (d) {
       return d["total_donations"];
   });
   var stateGroup = stateDim.group();


   var all = ndx.groupAll();
   var totalDonations = ndx.groupAll().reduceSum(function (d) {
       return d["total_donations"];
   });

   var studentsReached = ndx.groupAll().reduceSum(function (d) {
       return d["students_reached"];
   });

   var averageDonations = ndx.groupAll().reduce(
       function (d, v) {
           ++d.count;
           d.total += v.total_donations;
           return d;
        },
        function(d,v) {
           --d.count;
           d.total -= v.total_donations;
           return d;
        },
        function() {
            return {count:0, total:0};
        }
   );

   var max_state = totalDonationsByState.top(1)[0].value;

   //Define values (to be used in charts)
   var minDate = dateDim.bottom(1)[0]["date_posted"];
   var maxDate = dateDim.top(1)[0]["date_posted"];

   var get_avg = function (d) {
           return d.count > 0 ? d.total / d.count : 0;
       }

   //Charts
   var timeChart = dc.barChart("#time-chart");
   var composite = dc.compositeChart("#dollar-chart");
   var resourceTypeChart = dc.rowChart("#resource-type-row-chart");
   var povertyLevelChart = dc.rowChart("#poverty-level-row-chart");
   var numberProjectsND = dc.numberDisplay("#number-projects-nd");
   var totalDonationsND = dc.numberDisplay("#total-donations-nd");
   var fundingStatusChart = dc.pieChart("#funding-chart");
   var statesChart = dc.geoChoroplethChart("#usa-map-chart");
   var averageChart = dc.numberDisplay("#average-donations-nd");
   var studentsReachedND = dc.numberDisplay('#students-reached-nd');


   selectField = dc.selectMenu('#menu-select')
       .dimension(stateDim)
       .group(stateGroup);


   numberProjectsND
       .formatNumber(d3.format("d"))
       .valueAccessor(function (d) {
           return d;
       })
       .group(all);

   totalDonationsND
       .formatNumber(d3.format("d"))
       .valueAccessor(function (d) {
           return d;
       })
       .group(totalDonations)
       .formatNumber(d3.format(".3s"));

   studentsReachedND
       .formatNumber(d3.format("d"))
       .valueAccessor(function (d) {
           return d;
       })
       .group(studentsReached)

    timeChart
       .width(600)
       .height(200)
       .margins({top: 10, right: 50, bottom: 30, left: 50})
       .dimension(dateDim)
       .group(numProjectsByDate)
       .transitionDuration(500)
       .x(d3.time.scale().domain([minDate, maxDate]))
       .elasticY(true)
       .xAxisLabel("Year")
       .yAxis().ticks(4);

   resourceTypeChart
       .width(300)
       .height(250)
       .dimension(resourceTypeDim)
       .group(numProjectsByResourceType)
       .xAxis().ticks(4);

   povertyLevelChart
       .width(300)
       .height(250)
       .dimension(povertyLevelDim)
       .group(numProjectsByPovertyLevel)
       .xAxis().ticks(4);

   fundingStatusChart
       .height(220)
       .radius(90)
       .innerRadius(40)
       .transitionDuration(1500)
       .dimension(fundingStatus)
       .group(numProjectsByFundingStatus);


    averageChart
        .formatNumber(d3.format("d"))
       .valueAccessor(get_avg)
       .group(averageDonations)
       .formatNumber(d3.format(".3s"));

    statesChart
       .width(1000)
       .height(330)
       .dimension(stateDim)
       .group(totalDonationsByState)
       .colors(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"])
       .colorDomain([0, max_state])
        .overlayGeoJson(stateJson["features"], "state", function (d) {
            return d.properties.name;
       })
       .projection(d3.geo.albersUsa()
                .scale(600)
                .translate([340, 150]))
       .title(function (p) {
           return "State: " + p["key"]
               + "\n"
               + "Total Donations: " + Math.round(p["value"]) + " $";
   });

    composite
       .width(600)
       .height(200)
       .margins({top: 10, right: 50, bottom: 30, left: 50})
       .x(d3.time.scale().domain([minDate, maxDate]))
        .legend(dc.legend().x(70).y(10).itemHeight(10).gap(5))
        .brushOn(false)
        .rangeChart(timeChart)
        .compose([
            dc.lineChart(composite)
                .dimension(dateDim)
                .colors('rgb(61,196,130)')
                .group(totalDonationsByDate, 'Total Donations'),
            dc.lineChart(composite)
                .dimension(dateDim)
                .group(studentsReachedByDate, 'Number of Students Reached')
                .colors('rgb(15,71,173)')
            ])
        .elasticY(true)
        .xAxisLabel("Year")
        .yAxis().ticks(4);





   dc.renderAll();
}