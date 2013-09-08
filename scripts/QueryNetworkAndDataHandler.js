// Globals
var globals = new Object();
globals.vis = "";					// CytoscapeWeb visualization instance
globals.graph;						// CytoscapeWeb network as a graph object (see Graph class)
globals.buttonsEnabled = -1;		// -1 = An action is taking place and buttons are disabled, 1 = No action is taking place
globals.theXML = "";				// XGMML representing the graph
globals.xmlStack = new Array();		// Stack containing snapshots (XML) of the network up to 10 operations back. Used for undo feature

//	Executed when the document is ready to load
$(document).ready(function() {

	$("#txtNodeSearch").val("");		// Clear whatever value is in the textbox
	globals.theXML = userInput[0].Text;	// Get XML for default network (NOTE: Check out the 'XML Reader' in the 'RareDiseases' protocol and the 'RareDiseasesUploadFile' Protocol to see how this ended up here)
	globals.xmlStack.push(globals.theXML);	// Pop current XML onto stack
	offButtons();						// Disable buttons because we are going to do a bunch of processing
    prepareCytoscapeDiv();				// Draw the network
	allLabels(function(data){			// Call this Protocol Function to get names (labels) of all nodes (disease, genes, and pathways)
		var start = data.indexOf("[");	// Parse the data and push node names (labels) into array
		var end = data.lastIndexOf("]");
		var datO = eval(String(data).substr(start,end-start+1));
		var theArr = new Array();
		for(var k = 0; k < datO.length; k++){
			theArr.push(datO[k]['node/label']);
		}
		$(".typeahead").typeahead({ source: theArr});	// Populate the typeahead (autocomplete) box with these names
	});
    prepareHandlers();					// Make event handlers for all buttons
    makeToolTips();						// Make tool tips (the text that appears when you hover over a button)
    $('.dropdown-toggle').dropdown()	// This enables the autocomplete dropdown
    drawTable([], drawNew = true);		// Draw the data table below the network
	onButtons();						// Enable the buttons again
					// Welcome the user into the application (see showModal function)
	showModal("Welcome to the Rare Disease Viewer!", "This application lets you study gene, disease, and pathway networks. Your network is shown as a group of connected nodes. You can manipulate your network by typing queries into the search box and clicking the buttons below it. When you click on a node in your network, information about the node will be displayed in the table below. If you want to know what a particular button does, just hover your mouse over it.\n\nNOTE: In order to use this application, you may need to provide your Pipeline Pilot credentials.", "Get Started", function() { $("#myModal").modal("hide") });
});

// Maintains a stack of previous 'states' of the network (used by the 'step back' feature)
function updateXML(){
	if (globals.xmlStack.length > 10){	// Keep the stack size <= 10
		globals.xmlStack.shift();
	}
	globals.xmlStack.push(globals.vis.xgmml());	// Add current XML to the stack
}

// Disable all buttons
function offButtons(){
	$(".btn").attr("disabled","disabled");	// Disable anything belonging to the '.btn' CSS class
	$("#txtNodeSearch").attr("disabled", "disabled");	// Disable the text box
	globals.buttonsEnabled = -1;	// -1 means buttons are disabled
}

// Enable all buttons
function onButtons(){
	$(".btn").removeAttr("disabled");	// Enable anything belonging to the '.btn' CSS class
	$("#txtNodeSearch").removeAttr("disabled");	// Enable the text box
	globals.buttonsEnabled = 1;	// 1 means buttons are enabled
}

// This draws the table below the network using the Data Tables jQuery plugin
function drawTable(tabDat){
		// Call the dataTable function (specified in dataTables.min.js) with a JavaScript object specifying the columns
    var tab = $('#dataTable').dataTable({
        aoColumns: [
            { sTitle: "ID" },
            { sTitle: "Type" },
            { sTitle: "Prevalence" },
            { sTitle: "Onset"},
            { sTitle: "Orphnet ID"},
            { sTitle: "Inherit"}
        ],
        bRetrieve: true
    });
    tab.fnClearTable();		// Delete any values in our table
    for(var x = 0; x < tabDat.length; x++){
        tab.fnAddData(tabDat[x]);		// Update each row using the elements from the tabDat array (an argument to this function)
    }
}

// Turns an array of node objects into an array of arrays which can be used by drawTable(tabDat)
function getNodeObjData(nodeObArr){
    var finalArr = new Array();
    for (var x = 0; x < nodeObArr.target.length; x++){
        var nd = nodeObArr.target[x].data;	// The node objects have a 'data' property
        var id = (nd.ID)?nd.ID:"N/A";	// ID = the name of the node (IN THIS CASE!) If there is no ID, put N/A
        var inherit = (nd.Inherit)?nd.Inherit:"N/A";	// The rest of these lines are self explanatory
        var type = (nd.Type)?nd.Type:"N/A";
        var prevalence = (nd.Prevalence)?nd.Prevalence:"N/A";
        var onset = (nd.Onset)?nd.Onset:"N/A";
        var orphnetID = (nd['Orphnet ID'])?nd['Orphnet ID']:"N/A";
        var res = [id, type, prevalence, onset, orphnetID, inherit];	// Put these variables into an array
        finalArr.push(res);	// and push it onto our array of arrays
    }
    return finalArr;
}

