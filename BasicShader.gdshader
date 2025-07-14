shader_type spatial;
Tags { "Queue" = "Transparent" }
Blend SrcAlpha OneMinusSrcAlpha



void vertex() {

}

void fragment() {
	vec4 Color = vec4(1.0, 1.0, 1.0, 1.0);
	ALBEDO = vec3(Color.rgb);

}

