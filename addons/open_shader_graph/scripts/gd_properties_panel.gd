@tool
extends Panel

class_name PropertiesPanel

signal property_changed(property_name: String, new_value: Variant)

var current_node: BaseNode = null

# UI components
var scroll_container: ScrollContainer
var title_label: Label
var editor_inspector: EditorInspector
var no_selection_label: Label
var property_wrapper: NodePropertyWrapper

# Custom RefCounted wrapper to expose only specific properties
class NodePropertyWrapper extends RefCounted:
	var _target_node: BaseNode
	var _properties_cache: Array = []
	
	func _init(target_node: BaseNode = null) -> void:
		_target_node = target_node
		if _target_node:
			_update_properties_cache()
	
	func _update_properties_cache() -> void:
		if _target_node and _target_node.has_method("get_property_list_for_panel"):
			_properties_cache = _target_node.get_property_list_for_panel()
	
	func _get_property_list() -> Array:
		var properties: Array = []
		
		# Only add our custom properties, not the Resource properties
		for prop in _properties_cache:
			var property_name: String = prop.get("name", "")
			var property_type: String = prop.get("type", "")
			
			var property_dict := {
				"name": property_name,
				"type": _convert_type_string_to_variant_type(property_type),
				"usage": PROPERTY_USAGE_DEFAULT
			}
			
			# Add enum hint if it's an enum property
			if property_type == "enum" and prop.has("options"):
				property_dict["hint"] = PROPERTY_HINT_ENUM
				var options: Array = prop.get("options", [])
				property_dict["hint_string"] = ",".join(options)
			
			# Add class_name for Color properties
			if property_type == "color":
				property_dict["class_name"] = "Color"
			
			properties.append(property_dict)
		
		return properties
	
	func _get(property: StringName) -> Variant:
		if _target_node and _target_node.has_method("get"):
			return _target_node.get(property)
		return null
	
	func _set(property: StringName, value: Variant) -> bool:
		if _target_node:
			if _target_node.has_method("set_property"):
				_target_node.set_property(property, value)
			elif _target_node.has_method("set"):
				_target_node.set(property, value)
			return true
		return false
	
	func _convert_type_string_to_variant_type(type_string: String) -> Variant.Type:
		match type_string:
			"bool":
				return TYPE_BOOL
			"int":
				return TYPE_INT
			"float":
				return TYPE_FLOAT
			"string":
				return TYPE_STRING
			"color":
				return TYPE_COLOR
			"float2":
				return TYPE_VECTOR2
			"float3":
				return TYPE_VECTOR3
			"float4":
				return TYPE_VECTOR4
			"enum":
				return TYPE_INT
			_:
				return TYPE_NIL

func _ready() -> void:
	# Create the main layout
	var vbox := VBoxContainer.new()
	add_child(vbox)
	vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Title
	title_label = Label.new()
	title_label.text = "Properties"
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title_label)
	
	# Add separator
	var separator := HSeparator.new()
	vbox.add_child(separator)
	
	# Scroll container for inspector
	scroll_container = ScrollContainer.new()
	scroll_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll_container)
	
	# Create the EditorInspector directly in the scroll container
	editor_inspector = EditorInspector.new()
	editor_inspector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	editor_inspector.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll_container.add_child(editor_inspector)
	
	# Create "no selection" label but don't add it yet
	no_selection_label = Label.new()
	no_selection_label.text = "No node selected"
	no_selection_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	no_selection_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	no_selection_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	no_selection_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	
	# Connect inspector signals
	editor_inspector.property_edited.connect(_on_inspector_property_edited)
	
	# Initially show "No node selected"
	_show_no_selection()

func set_selected_node(node: BaseNode) -> void:
	if current_node == node:
		return
		
	current_node = node
	_update_inspector()

func _show_no_selection() -> void:
	title_label.text = "Properties"
	
	# Hide inspector and show no selection label
	if editor_inspector.get_parent():
		editor_inspector.get_parent().remove_child(editor_inspector)
	
	if not no_selection_label.get_parent():
		scroll_container.add_child(no_selection_label)

func _update_inspector() -> void:
	if not current_node:
		_show_no_selection()
		return
	
	# Update title
	title_label.text = "Properties: " + current_node.title
	
	# Hide no selection label and show inspector
	if no_selection_label.get_parent():
		no_selection_label.get_parent().remove_child(no_selection_label)
	
	if not editor_inspector.get_parent():
		scroll_container.add_child(editor_inspector)
	
	# Create wrapper for the node properties
	property_wrapper = NodePropertyWrapper.new(current_node)
	
	# Set the inspector to edit our wrapper instead of the node directly
	editor_inspector.edit(property_wrapper)

func _on_inspector_property_edited(property_path: String) -> void:
	# The wrapper automatically handles property changes
	# We just emit our signal for any listeners
	if current_node:
		var property_value := current_node.get(property_path)
		property_changed.emit(property_path, property_value)