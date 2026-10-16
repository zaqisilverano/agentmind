/** Bottom-right reminder of the canvas controls. */
export function Hint() {
  return (
    <div className="pointer-events-none fixed right-[30px] bottom-6 z-[2] font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
      Drag to orbit · Scroll to zoom · Click a node
    </div>
  );
}
