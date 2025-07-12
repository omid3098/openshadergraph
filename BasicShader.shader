Shader "Custom/Surface" {
    Properties {
        [Header(Color)]
_color_1_out ("Color", Color) = (1,1,1,1)
    }
    SubShader {
        Tags { "Queue" = "Transparent" }
Blend SrcAlpha OneMinusSrcAlpha

        CGPROGRAM
        #pragma surface surf Standard
        struct Input {
            float2 uv_MainTex;
        };
        void surf (Input IN, inout SurfaceOutputStandard o) {
            o.Albedo = float3(color_1_out.rgb);
        }
        ENDCG
    }
}
