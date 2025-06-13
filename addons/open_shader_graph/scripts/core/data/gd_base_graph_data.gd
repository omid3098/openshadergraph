class_name BaseGraphData

enum GraphType {
    SHADER_GRAPH,
    GROUP_GRAPH,
    LOCAL_SUBGRAPH,
    GLOBAL_SUBGRAPH,
}

var name: String = ""
var graph_type: GraphType = GraphType.SHADER_GRAPH
var nodes: Array[BaseNodeData] = []
var connections: Array[ConnectionData] = []

func _init(_name: String, _graph_type: GraphType, _nodes: Array[BaseNodeData], _connections: Array[ConnectionData]) -> void:
    name = _name
    graph_type = _graph_type
    nodes = _nodes
    connections = _connections
    print("BaseGraphData: " + name)

func add_node(node: BaseNodeData) -> void:
    nodes.append(node)

func add_connection(connection: ConnectionData) -> void:
    var valid: bool = validate_connection(connection)
    if valid:
        connections.append(connection)

func validate_connection(connection: ConnectionData) -> bool:
    # Connection from and to the same node
    if connection.from_node == connection.to_node:
        print("Connection from and to the same node: " + connection.from_node.name)
        return false
    # Connection from and to the same pin
    if connection.from_pin.direction == connection.to_pin.direction:
        print("Connection from and to the same pin: " + connection.from_pin.name)
        return false
    # Node has no output pin
    if connection.from_node.outputs.size() == 0:
        print("Node has no output pin: " + connection.from_node.name)
        return false
    # Node has no input pin
    if connection.to_node.inputs.size() == 0:
        print("Node has no input pin: " + connection.to_node.name)
        return false
    # Node source does not exist in the graph
    if not nodes.has(connection.from_node):
        print("Node does not exist in the graph: " + connection.from_node.name)
        return false
    # Node destination does not exist in the graph
    if not nodes.has(connection.to_node):
        print("Node does not exist in the graph: " + connection.to_node.name)
        return false
    # Type mismatch : TODO: Fix this after type conversion is implemented
    if connection.from_pin.data_type != connection.to_pin.data_type:
        print("Type mismatch: " + connection.from_pin.data_type + " -> " + connection.to_pin.data_type)
        return false
    return true