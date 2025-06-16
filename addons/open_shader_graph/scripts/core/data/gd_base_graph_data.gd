class_name BaseGraphData

enum GraphType {
    SHADER_GRAPH,
    GROUP_GRAPH,
    LOCAL_SUBGRAPH,
    GLOBAL_SUBGRAPH,
}

var _name: String = ""
var _graph_type: GraphType = GraphType.SHADER_GRAPH
var _nodes: Array[BaseNodeData] = []
var _connections: Array[ConnectionData] = []
var _file_path: String = "" # asset path used for saving and loading
var _version: String = "1.0" # version identifier for the graph asset
var _properties: Dictionary = {} # custom graph properties

func _init(_name: String, _graph_type: GraphType, _nodes: Array[BaseNodeData], _connections: Array[ConnectionData]) -> void:
    self._name = _name
    self._graph_type = _graph_type
    self._nodes = _nodes
    self._connections = _connections
    Logger.log("[BaseGraphData]: " + _name)

func get_name() -> String:
    return _name

func get_graph_type() -> GraphType:
    return _graph_type

func get_nodes() -> Array[BaseNodeData]:
    return _nodes

func get_connections() -> Array[ConnectionData]:
    return _connections

func get_version() -> String:
    return _version

func get_file_path() -> String:
    return _file_path

func get_properties() -> Dictionary:
    return _properties

func set_version(version: String) -> void:
    _version = version

func set_file_path(file_path: String) -> void:
    _file_path = file_path

func set_properties(properties: Dictionary) -> void:
    _properties = properties

func add_node(node: BaseNodeData) -> void:
    if node == null:
        return # Silently ignore null nodes
    _nodes.append(node)

func add_connection(connection: ConnectionData) -> void:
    if connection == null:
        return # Silently ignore null connections
    var valid: bool = validate_connection(connection)
    if valid:
        _connections.append(connection)

func validate_connection(connection: ConnectionData) -> bool:
    # Handle null connection
    if connection == null:
        return false
    var from: Dictionary = connection.get_from()
    var to: Dictionary = connection.get_to()
    var from_node: BaseNodeData = from["node"]
    var from_pin: PinData = from["pin"]
    var to_node: BaseNodeData = to["node"]
    var to_pin: PinData = to["pin"]
    # Handle null nodes or pins
    if from_node == null or to_node == null or from_pin == null or to_pin == null:
        return false
    # Connection from and to the same node
    if from_node == to_node:
        Logger.log("[BaseGraphData] Connection from and to the same node: " + from_node.get_name())
        return false
    # Connection from and to the same pin
    if from_pin.get_direction() == to_pin.get_direction():
        Logger.log("[BaseGraphData] Connection from and to the same pin: " + from_pin.get_name())
        return false
    # Node has no output pin
    if from_node.get_outputs().size() == 0:
        Logger.log("[BaseGraphData] Node has no output pin: " + from_node.get_name())
        return false
    # Node has no input pin
    if to_node.get_inputs().size() == 0:
        Logger.log("[BaseGraphData] Node has no input pin: " + to_node.get_name())
        return false
    # Node source does not exist in the graph
    if not _nodes.has(from_node):
        Logger.log("[BaseGraphData] Node does not exist in the graph: " + from_node.get_name())
        return false
    # Node destination does not exist in the graph
    if not _nodes.has(to_node):
        Logger.log("[BaseGraphData] Node does not exist in the graph: " + to_node.get_name())
        return false
    # Type mismatch : TODO: Fix this after type conversion is implemented
    if from_pin.get_data_type() != to_pin.get_data_type():
        Logger.log("[BaseGraphData] Type mismatch: " + from_pin.get_data_type() + " -> " + to_pin.get_data_type())
        return false
    return true