// Draws the network in Cytoscape Web
function prepareCytoscapeDiv() {
			theXML = globals.theXML;	// Get the XML representing the network
            var options = {
                swfPath: "swf/CytoscapeWeb",	// Point to the CytoscapeWeb flash file (NOTE: This is saved in the job directory. See the 'Cytoscape Web' subprotocol in the 'RareDiseases' protocol for mor info
                flashInstallPath: "swf/playerProductInstall"
            };

				// Initialize visualization
            var vis = new org.cytoscapeweb.Visualization("cytoscapeweb", options);

				// Give it the XML and enable the pan-zoom control
            var draw_options = {
                network: theXML,
                panZoomControlVisible: true
            };

				// Specify the visual style (ex. background color, node color/sizes, etc)
            var visual_style = {
                global: { backgroundColor: "#E6E6E6" },
                nodes: {
                    borderWidth: 3,
                    borderColor: "#FFFFFF",
					selectionBorderColor: "#FFFF00",
					selectionBorderWidth: 5,
                    size: {
                        defaultValue: 25,			// The more prevalent the disease (based on the PrevMapVal attribute), the larger the node
                        continuousMapper: { attrName: "PrevMapVal", minValue: 25, maxValue: 50 }
                    },
                    color: {
                        discreteMapper: {
                            attrName: "Type",
                            entries: [		// Set the color based on the node type
                                    { attrValue: 'Disease', value: "#FF0000" },
                                    { attrValue: 'Disease Group', value: "FF00FF" },
                                    { attrValue: "Gene", value: "#00FF00" },
                                    { attrValue: "Pathway", value: "#0000FF" },
                                    { attrValue: "", value: "#FF0000" },
                                    { attrValue: "Unknown", value: "#FF0000" }
                                ]
                        }
                    },
                    labelHorizontalAnchor: "center"
                },
                edges: {
                    width: 3,
                    color: "#0B94B1"
                }
            };
				// Draw the visualization
            vis.draw(draw_options);
				
				// Whenever a node is selected, display its information in the table below network visualization
            vis.addListener("select", "nodes", function(evt) {
                drawTable(getNodeObjData(evt));
            });

            vis.ready(function() {
				vis.visualStyle(visual_style);	// apply the visual style when the nodes and edges are laid out
                globals.vis = vis;		// Assign this visualization instance to our global variable so we can use it later
                globals.graph = new Graph(vis.nodes(), vis.edges());	// Create a representation of this graph (see Graph class)
				
				// Add right click menu stuff
					// Zoom in on the selected node
				vis.addContextMenuItem("Focus On", "nodes", function (evt) {
					var rootNode = evt.target;	// Which node are we zooming in on?
					var selected = globals.vis.selected();	// What nodes have been selected
					globals.vis.deselect();	// Deselect them
					$("#txtNodeSearch").val(rootNode.data.ID);	// Put our "zoom node" in the text box
					$("#btnFindTargetNode").trigger('click');	// Trigger the button click that will zoom in
					globals.vis.select(selected);	// Reselect the nodes that were initially selected
				});
					// Pop up a window of the node's information on orphanet
				vis.addContextMenuItem("Search on Orphanet", "nodes", function (evt) {
					var rootNode = evt.target;	// Which node do we want to look up
					globals.vis.deselect();	// Deselect all other nodes
					globals.vis.select([rootNode]);	// and just select this node
					$("#btnOrphanet").trigger('click');	// then trigger the button click that will open orphanet
				});
					// Add this node's neighbors to the graph
				vis.addContextMenuItem("Get Neighbors", "nodes", function (evt) {
					var rootNode = evt.target;	// Which node are we going to find the neighbors for?
					globals.vis.deselect();	// Deselect everything
					globals.vis.select([rootNode]);	// and just select this node
					$("#btnGetNeighbors").trigger('click');	// then trigger the button click that will find its neighbors
				});
					// Redraw the network
				vis.addContextMenuItem("Refresh Network", "none", function () {
					$("#btnRefresh").trigger('click');	// Trigger the button click that will handle this for us
				});
					// Delete all the selected nodes
				vis.addContextMenuItem("Delete Selected", "none", function (evt) {
					$("#btnDeleteNode").trigger('click');	// Trigger the button click that will handle this for us
				});
					// Zoom out to the full network and select all the nodes
				vis.addContextMenuItem("Show Full Network", "none", function () {
					$("#btnSelectAll").trigger('click');	// Trigger the button click that will handle this for us
				});
					// Delete all nodes except the selected nodes
				vis.addContextMenuItem("Filter To Selected Nodes", "none", function (evt) {
					$("#btnFilterTo").trigger('click');		// Trigger the button click that will handle this for us
				});
                populateTypeAhead();						// Populate the typeahead (honestly, I don't think function even needs to be here because we already populate the typeahead when the page is loaded)
            });
}

