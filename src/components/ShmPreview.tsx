import { useState } from "react";
import { PreviewDialog } from "./PreviewDialog";
import { ShmSimulator } from "./ShmSimulator";

export function ShmPreview() {
  const [open, setOpen] = useState(false);
  return <div className="shm-launch no-print">
    <button className="doc-button" onClick={() => setOpen(true)} aria-haspopup="dialog">Try the alert logic</button>
    {open && <PreviewDialog title="SHM alert simulation" onClose={() => setOpen(false)}><ShmSimulator /></PreviewDialog>}
  </div>;
}
