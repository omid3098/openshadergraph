@tool
extends BaseTest
class_name TestConnectionData

var from_node: BaseNodeData
var to_node: BaseNodeData
var from_pin: PinData
var to_pin: PinData
var test_connection: ConnectionData

func before_each():
	# Create pins
	from_pin = PinData.new("output", "float", PinData.PinType.OUTPUT)
	to_pin = PinData.new("input", "float", PinData.PinType.INPUT)
	
	# Create nodes
	from_node = BaseNodeData.new("SourceNode", "ConstantNode", Vector2(0, 0), [], [from_pin])
	to_node = BaseNodeData.new("TargetNode", "AddNode", Vector2(100, 0), [to_pin], [])
	
	# Create connection
	test_connection = ConnectionData.new(from_node, from_pin, to_node, to_pin)

func after_each():
	test_connection = null
	from_node = null
	to_node = null
	from_pin = null
	to_pin = null

# Test connection creation
func test_connection_creation():
	assert_not_null(test_connection, "Connection should be created")
	assert_equal(from_node, test_connection.from_node, "From node should be set correctly")
	assert_equal(from_pin, test_connection.from_pin, "From pin should be set correctly")
	assert_equal(to_node, test_connection.to_node, "To node should be set correctly")
	assert_equal(to_pin, test_connection.to_pin, "To pin should be set correctly")

# Test connection data integrity
func test_connection_data_integrity():
	assert_equal("SourceNode", test_connection.from_node.name, "From node name should be preserved")
	assert_equal("TargetNode", test_connection.to_node.name, "To node name should be preserved")
	assert_equal("output", test_connection.from_pin.name, "From pin name should be preserved")
	assert_equal("input", test_connection.to_pin.name, "To pin name should be preserved")

# Test connection with different data types
func test_connection_different_types():
	var vector_out = PinData.new("vector_out", "vector3", PinData.PinType.OUTPUT)
	var vector_in = PinData.new("vector_in", "vector3", PinData.PinType.INPUT)
	
	var vector_source = BaseNodeData.new("VectorSource", "VectorNode", Vector2(0, 0), [], [vector_out])
	var vector_target = BaseNodeData.new("VectorTarget", "VectorNode", Vector2(100, 0), [vector_in], [])
	
	var vector_connection = ConnectionData.new(vector_source, vector_out, vector_target, vector_in)
	
	assert_equal("vector3", vector_connection.from_pin.data_type, "From pin should have vector3 type")
	assert_equal("vector3", vector_connection.to_pin.data_type, "To pin should have vector3 type")

# Test connection with complex node names
func test_connection_complex_names():
	var complex_from = BaseNodeData.new("Complex Node With Spaces", "ComplexType", Vector2(0, 0), [], [from_pin])
	var complex_to = BaseNodeData.new("Another-Complex_Node123", "AnotherType", Vector2(100, 0), [to_pin], [])
	
	var complex_connection = ConnectionData.new(complex_from, from_pin, complex_to, to_pin)
	
	assert_equal("Complex Node With Spaces", complex_connection.from_node.name, "Complex from node name should be preserved")
	assert_equal("Another-Complex_Node123", complex_connection.to_node.name, "Complex to node name should be preserved")

# Test connection reference integrity
func test_connection_reference_integrity():
	# Modify original nodes and check if connection still references them correctly
	from_node.name = "ModifiedSourceName"
	to_node.name = "ModifiedTargetName"
	
	assert_equal("ModifiedSourceName", test_connection.from_node.name, "Connection should reference modified from node")
	assert_equal("ModifiedTargetName", test_connection.to_node.name, "Connection should reference modified to node")

# Test connection with modified pins
func test_connection_pin_modification():
	# Modify pin properties and check if connection still references them
	from_pin.name = "modified_output"
	to_pin.name = "modified_input"
	
	assert_equal("modified_output", test_connection.from_pin.name, "Connection should reference modified from pin")
	assert_equal("modified_input", test_connection.to_pin.name, "Connection should reference modified to pin")

# Test connection equality (reference-based)
func test_connection_equality():
	var same_connection = ConnectionData.new(from_node, from_pin, to_node, to_pin)
	
	# Connections are reference-based, so they won't be equal even with same parameters
	assert_not_equal(test_connection, same_connection, "Different connection instances should not be equal")

# Test connection with same node different pins
func test_connection_same_node_different_pins():
	var output2 = PinData.new("output2", "float", PinData.PinType.OUTPUT)
	var input2 = PinData.new("input2", "float", PinData.PinType.INPUT)
	
	from_node.outputs.append(output2)
	to_node.inputs.append(input2)
	
	var connection2 = ConnectionData.new(from_node, output2, to_node, input2)
	
	assert_equal(from_node, connection2.from_node, "Second connection should use same from node")
	assert_equal(to_node, connection2.to_node, "Second connection should use same to node")
	assert_equal("output2", connection2.from_pin.name, "Second connection should use different from pin")
	assert_equal("input2", connection2.to_pin.name, "Second connection should use different to pin")

# Test connection with null references (edge case)
func test_connection_null_references():
	# This tests edge case behavior - in real usage, nulls shouldn't be passed
	var null_connection = ConnectionData.new(null, null, null, null)
	
	assert_null(null_connection.from_node, "Connection should accept null from node")
	assert_null(null_connection.from_pin, "Connection should accept null from pin")
	assert_null(null_connection.to_node, "Connection should accept null to node")
	assert_null(null_connection.to_pin, "Connection should accept null to pin")

# Test multiple connections between same nodes
func test_multiple_connections_same_nodes():
	var output2 = PinData.new("output2", "vector2", PinData.PinType.OUTPUT)
	var input2 = PinData.new("input2", "vector2", PinData.PinType.INPUT)
	
	from_node.outputs.append(output2)
	to_node.inputs.append(input2)
	
	var connection1 = ConnectionData.new(from_node, from_pin, to_node, to_pin)
	var connection2 = ConnectionData.new(from_node, output2, to_node, input2)
	
	assert_equal(connection1.from_node, connection2.from_node, "Both connections should reference same from node")
	assert_equal(connection1.to_node, connection2.to_node, "Both connections should reference same to node")
	assert_not_equal(connection1.from_pin, connection2.from_pin, "Connections should use different from pins")
	assert_not_equal(connection1.to_pin, connection2.to_pin, "Connections should use different to pins")

# Test connection pin type validation (data structure level)
func test_connection_pin_types():
	assert_equal(PinData.PinType.OUTPUT, test_connection.from_pin.direction, "From pin should be output type")
	assert_equal(PinData.PinType.INPUT, test_connection.to_pin.direction, "To pin should be input type")

# Test connection data type matching
func test_connection_data_type_matching():
	assert_equal("float", test_connection.from_pin.data_type, "From pin should have float type")
	assert_equal("float", test_connection.to_pin.data_type, "To pin should have float type")

# Test connection with mismatched data types (structure level)
func test_connection_mismatched_types():
	var float_pin = PinData.new("float_out", "float", PinData.PinType.OUTPUT)
	var vector_pin = PinData.new("vector_in", "vector3", PinData.PinType.INPUT)
	
	var mismatched_connection = ConnectionData.new(from_node, float_pin, to_node, vector_pin)
	
	assert_equal("float", mismatched_connection.from_pin.data_type, "From pin should have float type")
	assert_equal("vector3", mismatched_connection.to_pin.data_type, "To pin should have vector3 type")
	assert_not_equal(mismatched_connection.from_pin.data_type, mismatched_connection.to_pin.data_type, "Pin types should be different")