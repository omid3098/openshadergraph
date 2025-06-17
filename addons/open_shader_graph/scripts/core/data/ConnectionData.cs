using Godot;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.Data
{
    public struct ConnectionEndpoint
    {
        public BaseNodeData Node { get; set; }
        public PinData Pin { get; set; }

        public ConnectionEndpoint(BaseNodeData node, PinData pin)
        {
            Node = node;
            Pin = pin;
        }
    }

    public partial class ConnectionData : RefCounted
    {
        private ConnectionEndpoint _from;
        private ConnectionEndpoint _to;

        public ConnectionData(BaseNodeData fromNode, PinData fromPin, BaseNodeData toNode, PinData toPin)
        {
            _from = new ConnectionEndpoint(fromNode, fromPin);
            _to = new ConnectionEndpoint(toNode, toPin);
            Logger.Log("[ConnectionData]: _init");
        }

        public ConnectionEndpoint GetFrom() => _from;
        public ConnectionEndpoint GetTo() => _to;
    }
}