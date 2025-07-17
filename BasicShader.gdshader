shader_type spatial;



void vertex() {

}

void fragment() {
	vec4 color_4 = vec4(1.0, 1.0, 1.0, 1.0);
	vec4 color_5 = vec4(1.0, 1.0, 1.0, 1.0);
	float4 add_6 = color_4 + color_5;
	ALBEDO = vec3(add_6.rgb);

}

