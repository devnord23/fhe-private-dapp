export const dynamic = "force-static";

export default function HealthPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <p className="font-mono text-brand-400 text-2xl font-bold">OK</p>
        <p className="font-mono text-xs text-gray-600">ConfidentialFi · Next.js operational</p>
      </div>
    </div>
  );
}
