using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace OpenShaderGraph.Core.Logic
{
    public static class PlaceholderReplacer
    {
        public static string Replace(string template, Dictionary<string, string> values)
        {
            if (template == null) throw new ArgumentNullException(nameof(template));
            if (values == null) throw new ArgumentNullException(nameof(values));

            // Match placeholders of the form {key} where key consists of word characters only
            var pattern = @"\{(?<key>\w+)\}";
            var missingKeys = new HashSet<string>();
            var result = Regex.Replace(template, pattern, match =>
            {
                var key = match.Groups["key"].Value;
                if (!values.TryGetValue(key, out var value))
                {
                    missingKeys.Add(key);
                    return match.Value;
                }
                return value;
            });

            if (missingKeys.Count > 0)
            {
                throw new ArgumentException($"Missing placeholders for keys: {string.Join(", ", missingKeys)}");
            }

            return result;
        }
    }
}