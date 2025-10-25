import FloatingOverlay from "../FloatingOverlay";
import { PropertiesPanel } from "../PropertiesPanel";

export function PropertiesOverlay() {
  return (
    <FloatingOverlay id="properties" title="Properties">
      <PropertiesPanel variant="overlay" className="h-full overflow-auto px-4 pb-4" />
    </FloatingOverlay>
  );
}

export default PropertiesOverlay;
