#nullable enable

using System.Collections.Generic;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Logic.Services.LanguageRegistry
{
    public interface ILanguageRegistry
    {
        Dictionary<string, LanguageTemplate> GetRegisteredTemplates();
        LanguageTemplate? FindTemplate(string name);
        string GetDefaultLanguage();
    }
}