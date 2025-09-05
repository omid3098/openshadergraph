shader_type spatial;


void vertex() {

}

void fragment() {
	vec4 color_4 = vec4(1.0, 1.0, 1.0, 1.0);
	float float_5 = 0.0;
	float float_6 = 0.0;
	vec4 color_7 = vec4(1.0, 1.0, 1.0, 1.0);
	vec4 color_8 = vec4(1.0, 1.0, 1.0, 1.0);
	float float_9 = 0.0;
	ALBEDO = vec3(color_4.rgb);
		ROUGHNESS = float_5;
		METALLIC = float_6;
		EMISSION = vec3(color_7.rgb);
		NORMAL = vec3(color_8.rgb);
		ALPHA = float_9;

}


