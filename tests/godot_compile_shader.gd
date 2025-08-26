extends SceneTree

func _init():
    var args = OS.get_cmdline_args()
    if args.size() == 0:
        push_error("No shader file provided")
        get_tree().quit(1)
        return
    var shader_path = args[0]
    var code = FileAccess.get_file_as_string(shader_path)
    var shader = Shader.new()
    shader.code = code
    get_tree().quit()