// Create handlers for all the button clicks
function prepareHandlers() {

    // When the textbox is focused on (clicked), automatically select all the text
    $("input[type=text]").focus(function() { $(this).select(); });

	// Zoom in on the node target node (entered in the search box)
    $("#btnFindTargetNode").click(function() {
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, don't do anything
        var searchTerm = $("#txtNodeSearch").val();	// Which node are we looking for
		offButtons();								// Disable buttons, we are doing work now
        if(searchTerm == ""){						// If the user has not entered anything
			onButtons();							// tell them to enter something and enable buttons
            showModal("Please enter a target node...", "In order to search for a target node, you need to enter its name in the textbox above.", "Ok", function(){$("#myModal").modal("hide");});
			return;
        }
													// Use the Graph class to find the node
        var theNodes = globals.graph.getNodeObjectsForKeyWord(searchTerm);
        if(theNodes[0] === -1){						// -1 means we have not found the node
			onButtons();							// Enable buttons and offer to add the node to the network
            showModal("Could not find that node...", "Would you like us to try and add it to your network?", "Yes, try to add it.", function(){$("#myModal").modal("hide"); $("#btnAddNode").trigger('click')});
			return;
        }
        else{
            selectNodes([theNodes[0]]);				// Select and zoom in on the node
			onButtons();							// Enable the buttons
			updateXML();							// Push the current XML onto the stack
        }
    });

	// Delete the entire network
    $("#btnClearGraph").click(function(){
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, don't do anything
        showModal(									// Make sure that the user is ok with this
        "Are you sure?",
        "This will delete the entire network. This action CANNOT be undone. Do you want to proceed?", 
        "Yes, delete everything", 
        function(){									// If the user gives his consent
			offButtons();							// Disable buttons, we are doing work
            globals.vis.removeElements(); 			// Delete everything in the visualization
            globals.graph.clear(); 					// Clear our graph object (see Graph class)
            $("#myModal").modal("hide");			// Dismiss this modal window
			onButtons();							// Enable buttons
			updateXML();})							// Push the current XML onto the stack
    });

	// Delete the selected nodes
    $("#btnDeleteNode").click(function(){
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, don't do any work
        showModal("Are you sure?", 					// Ask if the user is sure
        "This will delete all the selected nodes. This action CANNOT be undone. Do you want to proceed?", 
        "Yes, delete selected nodes", 
        function(){				
			offButtons();							// If the user is sure, disable the buttons because we have to do some work
            var deleteMe = new Array();				// These are the ids of the nodes we will delete
            var theNodeObjs = globals.vis.selected("nodes");
            for(var i = 0; i < theNodeObjs.length; i++){	// Get the ids of all the selected nodes and push them onto the deleteMe list
                deleteMe.push(theNodeObjs[i].data.id);
            }
            globals.vis.removeElements(deleteMe);	// Delete the elements from the visualization
            globals.graph.removeIDs(deleteMe);		// Delete the elements form the graph object (see Graph class)
            $("#myModal").modal("hide");			// Dismiss this modal
			onButtons();							// Enable the buttons
			updateXML();})							// Push the current XML onto the stack
    });

	// Search for selected node on Orphanet
    $("#btnOrphanet").click(function() {
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, don't do anything
        var theArr = globals.vis.selected();		// Get the selected nodes
        if(theArr.length > 0){						
            var oid = theArr[0].data["Orphnet ID"];	// Get the id of the selected node
            if(!isNaN(parseFloat(oid)) && isFinite(oid) && oid != 0){	// If the ID is valid (i.e. it is not 'N/A')
                window.open("http://www.orpha.net/consor/cgi-bin/OC_Exp.php?lng=EN&Expert="+oid);	// Look op the node on orphanet
            }
            else{									// Otherwise tell the user we can't find it
                showModal("No Orphanet Entry...", "This node does not have an Orphanet ID", "Ok", function(){$("#myModal").modal("hide");});
            }
        }
        else{										// If no node was selected, tell the user to select something
            showModal("Nothing selected...", "Select a node and click the Orphanet button to view it in Orphanet.", "Ok", function(){$("#myModal").modal("hide")});
        }
    });
	
	// Add a node to the network (the node name is entered in the textbox)
    $("#btnAddNode").click(function() {
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled don't do anything
        var searchTerm = $("#txtNodeSearch").val();	// What is the value in the textbox
		offButtons();								// Disable the buttons, we are doing some work
        var theArr = globals.graph.getIDArr();		// Get an array of all the node IDs in our network
        if(globals.graph.getNodesForKeyword(searchTerm)[0] != -1) {
			onButtons();							// If the node already exists in the visualization, let the user know and stop working
            showModal("That's already in the network...", searchTerm + " appears to be in the network already", "Ok", function() { $("#myModal").modal("hide") });
            return;
        }
													// Call this Protocol Function
		nodeDataForLabel(searchTerm, function(nodeHTML){
			if(nodeHTML == null){					// If we could not find the node, let the user know
				showModal("Could not find...", "Sorry, we couldn't find that in our database, please ensure that it is available in the AutoComplete box.", "Ok", function() { $("#myModal").modal("hide") });
				onButtons();
				return;
			}
			var startString = "[";					// Get the node data from the HTML
			var endString = "]";
			var s = nodeHTML.indexOf(startString);
			var e = nodeHTML.lastIndexOf(endString);
			var nodeData = eval(String(nodeHTML).substr(s,e-s+1))[0];
			var myID = nodeData["node/id"];
			for(var q = 0; q < globals.graph.nodes.length; q++){
				if(myID == globals.graph.nodes[q].id){
					onButtons();					// If we already have this node, stop working
					return;
				}
			}
													// Parse the data and extract the properties
			var myNameArr = nodeData["node/att/name"];
			var myValArr = nodeData["node/att/value"];
			
			var myInherit = "";
			var myOnset = "";
			var myDeath = "";
			var myPrevMapVal = 0;
			var myPrevalence = "";
			var myType = "";
			var myLabel = "";
			var myOrphnetID = 0;
			for(var q = 0; q < myNameArr.length; q++){
				if(myNameArr[q] == "ID"){
					myLabel = myValArr[q];
				}
				else if(myNameArr[q] == "Inherit"){
					myInherit = myValArr[q];
				}
				else if(myNameArr[q] == "Onset"){
					myOnset = myValArr[q];
				}
				else if(myNameArr[q] == "Orphnet ID"){
					myOrphnetID = myValArr[q];
				}
				else if(myNameArr[q] == "PrevMapVal"){
					myPrevMapVal = myValArr[q];
				}
				else if(myNameArr[q] == "Prevalence"){
					myPrevalence = myValArr[q];
				}
				else if(myNameArr[q] == "Type"){
					myType = myValArr[q];
				}
				else if(myNameArr[q] == "Death"){
					myDeath = myValArr[q];
				}
				
			}
			
			nodeData = {
					id: myID,
                    ID: myLabel,
                    Death: myDeath,
                    Inherit: myInherit,
                    Onset: myOnset,
                    PrevMapVal: parseInt(myPrevMapVal),
                    Prevalence: myPrevalence,
                    Type: myType,
                    label: myLabel
			}
			nodeData["Orphnet ID"] = parseInt(myOrphnetID);
												// Add the node to the visualizatoin
            var node1 = globals.vis.addNode(0, 0, nodeData, true);
			
			var thisNode = new Node(node1);	
			globals.graph.nodes.push(thisNode);	// Add the node to our graph object
					
												// Call this Protocol Functoin
			edgeDataForID(myID,function(edgeHTML){	
				var es = edgeHTML.indexOf("[");
				var ee = edgeHTML.lastIndexOf("]");
				var edgeData = eval(String(edgeHTML).substr(es,ee-es+1));
				
				// Find all the edges that this node has
				var redge = new Array();
				for(var i = 0; i < edgeData.length; i++) {
                    for(q = 0; q < globals.graph.nodes.length; q++){
                        if(		// If we find that this node connects to an node already in our network, add the edge
						(edgeData[i]["edge/source"] == globals.graph.nodes[q].id || edgeData[i]["edge/target"] == globals.graph.nodes[q].id)
						&& (globals.graph.nodes[q].id != thisNode.id)
						){
                            var conDat = { id:  thisNode.label + "" + i, source: thisNode.id, target: globals.graph.nodes[q].id, directed: false };
                            thisNode.addConnection(globals.graph.nodes[q]);	// Add the edge to our graph object
                            var edge = globals.vis.addEdge(conDat, true);	// and to the visualization
                        }
                    }
                }
				globals.vis.layout("ForceDirected");						// Redraw the network
				globals.vis.zoomToFit();									// Zoom out
				onButtons();												// Enable the buttons
				updateXML();												// Push the current XML onto the stack
			});
            
			
		});
    });

	// Get all the neighbors of the selected node and add them to the network
    $("#btnGetNeighbors").click(function() {
		if(globals.buttonsEnabled == -1){return;}	// If buttons have been disabled, don't do anything
        if(globals.vis.selected("nodes").length == 0){	// If no node is selected, let the user know
            showModal("No Node Selected...", "You need to select a node before you get its neighbors", "Ok", function() { $("#myModal").modal("hide"); });
            return;
        }
        var thetid = globals.vis.selected("nodes")[0].data.id;	// Get the id of the selected node
        offButtons();											// Disable buttons, we are doing work now
		neighborsForID(thetid, new Array(), function(resHTML){	// Call this Protocol Function
			var startString = "[";								// Get the data from the HTML
			var endString = "]";
			var s = resHTML.indexOf(startString);
			var e = resHTML.lastIndexOf(endString);
			var neighborData  = eval(String(resHTML).substr(s,e-s+1));
			var edgeDats = new Array();
			for(var x = 0; x < neighborData.length; x++){		// For each neighbor
				if(neighborData[x]['edge/source'] != undefined){	// Get its edges
					edgeDats.push({
					source: neighborData[x]['edge/source'],
					target: neighborData[x]['edge/target']
					});
					continue;
				}
				var myID = neighborData[x]['node/id'];			
				var isDuped = 2;								// Is this neighbor node already in the graph? If so, skip to the next node
				for(var q = 0; q < globals.graph.nodes.length; q++){
					if(myID == globals.graph.nodes[q].id){
						isDuped = 1;
					}
				}
				if(isDuped == 1){continue;}
				var sourceNode;
				for(var q = 0; q < globals.graph.nodes.length; q++){
					if(thetid == globals.graph.nodes[q].id){
						sourceNode = globals.graph.nodes[q];
					}
				}
				
				// Extract the properties
				var myNameArr = neighborData[x]["node/att/name"];
				var myValArr = neighborData[x]["node/att/value"];
				
				var myInherit = "";
				var myOnset = "";
				var myDeath = "";
				var myPrevMapVal = 0;
				var myPrevalence = "";
				var myType = "";
				var myLabel = "";
				var myOrphnetID = 0;
				for(var q = 0; q < myNameArr.length; q++){
					if(myNameArr[q] == "ID"){
						myLabel = myValArr[q];
					}
					else if(myNameArr[q] == "Inherit"){
						myInherit = myValArr[q];
					}
					else if(myNameArr[q] == "Onset"){
						myOnset = myValArr[q];
					}
					else if(myNameArr[q] == "Orphnet ID"){
						myOrphnetID = myValArr[q];
					}
					else if(myNameArr[q] == "PrevMapVal"){
						myPrevMapVal = myValArr[q];
					}
					else if(myNameArr[q] == "Prevalence"){
						myPrevalence = myValArr[q];
					}
					else if(myNameArr[q] == "Type"){
						myType = myValArr[q];
					}
					else if(myNameArr[q] == "Death"){
						myDeath = myValArr[q];
					}
					
				}
				
				var nodeData = {
						id: myID,
						ID: myLabel,
						Death: myDeath,
						Inherit: myInherit,
						Onset: myOnset,
						PrevMapVal: parseInt(myPrevMapVal),
						Prevalence: myPrevalence,
						Type: myType,
						label: myLabel
				}
				nodeData["Orphnet ID"] = parseInt(myOrphnetID);
				
				// Add the node to to visualization and the graph
				var node1 = globals.vis.addNode(0, 0, nodeData, true);
				var thisNode = new Node(node1);
				globals.graph.nodes.push(thisNode);
			}
			
			for(var x = 0; x < edgeDats.length; x++){	// For each edge coming from this neighbor node
				var n1 = globals.graph.getNodeForIDOtherwiseOne(edgeDats[x].source);	// Try to find the source
				var n2 = globals.graph.getNodeForIDOtherwiseOne(edgeDats[x].target);	// And the target
				if(n1 != 1 && n2 != 1){	// If we found the source and the target, add the edge to the visualization and the graph
					if(n1.addConnection(n2)!= -1){
						var conDat = { id:  n1.label + "" + n2.label + Math.floor(Math.random()*10000), source: n1.id, target: n2.id, directed: false };
						var edge = globals.vis.addEdge(conDat, true);
					}
				}
			}
			
			globals.vis.layout("ForceDirected");		// Redraw the graph
			globals.vis.zoomToFit();					
			onButtons();								// Enable buttons
			updateXML();								// Push the current XML onto the stack
		});
    });

	// Redraw the network
    $("#btnRefresh").click(function(event) {
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, don't do anything
		offButtons();								// Disable the button because we are doing work
		globals.vis.layout("ForceDirected");		// Reapply the layout (this redraws the graph)
		onButtons();								// Enable the buttons again
    });

	// Download the XGMML
	$("#btnDownload").click(function(){
		var xgmml = globals.vis.xgmml();		// Get the XGMML
		networkToUserDir(xgmml, function(){});	// Call this Protocol Function which will save the xml to the user's directory and the job directory
		var popup = window.open("","")			// Pop open a window and make it display this XGMML
		popup.document.write("<html><head><title></title></head>");
		popup.document.write("<body><p>Network XGMML</p><form><textarea cols='150' rows='100'>");
		popup.document.write(xgmml.toString());
		popup.document.write("</textarea></form></body></html>");
		popup.document.close();
												// Tell the user that the data has been saved
		showModal("Wrote to MyNetwork.xgmml in user folder and job folder","Go to your Pipeline Pilot window and right-click 'wlvppilottest'(bottom right of window)->'Server File Browser' and navigate to the user folder. Alternatively, expand NetworkToUserDir in the Jobs subwindow. Once you find the file, open it on your computer using Notepad and save it. Alternatively. copy and paste the xgmml code from the newly opened popup window and save it on your computer.","Ok", function() { $("#myModal").modal("hide") });
	});
	
	// Select all the nodes in the network 
	$("#btnSelectAll").click(function(){
		if(globals.buttonsEnabled == -1){return;}	// If the buttons are disabled, don't do anything
		offButtons();								// Disable buttons, we are doing work now
        globals.vis.removeFilter();					// Remove any filters that exist
        globals.vis.deselect();						// Deselect any nodes currently selected
		globals.vis.select("nodes");				// Select all nodes
        globals.vis.zoomToFit();					// Zoom to fit around those nodes
		onButtons();								// Enable buttons again
	});
	
	// Remove all nodes except the currently selected nodes
	$("#btnFilterTo").click(function(){
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, don't do anything
        showModal("Are you sure?", 					// Ask the user if they are sure they want to do this
        "This will remove all nodes except the selected nodes. Do you want to proceed?", 
        "Yes, filter to selected nodes", 
        function(){									
			offButtons();							// Disable buttons, we are doing work now
            var deleteMe = new Array();				
            var theNodeObjs = globals.vis.selected("nodes");	
			var allNodes = globals.vis.nodes();		
			for(var i = 0; i < allNodes.length; i++){
				var remove = 1;						// Get ids of selected nodes
				for(var j = 0; j < theNodeObjs.length; j++){
					if(allNodes[i].data.id == theNodeObjs[j].data.id){
						remove = -1;
						break;
					}
				}
				if(remove == 1){					// If the node needs to be removed, push it onto the array
					deleteMe.push(allNodes[i].data.id);
				}
			}
            globals.vis.removeElements(deleteMe);	// Remove nodes from visualization and graph
            globals.graph.removeIDs(deleteMe);
            $("#myModal").modal("hide");			// Dismiss modal
			onButtons();							// Enable buttons
			updateXML();})							// Push XML onto the stack
	});

	// Undo the last operation
	$("#btnStepBack").click(function(){
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, do not do anything
		offButtons();								// Disable buttons
		if (globals.xmlStack.length >= 2){			// If there are more than two stack elements, set the current XML to that element and redraw
			globals.theXML = globals.xmlStack[globals.xmlStack.length - 2];
			globals.xmlStack.pop();
			prepareCytoscapeDiv();
		}
		onButtons();								// Enable buttons
	});
	
	// Get Help
	$("#btnHelp").click(function(){
		if(globals.buttonsEnabled == -1){return;}	// If buttons are disabled, do not do anything
		offButtons();								// Disable buttons
													// Offer help on using the app
		showModal("Rare Disease Network Viewer", "Enter disease/gene/pathway names into the text box and manipulate your network by clicking the buttons. Hover over the buttons to see what they do.", "Ok", function() { $("#myModal").modal("hide") });
		onButtons();								// Enable buttons
	});
}

