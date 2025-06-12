class_name GraphsList extends Tree

# This class will contain a list of graphs that the user can select from

func _init() -> void:
	print("[GraphsList] init")
	# A lable for the graphs list
	var label = Label.new()
	label.text = "Graphs"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	label.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(label)
