@tool
extends Control

class_name OpenShaderEditor


func _ready():
	print("[DEBUG] OpenShaderEditor _ready() called")
	pass


func _on_add_node_request(position: Vector2 = Vector2.ZERO, nodeType: BaseNode = null):
	if nodeType == null:
		return
	
	var node = nodeType.new()
	node.position = position
	add_child(node)