// Add the node to the visualization
function addNode(mydata){
    for(var q = 0; q < globals.graph.nodes.length; q++){
        if(mydata.id == globals.graph.nodes[q].id){		// Check that the node is not a duplicate
            return;
        }
    }													// Set the properties
    var nodDat = {
                    id: mydata.id,
                    ID: mydata.label,
                    Death: mydata.death,
                    Inherit: mydata.inherit,
                    Onset: mydata.onset,
                    PrevMapVal: parseInt(mydata.prevmapval),
                    Prevalence: mydata.prevalence,
                    Type: mydata.category,
                    label: mydata.label
                };
                nodDat["Orphnet ID"] = parseInt(mydata.orphnetid);
                var node1 = globals.vis.addNode(0, 0, nodDat, true);

                var thisNode = new Node(node1);			// Add connections to graph and visualization
                for(var i = 0; i < mydata.connections.length; i++) {
                    for(q = 0; q < globals.graph.nodes.length; q++){
                        if(mydata.connections[i] == globals.graph.nodes[q].id){
                            var conDat = { id: mydata.label + "" + i, source: mydata.id, target: mydata.connections[i], directed: false };
                            thisNode.addConnection(globals.graph.nodes[q]);
                            var edge = globals.vis.addEdge(conDat, true);
                        }
                    }
                }
                globals.graph.nodes.push(thisNode);
}

