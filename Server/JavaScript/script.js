var treeData;
$(document).ready(function () {

	var margin = {top: 20, right: 120, bottom: 20, left: 100},
	width, height, duration = 750, k=1, searchData, treeDisplayed=false,
	svg = d3.select("#treePage").append("svg")
			.attr("width", 5000)
			.attr("height", 3000)
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Load search results
	$("#searchBtn").click(function () {
		$.post("/search",$("#searchBox").val(),function(jsonData){
			searchData = jsonData;
			var htmlData = "";
			for(var i=0;i<jsonData.length;i++) {
				sense = jsonData[i];
				htmlData += "<div class='searchResult'><a href='#' class='searchLink' data-index="+i+">"
					+sense['title']+"</a><br /><span class='defSpan'>"+sense['definition']+"</span></div><br></br>";
			}
			$("#searchOutput").html(htmlData);
			loader();
		}, "JSON");
	});
	
	// To handle window resize
	$(window).resize(function() {
		// Update based on window width & height
		width = $(window).width() - margin.right - margin.left;
		height = $(window).height() - margin.top - margin.bottom;
		if(treeDisplayed) {
			updateTree();
		}
	});
	
	// Display tree on clicking a search link
	var loader = function(){ $("a.searchLink").click(function () {
			$("#homePage").hide();
			$("#treePage").show();
			var self = $(this);
			treeData = searchData[parseInt(self.attr("data-index"))];
			// Set based on window width & height
			width = $(window).width() - margin.right - margin.left;
			height = $(window).height() - margin.top - margin.bottom;
			// Display initial tree
			treeDisplayed=true;
			updateTree({x0:height/2,y0:0});
		})
	};
	
	// Copies an article node
	var copyArticle = function(newArt,oldArt){
		newArt.type=oldArt.type;
		newArt.id=oldArt.id;
		newArt.title=oldArt.title;
		newArt.definition=oldArt.definition;
		newArt.children=oldArt.children;
		newArt._children=oldArt._children;
		console.log(oldArt.id,oldArt.title)
	};
	
	// Updates tree based on treeData
	function updateTree(source) {
		// D3 tree
		var tree = d3.layout.tree()
			.size([height, width]);
		// D3 diagonal
		var diagonal = d3.svg.diagonal()
			.projection(function(d) { return [d.y, d.x]; });
		// Compute the new tree layout
		var nodes = tree.nodes(treeData).reverse(),
			links = tree.links(nodes);
		// Normalize for fixed-depth
		nodes.forEach(function(d) { d.y = d.depth * width/7; });
		// Declare the nodes
		var node = svg.selectAll("g.node")
			.data(nodes, function(d) { return d.key || (d.key = k++) });
		// Enter the nodes
		var nodeEnter = node.enter().append("g")
			.attr("class", "node")
			.attr("transform", function(d) { 
				 return "translate(" + source.y0 + "," + source.x0 + ")"; })
		// Binding the click event handler
			.on("click",clickHandler);
		// Circle
		nodeEnter.append("circle")
			.attr("r", 1e-6)
			.style("stroke",function(d){ return d.type == "Category" ? "mediumseagreen" : "steelblue"} )
			.style("fill",function(d){ return d.type == "Category" ? "lightgreen" : "lightsteelblue"} );
		// Title
		nodeEnter.append("title");
		node.select("title")
			.text(function(d){return d.type == "Category" ? "Category : "+d.title : d.definition});
		// Text
		nodeEnter.append("text")
			.text(function(d) { return d.title; })
			.style("fill-opacity", 1e-6);
		// Transition nodes to their new position.
  		var nodeUpdate = node.transition()
	  		.duration(duration)
	  		.attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; } );
  		nodeUpdate.select("circle")
	  		.attr("r", 10);
  		// Transition text to new position
		nodeUpdate.select("text")
	  		.style("fill-opacity", 1)
			.attr("x", function(d) { 
				return d.children ? -13 : 13; })
			.attr("dy", ".35em")
			.attr("text-anchor", function(d) { 
				return d.children ? "end" : "start"; });
  		// Transition exiting nodes to the parent's new position.
  		var nodeExit = node.exit().transition()
	  		.duration(duration)
	  		.attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
	  		.remove();
  		nodeExit.select("circle")
	  		.attr("r", 1e-6);
  		nodeExit.select("text")
	  		.style("fill-opacity", 1e-6);
	   // Update the links
  		var link = svg.selectAll("path.link")
	  		.data(links, function(d) { return d.target.key; });
  		// Enter any new links at the parent's previous position.
  		link.enter().insert("path", "g")
	  		.attr("class", "link")
	  		.attr("d", function(d) {
			var o = {x: source.x0, y: source.y0};
			return diagonal({source: o, target: o});
	  	});
  		// Transition links to their new position.
  		link.transition()
	  		.duration(duration)
	  		.attr("d", diagonal);
  		// Transition exiting nodes to the parent's new position.
  		link.exit().transition()
	  		.duration(duration)
	  		.attr("d", function(d) {
			var o = {x: source.x, y: source.y};
			return diagonal({source: o, target: o});
	  	}).remove();
  		// Stash the old positions for transition.
  		nodes.forEach(function(d) {
			d.x0 = d.x;
			d.y0 = d.y;
		});
	}
	
	// On clicking a node	
	var clickHandler = function(d) {
		// No actual or stashed children - fire expand category
		if(!toggle(d) && d.type == "Category") {
			$.post("/expand_category",JSON.stringify(d.id),function(cat_data){
				d.children = cat_data;
				updateTree(d);
				// Fire expand article for each article
				for(var i=0; i<d.children.length; i++) {
					if(d.children[i].type == "Article") {
					$.post("/expand_article",JSON.stringify({id:d.children[i].id,hiddenChildren:"yes",index:i}),function(art_data){
							copyArticle(d.children[art_data.index],art_data);
							updateTree(d.children[art_data.index]);
						}, "JSON");						
					}
				}
			}, "JSON");
		} else updateTree(d);
	}
	
	// Toggle children on click
	var toggle = function(d) {
		var result = true;
		if (d.children) {
				d._children = d.children;
				d.children = null;
		} else if(d._children) {
				d.children = d._children;
				d._children = null;
		} else result = false;
		return result;
	}
});