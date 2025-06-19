using Godot;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.Data
{
    public struct ConnectionEndpoint
    {
        public long NodeId { get; set; }
        public PinData Pin { get; set; }

        public ConnectionEndpoint(long nodeId, PinData pin)
        {
            NodeId = nodeId;
            Pin = pin;
        }
    }

    public partial class ConnectionData : RefCounted
    {
        private ConnectionEndpoint _from;
        private ConnectionEndpoint _to;

        public ConnectionData(long fromNodeId, PinData fromPin, long toNodeId, PinData toPin)
        {
            _from = new ConnectionEndpoint(fromNodeId, fromPin);
            _to = new ConnectionEndpoint(toNodeId, toPin);
            Logger.Log("[ConnectionData]: _init");
        }

        public ConnectionEndpoint GetFrom() => _from;
        public ConnectionEndpoint GetTo() => _to;
    }
}