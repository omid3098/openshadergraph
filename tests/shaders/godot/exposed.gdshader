shader_type spatial;

uniform vec4 color_4 = vec4(1.0, 0.0, 0.0, 1.0);
uniform vec4 color_5 = vec4(0.0, 1.0, 0.0, 1.0);

void vertex() {

}

void fragment() {


	vec4 add_6 = color_4 + color_5;
	ALBEDO = vec3(add_6.rgb);

}