// Makes the tooltips for the buttons
function makeToolTips() {
    $("#btnAddNode").popover({ title: "Add Target Node", content: "Add target node to network and select it.", placement: "right", delay: { show: 1000, hide: 100} });
    $("#btnFindTargetNode").popover({ title: "Find Target Node", content: "Search for, and select target node", placement: "right", delay: { show: 1000, hide: 100 } });
    $("#btnAddPath").popover({ title: "Add Path To Target Node", content: "Add the set of nodes connecting your network to the target node", placement: "right", delay: { show: 1000, hide: 100} });
    $("#btnDeleteNode").popover({ title: "Delete Selected Nodes", content: "Remove the selected nodes from the network", placement: "right", delay: { show: 1000, hide: 100} });
    $("#btnClearGraph").popover({ title: "Clear Network", content: "Remove all nodes from the network", placement: "right", delay: { show: 1000, hide: 100} });
    $("#btnOrphanet").popover({ title: "Search Orphanet", content: "Look up this node on Orphanet", placement: "right", delay: { show: 1000, hide: 100} }); 
    $("#btnRefresh").popover({ title: "Reapply Layout", content: "Redraw the network", placement: "right", delay: { show: 1000, hide: 100} }); 
    $("#btnGetNeighbors").popover({ title: "Get Neighbors", content: "Add to the network all the nodes directly adjacent to selected node", placement: "right", delay: { show: 1000, hide: 100} });
	$("#btnFilterTo").popover({ title: "Filter To Selected Nodes", content: "Remove all nodes from network except selected nodes", placement: "right", delay: { show: 1000, hide: 100} });
	$("#btnDownload").popover({ title: "Download XGMML", content: "Download the XGMML code for this network to your user folder and job folder on the Pipeline Pilot Server", placement: "right", delay: { show: 1000, hide: 100} });
	$("#btnSelectAll").popover({ title: "Show Full Network", content: "Show and select the entire network", placement: "right", delay: { show: 1000, hide: 100} });
	$("#btnStepBack").popover({ title: "Step Back", content: "Go back one operation", placement: "right", delay: { show: 1000, hide: 100} });
	$("#btnHelp").popover({ title: "Help", content: "How do I use this application?", placement: "right", delay: { show: 1000, hide: 100} });

}

