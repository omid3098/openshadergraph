import FloatingOverlay from "../FloatingOverlay";
import { GraphDataPanel } from "../GraphDataPanel";
import { useGraphState } from "@/core/ui/GraphStateContext";

export function GraphDataOverlay() {
  const { graph } = useGraphState();
  return (
    <FloatingOverlay id="graphdata" title="Graph Data">
      <GraphDataPanel variant="overlay" data={graph} className="h-full" />
    </FloatingOverlay>
  );
}

export default GraphDataOverlay;
