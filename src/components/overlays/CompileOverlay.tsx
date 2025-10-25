import FloatingOverlay from "../FloatingOverlay";
import { CompilePanel } from "../CompilePanel";
import { useGraphState } from "@/core/ui/GraphStateContext";

export function CompileOverlay() {
  const { graph } = useGraphState();
  return (
    <FloatingOverlay id="compile" title="Compile">
      <CompilePanel variant="overlay" graph={graph} className="h-full" />
    </FloatingOverlay>
  );
}

export default CompileOverlay;