// Shows a modal window with accept and cancel button
function showModal(title, content, acceptButton, handler){
	// acceptButton is the text of the blue button and handler is the function that says what will be done when the acceptButton is pressed
	$("#mdlblTitle").text(title);						// Set title of modal
    $("#mdlblContent").text(content);					// Set content
    $("#mdbtnOk").unbind('click');						// Remove the old click event
    $("#mdbtnClose").click(function(){					// Add the click event for close button (close when clicked)
        $('#myModal').modal('hide');
    });
    $("#mdbtnOk").text(acceptButton);					// Set accept button text
    $("#mdbtnOk").click(handler);						// Set accept button handler
    $('#myModal').modal('show');						// Show modal
}

// selects and zooms in on the chosen nodes
function selectNodes(nodes){
    var theIds = new Array();
    for(var x = 0; x < nodes.length; x++){
        theIds.push(nodes[x].data.id);			// Make array of ids
    }
    globals.vis.deselect("nodes");				// Deselect all nodes and select new nodes
    globals.vis.select("nodes",theIds);
    globals.vis.filter(null, theIds, true);		// Filter to the given nodes
    globals.vis.panToCenter();					// Pan and zoom
    globals.vis.zoomToFit();
    globals.vis.removeFilter(null,true);		// Remove filter
}

