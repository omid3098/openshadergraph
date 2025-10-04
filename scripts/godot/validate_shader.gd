extends SceneTree

func _initialize():
    var dir_env := OS.get_environment("OSG_SHADER_DIR")
    if dir_env == "":
        push_error("OSG_SHADER_DIR not provided")
        quit(2)
        return

    var shader_dir := ProjectSettings.globalize_path(dir_env)
    var dir := DirAccess.open(shader_dir)
    if dir == null:
        push_error("Failed to open shader directory: %s" % shader_dir)
        quit(3)
        return

    var files := []
    dir.list_dir_begin()
    while true:
        var name := dir.get_next()
        if name == "":
            break
        if dir.current_is_dir():
            continue
        if name.ends_with(".gdshader"):
            files.append(name)
    dir.list_dir_end()

    files.sort()
    if files.is_empty():
        push_error("No shader files found in directory: %s" % shader_dir)
        quit(4)
        return

    var failures := 0
    for file_name in files:
        var abs_path := shader_dir.path_join(file_name)
        var shader_code := FileAccess.get_file_as_string(abs_path)
        if shader_code == "":
            print("ERROR::%s::Empty shader source" % file_name)
            failures += 1
            continue

        var shader := Shader.new()
        print("CHECK::%s" % file_name)
        shader.set_code(shader_code)

        var rid := shader.get_rid()
        if typeof(rid) != TYPE_RID or not rid.is_valid():
            print("ERROR::%s::Invalid shader RID" % file_name)
            failures += 1
            continue

        print("OK::%s::compiled" % file_name)

    if failures > 0:
        quit(1)
    else:
        quit(0)
