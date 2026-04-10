import GraphView from "@/components/GraphView";

export default function GraphPage() {
  return (
    <div className="w-full h-full -m-6 md:-m-8">
      {/* Negative margin to break out of the padding applied by layout.tsx's <main> wrapper to go full bleed */}
      <GraphView />
    </div>
  );
}