// selects and zooms in on chosen node and neighbors (hides everything else) (NOT USED)
function showNeighbors(node){
    var neighborIDs = new Array();
    neighborIDs.push(node.data.id);
    for(var x = 0; x < globals.edges.length; x++){
        var theEdge = globals.edges[x];
        if(theEdge.data === undefined || theEdge.data === null) { continue; }
        if(theEdge.data.source === undefined || theEdge.data.source === null ) { continue; }
        if((theEdge.data.target.toLowerCase().indexOf(node.data.id.toLowerCase()) >= 0) && ($.inArray(theEdge.data.source,neighborIDs) == -1)){
            neighborIDs.push(theEdge.data.source);
            neighborIDs.push(theEdge.data.id);
        }
        if((theEdge.data.source.toLowerCase().indexOf(node.data.id.toLowerCase()) >= 0) && ($.inArray(theEdge.data.target,neighborIDs) == -1)){
            neighborIDs.push(theEdge.data.target);
            neighborIDs.push(theEdge.data.id);
        }
    }
    globals.vis.deselect("nodes");
    globals.vis.select(null,neighborIDs);
    globals.vis.filter(null, neighborIDs, true);
    globals.vis.panToCenter();
    globals.vis.zoomToFit();
    globals.vis.removeFilter();
}

// CLASS NODE
function Node(nodeObject){
    this.id = nodeObject.data.id;			// This is the numerical id
    this.label = nodeObject.data.label;		// Name of node
    this.nodeObj = nodeObject;				// Original node (the object from the visualization)
    this.connections = new Array();
    var self = this;

	// Connect two nodes
    this.addConnection = function(connectionNode) {
        for(var x = 0; x < this.connections.length; x++) {
            if(this.connections[x].id === connectionNode.id){
                return -1;       			// Check that this connection does not exist
            }
        }
											// Connect the nodes
        this.connections.push(connectionNode);
        connectionNode.connections.push(self);
		return 1;
    };   
	// Return string representation (Name: connection1, connection2,...,connectionN)
    this.toString = function() {
        var res = this.label + ": ";
        for(var x = 0; x < this.connections.length; x++) {
            res += this.connections[x].label + ", ";
        }
        return res;
    }
}

