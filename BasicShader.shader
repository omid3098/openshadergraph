Shader "Custom/{{name}}" {
    Properties {
        
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
            
        }
        ENDCG
    }
}
