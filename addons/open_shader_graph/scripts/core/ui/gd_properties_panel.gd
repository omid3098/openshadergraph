class_name PropertiesPanel extends PanelContainer

func _init() -> void:
	print("[PropertiesPanel] init")
	# A lable for the properties panel
	var label = Label.new()
	label.text = "Properties"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	label.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(label)