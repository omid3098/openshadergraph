import FloatingOverlay from "../FloatingOverlay";
import { AssetsPanel } from "../AssetsPanel";

export function AssetsOverlay() {
  return (
    <FloatingOverlay id="assets" title="Assets">
      <AssetsPanel variant="overlay" className="h-full" />
    </FloatingOverlay>
  );
}

export default AssetsOverlay;
