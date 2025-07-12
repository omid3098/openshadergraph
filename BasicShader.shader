Shader "Custom/Surface" {
    Properties {
    }
    SubShader {
        
        CGPROGRAM
        #pragma surface surf Standard
        struct Input {
            float2 uv_MainTex;
        };
        void surf (Input IN, inout SurfaceOutputStandard o) {
            float4 color_1_out = float4(1.0, 1.0, 1.0, 1.0);
    o.Albedo = float3(color_1_out.rgb);
        }
        ENDCG
    }
}
