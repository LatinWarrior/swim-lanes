/**
 * Created by Luis Blanco on 2/5/2017.
 */
// For the layout
var MINLENGTH = 300; // this controls the minimum length of any swimlane
var MINBREADTH = 100; // this controls the minimum breadth of any non-collapsed swimlane
var saveModel = "savedModel";
var green = '#B2FF59';
var blue = '#81D4FA';
var yellow = '#FFEB3B';
var crud = '#fff000';
var crap = '#000fff';
var darkBlue = "#00008B";
var laneSize = "150 300";
var taskSize = "80 20";
var font14 = "14px Arial, Helvetica, sans-serif";
var font15 = "15px Arial, Helvetica, sans-serif";

// some shared functions

// This function provides a common style for most of the TextBlocks.
// Some of these values may be overridden in a particular TextBlock.
function textStyle() {
    return { font: font14, stroke: "white" };
}

// this is called after nodes have been moved
function relayoutDiagram() {
    myDiagram.selection.each(function (n) {
        n.invalidateLayout();
    });
    myDiagram.layoutDiagram();
}

// compute the minimum size of the whole diagram needed to hold all of the Lane Groups
function computeMinPoolSize() {
    var len = MINLENGTH;
    myDiagram.findTopLevelGroups().each(function (lane) {
        var holder = lane.placeholder;
        if (holder !== null) {
            var sz = holder.actualBounds;
            len = Math.max(len, sz.height);
        }
        var box = lane.selectionObject;
        // naturalBounds instead of actualBounds to disregard the shape's stroke width
        len = Math.max(len, box.naturalBounds.height);
    });
    return new go.Size(NaN, len);
}

// compute the minimum size for a particular Lane Group
function computeLaneSize(lane) {
    // assert(lane instanceof go.Group);
    var sz = computeMinLaneSize(lane);
    if (lane.isSubGraphExpanded) {
        var holder = lane.placeholder;
        if (holder !== null) {
            var hsz = holder.actualBounds;
            sz.width = Math.max(sz.width, hsz.width);
        }
    }
    // minimum breadth needs to be big enough to hold the header
    var hdr = lane.findObject("HEADER");
    if (hdr !== null) sz.width = Math.max(sz.width, hdr.actualBounds.width);
    return sz;
}

// determine the minimum size of a Lane Group, even if collapsed
function computeMinLaneSize(lane) {
    if (!lane.isSubGraphExpanded) return new go.Size(1, MINLENGTH);
    return new go.Size(MINBREADTH, MINLENGTH);
}

// define a custom grid layout that makes sure the length of each lane is the same
// and that each lane is broad enough to hold its subgraph
function PoolLayout() {
    go.GridLayout.call(this);
    this.cellSize = new go.Size(1, 1);
    this.wrappingColumn = Infinity;
    this.wrappingWidth = Infinity;
    this.spacing = new go.Size(3, 0);
    this.alignment = go.GridLayout.Position;
}
go.Diagram.inherit(PoolLayout, go.GridLayout);

/** @override */
PoolLayout.prototype.doLayout = function (coll) {
    var diagram = this.diagram;
    if (diagram === null) return;
    diagram.startTransaction("PoolLayout");
    // make sure all of the Group Shapes are big enough
    var minsize = computeMinPoolSize();
    diagram.findTopLevelGroups().each(function (lane) {
        if (!(lane instanceof go.Group)) return;
        var shape = lane.selectionObject;
        if (shape !== null) { // change the desiredSize to be big enough in both directions
            var sz = computeLaneSize(lane);
            shape.width = (!isNaN(shape.width)) ? Math.max(shape.width, sz.width) : sz.width;
            shape.height = (isNaN(shape.height) ? minsize.height : Math.max(shape.height, minsize.height));
            var cell = lane.resizeCellSize;
            if (!isNaN(shape.width) && !isNaN(cell.width) && cell.width > 0) shape.width = Math.ceil(shape.width / cell.width) * cell.width;
            if (!isNaN(shape.height) && !isNaN(cell.height) && cell.height > 0) shape.height = Math.ceil(shape.height / cell.height) * cell.height;
        }
    });
    // now do all of the usual stuff, according to whatever properties have been set on this GridLayout
    go.GridLayout.prototype.doLayout.call(this, coll);
    diagram.commitTransaction("PoolLayout");
};
// end PoolLayout class

