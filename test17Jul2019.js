var width = 1000,
	height = 1000,
	padding = 1;


d3.csv("./csv/fociData1.csv", function(fociDataCSV) {
	var foci = {},
	    fociCounts = {},
		circleCenter = 500,
		circleAdjust = 275;
	fociDataCSV.forEach(function(fD, i) {
		if (fD.Name == "starting"){
			foci[fD.ID] = {name: fD.Name, x: circleCenter, y: circleCenter, color: fD.Color};
		}
		else {
			var theta = 2 * Math.PI / (fociDataCSV.length - 1);
	      	foci[fD.ID] = {name: fD.Name,
      					   x: circleAdjust * Math.cos(i * theta) + circleCenter,
                           y: circleAdjust * Math.sin(i * theta) + circleCenter,
                           color: fD.Color};
        }

        fociCounts[fD.ID] = 0;
    });

  d3.csv("./csv/nd.csv", function(nodeDataCSV) {
	var node_radius = 5,
		cluster_padding = 5,
		num_nodes = nodeDataCSV.length;

	var svg = d3.select("#chart").append("svg")
    	.attr("width", width)
    	.attr("height", height);

	// Create node objects
	var nodes = d3.range(0, num_nodes).map(function(o, i) {
		return {
			id: "node" + i,
			radius: node_radius,
			nodeData: nodeDataCSV[i],
	    	choice: d3.keys(foci)[0],
		}
	});

	fociCounts["d" + 0] = nodes.length;

	var labelAdjust = circleAdjust + 100;
	var label = svg.selectAll("text")
		.data(fociDataCSV)
		.enter().append("text")
		.attr("class", "focilabel")
		.attr("x", function (d, i) {
			if (d.Name == "starting") {
				return 500;
			}
			else {
				var theta = 2 * Math.PI / (fociDataCSV.length - 1);
				return labelAdjust * Math.cos(i * theta) + circleCenter;
			}
		})
		.attr("y", function(d, i) {
			if (d.Name == "starting") {
				return 400;
			}
			else {
				var theta = 2 * Math.PI / (fociDataCSV.length - 1);
				return labelAdjust * Math.sin(i * theta) + circleCenter;
			}
		});

	label.append("tspan")
		.attr("x", function() { return d3.select(this.parentNode).attr("x"); })
		.attr("text-anchor", "middle")
		.text(function(d) {
			return d.Name;
		});

	label.append("tspan")
		.attr("dy", "1.3em")
		.attr("x", function() { return d3.select(this.parentNode).attr("x"); })
		.attr("text-anchor", "middle")
		.attr("class", "focipct")

	// Force-directed layout
	var force = d3.layout.force()
		.nodes(nodes)
		.size([width, height])
		.gravity(0)
		.charge(0)
		.friction(.91)
		.on("tick", tick)
		.start();
	    
	// Draw circle for each node.
	var circle = svg.selectAll("circle")
		.data(nodes)
	  	.enter()
	  	.append("circle")
		.attr("id", function(d) { return d.id; })
		.attr("class", "node")
		.style("fill", function(d) { return foci[d.choice].color; });    

	// For smoother initial transition to settling spots.
	circle.transition()
		.duration(900)
		.delay(function(d,i) { return i * 5; })
		.attrTween("r", function(d) {
			var i = d3.interpolate(0, d.radius);
			return function(t) { return d.radius = i(t); };
		});

	function readablePercentage(count) {
		return (count / nodes.length * 100).toFixed(2);
	}

	label.selectAll("tspan.focipct")
     	.text(function(d) {
     		return readablePercentage(fociCounts["d" + d.Index]) + "%";
		});	

	var timer = svg.append("text")
		.attr("class", "timer")
		.attr("x", 500)
		.attr("y", 50)
		.attr("text-anchor", "middle");

	function pad(d) {
		return (d < 10) ? '0' + d.toString() : d.toString();
	}

	function displayTime(time) {
		var num = time;
		var hours = (num / 60);
		var rhours = Math.floor(hours);
		var minutes = (hours - rhours) * 60;
		var rminutes = Math.round(minutes);

		timer.text(pad(rhours) + ":" + pad(rminutes));
	}

	displayTime(0);

	var totalRefreshes = Object.keys(nodeDataCSV[0]).length - 1,
		time = 3000,
	    i = 0;

	function timedRefresh() {
		setTimeout(function() {
			nodes.forEach(function(d) {
				fociCounts[d.choice] -= 1;
				d.choice = d3.keys(foci)[d.nodeData["t" + i]];
				fociCounts[d.choice] += 1;
			});

			force.resume();

			i++;

			if (i < totalRefreshes) {
				timedRefresh();
			}

			displayTime(i);

			label.selectAll("tspan.focipct")
			     .text(function(d) {
			     	return readablePercentage(fociCounts["d" + d.Index]) + "%";
				});

		},time)
	}

	timedRefresh();

	function tick(e) {
	  circle
		.each(gravity(.08 * e.alpha))
	  	.each(collide(.30))
	  	.style("fill", function(d) { return foci[d.choice].color; })
	    .attr("cx", function(d) { return d.x; })
	    .attr("cy", function(d) { return d.y; });
	}


	// Move nodes toward cluster focus.
	function gravity(alpha) {
	  return function(d) {
	    d.y += (foci[d.choice].y - d.y) * alpha;
	    d.x += (foci[d.choice].x - d.x) * alpha;
	  };
	}

	// Resolve collisions between nodes.
	function collide(alpha) {
	  var quadtree = d3.geom.quadtree(nodes);
	  return function(d) {
		  var r = d.radius + node_radius + Math.max(padding, cluster_padding),
	        nx1 = d.x - r,
	        nx2 = d.x + r,
	        ny1 = d.y - r,
	        ny2 = d.y + r;
	    quadtree.visit(function(quad, x1, y1, x2, y2) {
	      if (quad.point && (quad.point !== d)) {
	        var x = d.x - quad.point.x,
	            y = d.y - quad.point.y,
	            l = Math.sqrt(x * x + y * y),
	            r = d.radius + quad.point.radius + (d.choice === quad.point.choice ? padding : cluster_padding);
	        if (l < r) {
	          l = (l - r) / l * alpha;
	          d.x -= x *= l;
	          d.y -= y *= l;
	          quad.point.x += x;
	          quad.point.y += y;
	        }
	      }
	      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
	    });
	  };
	} 
  });
});
