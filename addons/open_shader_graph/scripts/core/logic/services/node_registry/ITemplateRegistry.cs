#nullable enable

using System.Collections.Generic;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Logic.Services.TemplateRegistry
{
    public interface ITemplateRegistry
    {
        Dictionary<string, NodeTemplate> GetRegisteredTemplates();
        NodeTemplate? FindTemplate(string name);
    }
}