function init() {

    var $ = go.GraphObject.make;

    // debugger;

    myDiagram =
        $(go.Diagram, "centerDiagram", {
            // start everything in the middle of the viewport
            contentAlignment: go.Spot.TopCenter,
            // use a simple layout to stack the top-level Groups next to each other
            layout: $(PoolLayout),
            allowDrop: true,
            // disallow nodes to be dragged to the diagram's background
            mouseDrop: function (e) {
                e.diagram.currentTool.doCancel();
            },
            // a clipboard copied node is pasted into the original node's group (i.e. lane).
            "commandHandler.copiesGroupKey": true,
            // automatically re-layout the swim lanes after dragging the selection
            "SelectionMoved": relayoutDiagram, // this DiagramEvent listener is
            "SelectionCopied": relayoutDiagram, // defined above
            "animationManager.isEnabled": false,
            "undoManager.isEnabled": true,
            "ModelChanged": function (e) {
                if (e.isTransactionFinished) {
                    document.getElementById(saveModel).textContent = myDiagram.model.toJson();
                }
            }
        });

    // Customize the dragging tool:
    // When dragging a Node set its opacity to 0.7 and move it to the foreground layer
    myDiagram.toolManager.draggingTool.doActivate = function () {
        go.DraggingTool.prototype.doActivate.call(this);
        this.currentPart.opacity = 0.7;
        this.currentPart.layerName = "Foreground";
    };

    myDiagram.toolManager.draggingTool.doDeactivate = function () {
        this.currentPart.opacity = 1;
        this.currentPart.layerName = "";
        go.DraggingTool.prototype.doDeactivate.call(this);
    };

    // There are only three note colors by default, blue, red, and yellow but you could add more here:
    var noteColors = ['#009CCC', '#CC293D', '#FFD700'];

    function getNoteColor(num) {
        return noteColors[Math.min(num, noteColors.length - 1)];
    }

    function mouseEnter(e, obj) {
        var shape = obj.findObject("LEFT_RECT");
        shape.fill = "#6DAB80";
        shape.stroke = "#A6E6A1";
        // console.log('In mouseEnter. obj.data: ', obj.data);
        // var text = obj.findObject("TEXT");
        // text.stroke = "#009CCC";
    }

    function mouseLeave(e, obj) {
        var shape = obj.findObject("LEFT_RECT");
        // Return the Shape's fill and stroke to the defaults
        shape.fill = getNoteColor(obj.data.color);
        shape.stroke = obj.data.stroke;
        // console.log('In mouseLeave. obj.data: ', obj.data);
        // Return the TextBlock's stroke to its default
        // var text = obj.findObject("TEXT");
        // text.stroke = "black";
    }

    myDiagram.nodeTemplate =
        $(go.Node, "Horizontal",
            {
                mouseEnter: mouseEnter,
                mouseLeave: mouseLeave
            },
            // new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
            $(go.Shape, "Rectangle", {
                fill: '#009CCC',
                strokeWidth: 2,
                name: "LEFT_RECT",
                stroke: '#009CCC',
                width: 8,
                stretch: go.GraphObject.Vertical,
                alignment: go.Spot.Left,
                // if a user clicks the colored portion of a node, cycle through colors
                click: function (e, obj) {
                    console.log('Clicked on colored node.')
                    // myDiagram.startTransaction("Update node color");
                    // var newColor = parseInt(obj.part.data.color) + 1;
                    // if (newColor > noteColors.length-1) newColor = 0;
                    // myDiagram.model.setDataProperty(obj.part.data, "color", newColor);
                    // myDiagram.commitTransaction("Update node color");
                }
            },
                new go.Binding("fill", "color", getNoteColor),
                new go.Binding("stroke", "color", getNoteColor)
            ),
            $(go.Panel, "Auto",
                $(go.Shape, "Rectangle", {
                    fill: "white",
                    stroke: '#CCCCCC'
                }),
                $(go.Panel, "Table",
                    {
                        width: 120,
                        minSize: new go.Size(NaN, 50),
                        margin: new go.Margin(6, 10, 0, 3),
                        defaultAlignment: go.Spot.Left
                    },
                    $(go.RowColumnDefinition, { column: 2, width: 4 }
                    ),
                    $(go.TextBlock,
                        {
                            row: 0,
                            column: 0,
                            name: 'TEXT',
                            margin: 6,
                            font: font14,
                            editable: true,
                            stroke: "#000",
                            maxSize: new go.Size(130, NaN),
                            alignment: go.Spot.TopLeft
                        },
                        new go.Binding("text", "text").makeTwoWay())
                ),
                $(go.TextBlock, textStyle(),  // the name
                    {
                        row: 1,
                        column: 0,
                        columnSpan: 5,
                        font: font14,
                        editable: true, isMultiline: false,
                        minSize: new go.Size(10, 16)
                    },
                    new go.Binding("text", "name").makeTwoWay()
                ),
                $(go.TextBlock, textStyle(),
                    {
                        row: 2,
                        column: 0
                    },
                    new go.Binding("text", "key", function (v) { return "id: " + v; })
                ),
                $(go.TextBlock, textStyle(),
                    {
                        row: 3,
                        column: 0
                    },
                    new go.Binding("text", "index", function (v) { return "index: " + v; })
                )
            )
        );

    // unmovable node that acts as a button
    // myDiagram.nodeTemplateMap.add('newbutton',
    //   $(go.Node, "Horizontal",
    //     {
    //       selectable: false,
    //       click: function(e, node) {
    //         myDiagram.startTransaction('add node');
    //         var newdata = { group:"Problems", loc:"0 50", text: "New item " + node.containingGroup.memberParts.count, color: 0 };
    //         myDiagram.model.addNodeData(newdata);
    //         myDiagram.commitTransaction('add node');
    //         var node = myDiagram.findNodeForData(newdata);
    //         myDiagram.select(node);
    //         myDiagram.commandHandler.editTextBlock();
    //       },
    //       background: 'white'
    //     },
    //     $(go.Panel, "Auto",
    //       $(go.Shape, "Rectangle", { strokeWidth: 0, stroke: null, fill: '#6FB583' }),
    //       $(go.Shape, "PlusLine", { margin: 6, strokeWidth: 2, width: 12, height: 12, stroke: 'white', background: '#6FB583' })
    //     ),
    //     $(go.TextBlock, "New item", { font: '10px Lato, sans-serif', margin: 6,  })
    //   )
    // );

    // While dragging, highlight the dragged-over group

    function highlightGroup(grp, show) {
        if (!grp) return;
        if (show) { // check that the drop may really happen into the Group
            var tool = grp.diagram.toolManager.draggingTool;
            var map = tool.draggedParts || tool.copiedParts; // this is a Map
            if (grp.canAddMembers(map.toKeySet())) {
                grp.isHighlighted = true;
                return;
            }
        }
        grp.isHighlighted = false;
    }

    myDiagram.groupTemplate =
        $(go.Group, "Vertical", {
            copyable: false,
            movable: false,
            deletable: false,
            selectionAdorned: false,
            selectionObjectName: "SHAPE", // even though its not selectable, this is used in the layout
            layerName: "Background", // all lanes are always behind all nodes and links
            layout: $(go.GridLayout, // automatically lay out the lane's subgraph
                {
                    wrappingColumn: 1,
                    cellSize: new go.Size(1, 1),
                    spacing: new go.Size(5, 5),
                    alignment: go.GridLayout.Position,
                    comparer: function (a, b) { // can re-order tasks within a lane
                        // console.log('In comparer');
                        var ay = a.location.y;
                        var by = b.location.y;
                        if (isNaN(ay) || isNaN(by)) return 0;
                        if (ay < by) return -1;
                        if (ay > by) return 1;
                        return 0;
                    }
                }),
            computesBoundsAfterDrag: true, // needed to prevent recomputing Group.placeholder bounds too soon
            handlesDragDropForMembers: true, // don't need to define handlers on member Nodes and Links
            mouseDragEnter: function (e, grp, prev) {
                highlightGroup(grp, true);
            },
            mouseDragLeave: function (e, grp, next) {
                highlightGroup(grp, false);
            },
            mouseDrop: function (e, grp) { // dropping a copy of some Nodes and Links onto this Group adds them to this Group
                // don't allow drag-and-dropping a mix of regular Nodes and Groups
                var diagram = grp.diagram;
                var selGroup = diagram.selection.first();  // assume just one Node in selection
                // console.log('In mouseDrop. selGroup: ', selGroup);
                if (e.diagram.selection.all(function (n) {
                    return !(n instanceof go.Group);
                })) {
                    var ok = grp.addMembers(grp.diagram.selection, true);
                    if (!ok) grp.diagram.currentTool.doCancel();
                }
            },
            subGraphExpandedChanged: function (grp) {
                var shp = grp.selectionObject;
                if (grp.diagram.undoManager.isUndoingRedoing) return;
                if (grp.isSubGraphExpanded) {
                    shp.width = grp._savedBreadth;
                } else {
                    grp._savedBreadth = shp.width;
                    shp.width = NaN;
                }
            }
        },
            // new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
            new go.Binding("isSubGraphExpanded", "expanded").makeTwoWay(),
            // the lane header consisting of a TextBlock and an expander button
            $(go.Panel, "Horizontal", {
                name: "HEADER",
                angle: 0, // maybe rotate the header to read sideways going up
                alignment: go.Spot.Left
            },
                // $("SubGraphExpanderButton", {
                //   margin: 5
                // }), // this remains always visible
                $(go.Panel, "Horizontal", // this is hidden when the swimlane is collapsed
                    // new go.Binding("visible", "isSubGraphExpanded").ofObject(),
                    $(go.TextBlock, // the lane label
                        {
                            font: font15,
                            editable: false,
                            margin: new go.Margin(2, 0, 0, 0),
                            stroke: '#000fff'
                        },
                        new go.Binding("text", "text").makeTwoWay(),
                        new go.Binding("stroke", "color"))
                )
            ), // end Horizontal Panel
            $(go.Panel, "Auto", // the lane consisting of a background Shape and a Placeholder representing the subgraph
                $(go.Shape, "Rectangle", // this is the resized object
                    {
                        name: "SHAPE",
                        fill: "#F1F1F1",
                        stroke: null,
                        strokeWidth: 4
                    },
                    new go.Binding("fill", "isHighlighted", function (h) {
                        return h ? "#D6D6D6" : "#F1F1F1";
                    }).ofObject(),
                    new go.Binding("desiredSize", "size", go.Size.parse).makeTwoWay(go.Size.stringify)),
                $(go.Placeholder, {
                    padding: 12,
                    alignment: go.Spot.TopLeft
                }),
                $(go.TextBlock, // this TextBlock is only seen when the swimlane is collapsed
                    {
                        name: "LABEL",
                        font: font15,
                        editable: true,
                        angle: 90,
                        alignment: go.Spot.TopLeft,
                        margin: new go.Margin(4, 0, 0, 2)
                    },
                    new go.Binding("visible", "isSubGraphExpanded", function (e) {
                        return !e;
                    }).ofObject(),
                    new go.Binding("text", "text").makeTwoWay())
            ) // end Auto Panel
        ); // end Group

    // start off with five lanes that are positioned next to each other
    myDiagram.model = new go.GraphLinksModel([{
        "key": "awleft",
        "text": "Always Execute Left",
        "isGroup": true,
        "color": darkBlue,
        "size": laneSize//,
        //"loc": "0 23.52284749830794"
    }, {
        "key": "left",
        "text": "Execute Left Only",
        "isGroup": true,
        "color": darkBlue,
        "size": laneSize//,
        //"color": "#fff000",
        //"loc": "109 23.52284749830794"
    }, {
        "key": "Identified",
        "text": "Execute Left and Right",
        "isGroup": true,
        "size": laneSize,
        "color": darkBlue//,
        //"loc": "235 23.52284749830794"
    },
    {
        "key": "right",
        "text": "Execute Right Only",
        "isGroup": true,
        "color": darkBlue,
        "size": laneSize//,
        //"loc": "562 23.52284749830794"
    }, {
        "key": "awright",
        "text": "Always Execute Right",
        "isGroup": true,
        "color": darkBlue,
        "size": laneSize//,
        //"loc": "671 23.52284749830794"
    }
    ]);

    // initialize the left Palette
    var leftPalette =
        $(go.Palette, "leftPalette", { // share the templates with the main Diagram
            nodeTemplate: myDiagram.nodeTemplate,
            groupTemplate: myDiagram.groupTemplate,
            layout: $(go.GridLayout)
        });

    // specify the contents of the Palette
    leftPalette.model = new go.GraphLinksModel([{
        key: "pp",
        text: "PP...",
        color: "0",
        size: taskSize,
        type: "PP",
        stroke: '#009CCC',
        source: "cat1.png",
        index: "-1",
        name: "TBD"
    }, {
        key: "tt",
        text: "TT...",
        color: "1",
        size: taskSize,
        type: "TT",
        stroke: '#009CCC',
        source: "cat2.png",
        "index": "-1",
        name: "TBD"
    }, {
        key: "sc",
        text: "Scan...",
        color: "2",
        size: taskSize,
        type: "SC",
        stroke: '#009CCC',
        source: "cat3.png",
        index: "-1",
        name: "TBD"
    }]);

    // initialize the left Legend
    var rightLegend =
        $(go.Palette, "rightLegend", { // share the templates with the main Diagram
            layout: $(go.GridLayout)
        });

    var table =
        $(go.Part, "Table", {
            position: new go.Point(300, 10),
            selectable: false
        },
            $(go.TextBlock, "Key", {
                row: 0,
                font: font14
            }), // end row 0
            $(go.Panel, "Horizontal", {
                row: 1,
                alignment: go.Spot.Left
            },
                $(go.Shape, "Rectangle", {
                    desiredSize: new go.Size(10, 10),
                    fill: '#CC293D',
                    margin: 5
                }),
                $(go.TextBlock, "Always Execute", {
                    font: "13px Arial, Helvetica, sans-serif"
                })
            ), // end row 1
            $(go.Panel, "Horizontal", {
                row: 2,
                alignment: go.Spot.Left
            },
                $(go.Shape, "Rectangle", {
                    desiredSize: new go.Size(10, 10),
                    fill: '#FFD700',
                    margin: 5
                }),
                $(go.TextBlock, "Left", {
                    font: "13px Arial, Helvetica, sans-serif"
                })
            ), // end row 2
            $(go.Panel, "Horizontal", {
                row: 3,
                alignment: go.Spot.Left
            },
                $(go.Shape, "Rectangle", {
                    desiredSize: new go.Size(10, 10),
                    fill: '#009CCC',
                    margin: 5
                }),
                $(go.TextBlock, "Right", {
                    font: "13px Arial, Helvetica, sans-serif"
                })
            ) // end row 3
        );

    // Set up a Part as a legend, and place it directly on the diagram
    // rightLegend.model = new go.GraphLinksModel(table);

    // load();

    // select a Node, so that the first Inspector shows something
    // myDiagram.select(myDiagram.nodes.first());

    // support editing the properties of the selected person in HTML
    if (window.Inspector) {
        var nodeInspector = new Inspector('myNodeInspector', myDiagram,
            {
                properties: {
                    'name': { show: Inspector.showIfPresent },
                    'key': { readOnly: true, show: Inspector.showIfPresent },
                    'index': { readOnly: true, show: Inspector.showIfPresent },
                    'text': { show: Inspector.showIfPresent }
                }
            });
    }

} // end init

// Show the diagram's model in JSON format
function save() {
    document.getElementById(saveModel).value = myDiagram.model.toJson();
    myDiagram.isModified = false;
}

function load() {
    myDiagram.model = go.Model.fromJson(document.getElementById(saveModel).value);
    myDiagram.delayInitialization(relayoutDiagram);
}