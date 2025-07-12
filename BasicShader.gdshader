shader_type spatial;
render_mode blend_add;

uniform vec4 color_1_out = vec4(1.0, 1.0, 1.0, 1.0);
void vertex() {
    
}

    void fragment() {
    ALBEDO = vec3(color_1_out.rgb);
}

