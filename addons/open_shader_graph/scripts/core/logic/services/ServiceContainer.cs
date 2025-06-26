using System;
using System.Collections.Generic;
using System.Linq;

namespace OpenShaderGraph.Core.Utils
{
    // Defines an initialization contract for services
    public interface IInitializable
    {
        void Init();
    }

    // Simple service locator for registering and retrieving services
    public static class Services
    {
        private static readonly Dictionary<Type, object> _map = new();

        // Registers a service instance by its type
        public static void Register<T>(T service)
        {
            _map[typeof(T)] = service!;
        }

        // Retrieves a registered service, or throws if not found
        public static T Get<T>()
        {
            if (_map.TryGetValue(typeof(T), out var svc) && svc is T typed)
                return typed;
            throw new InvalidOperationException($"Service {typeof(T)} not registered.");
        }

        // Calls Init() on all IInitializable services
        public static void InitAll()
        {
            foreach (var init in _map.Values.OfType<IInitializable>())
                init.Init();
        }
    }
}