// CLASS GRAPH
function Graph(N, E) {
    this.nodes = new Array();
    var self = this;
	
    for(var x = 0; x < N.length; x++) {					// Add all nodes which are not null or undefined
        if(N[x] === undefined || N[x] === null) { continue; }
        if(N[x].data === undefined || N[x].data === null) { continue; }
        if(N[x].data.label === undefined || N[x].data.label === null) { continue; }
        this.nodes.push(new Node(N[x]));
    }
    for(x = 0; x < E.length; x++) {						// Add all edges that are not undefined
        if(E[x] === undefined || E[x] === null) { continue; }
        if(E[x].data === undefined || E[x].data === null) { continue; }
        if(E[x].data.id === undefined || E[x].data.id === null) { continue; }
        var A;
        var B;
        for(var q = 0; q < this.nodes.length; q++) {
            if(this.nodes[q].id === E[x].data.target) {
                A = this.nodes[q];
            }
            else if(this.nodes[q].id === E[x].data.source) {
                B = this.nodes[q];
            }
        }
        A.addConnection(B);
    }

	// Retrieves nodes with a given name
    this.getNodeObjectsForKeyWord = function(keyWord) {
        var theArr = new Array();
        for(var x = 0; x < this.nodes.length; x++) {
            if(this.nodes[x].label.toLowerCase() == keyWord.toLowerCase()) {
                theArr.push(this.nodes[x].nodeObj);
            }
        }
        if(theArr.length === 0) {
            theArr.push(-1);		// Return -1 if the node is not found
        }
        return theArr;
    }
	
	// Retrieve nodes with a given id
    this.getNodeForID = function(theID) {
        for(var x = 0; x < this.nodes.length; x++) {
            if(this.nodes[x].id === theID) {
                return this.nodes[x];
            }
        }
    }
	
	// Retrieve nodes with a given id. If it is not found, return 1
	this.getNodeForIDOtherwiseOne = function(theID){
		for(var x = 0; x < this.nodes.length; x++) {
            if(this.nodes[x].id === theID) {
                return this.nodes[x];
            }
        }
		return 1;
	}
    this.toString = function() {
        var res = "Nodes: " + this.nodes.length;
        return res;
    }
    this.getNodeString = function(x) {
        if(x < this.nodes.length) {
            return this.nodes[x].toString();
        }
    }
    this.getNodesForKeyword= function(keyWord) {
        var theArr = new Array();
        for(var x = 0; x < this.nodes.length; x++) {
            if(this.nodes[x].label.toLowerCase().indexOf(keyWord.toLowerCase()) > -1) {
                theArr.push(this.nodes[x]);
            }
        }
        if(theArr.length === 0) {
            theArr.push(-1);
        }
        return theArr;
    }
	
	// Breadth first search (not used)
    this.getPath = function(sourceNode, targetNode) {
        // 1 = unfilled, 2 = shaded, 3 = filled
        for(var x = 0; x < this.nodes.length; x++) {
            this.nodes[x].color = 1;
            this.nodes[x].d = 99999;
            this.nodes[x].pred = null;
        }
        sourceNode.color = 2;
        sourceNode.d = 0;
        sourceNode.pred = null;
        var Q = new Array();
        Q.push(sourceNode);
        while(Q.length > 0) {
            var u = Q.shift();
            for(var j = 0; j < u.connections.length; j++) {
                if(u.connections[j].color === 1) {
                    u.connections[j].color = 2;
                    u.connections[j].d = u.d + 1;
                    u.connections[j].pred = u;
                    Q.push(u.connections[j]);
                }
            }
            u.color = 3;
        }

        var currNode = "";
        var pathResult = new Array();
        for(x = 0; x < this.nodes.length; x++) {
            if(this.nodes[x].id === targetNode.id) {
                currNode = targetNode;
                break;
            }
        }

        while(currNode.id !== sourceNode.id) {
            pathResult.unshift(currNode.id);
            currNode = currNode.pred;
        }
        pathResult.unshift(currNode.id);
        return pathResult;
    }

    this.clear = function() { this.nodes = []; }
    this.removeIDs = function(theIDs){
        var toDel = theIDs.length;
        while(toDel > 0){
            for(var i = 0; i < this.nodes.length; i++){
                if(this.nodes[i].id == theIDs[toDel-1]){
                    this.nodes.splice(i,1);
                }
            }
            toDel--;
        }
    }
    this.getIDArr = function(){
        var theArr = new Array();
        for(var i = 0; i < this.nodes.length; i++){
            theArr.push(this.nodes[i].id);
        }
        if(theArr.length==0){
            theArr.push("1");
        }
        return theArr;
    }
}