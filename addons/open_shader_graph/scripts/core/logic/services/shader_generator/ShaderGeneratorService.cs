using System.Collections.Generic;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.Logic.Services.ShaderGenerator
{
    public class ShaderGeneratorService : IShaderGeneratorService
    {
        private readonly Dictionary<ShaderLanguage, IShaderGenerator> _generators;
        public ShaderGeneratorService()
        {
            Logger.Log("[ShaderGeneratorService] init");
            _generators = new Dictionary<ShaderLanguage, IShaderGenerator>
            {
                { ShaderLanguage.Godot, new GodotShaderGenerator() }
            };
        }
    }
}