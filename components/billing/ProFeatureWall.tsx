import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Per-feature upsell shown in place of a page's content when the business's
 * plan tier doesn't include it (e.g. Básico opening Inventario). Unlike
 * UpgradeWall (expired access — everything blocked), this is a targeted
 * "this one feature needs Profesional" pitch. Server-rendered: the real
 * content is never fetched or rendered behind it.
 */
export default function ProFeatureWall({
  featureName,
  description,
}: {
  featureName: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
          <Sparkles size={26} />
        </div>
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-violet-500 mb-2">
          Plan Profesional
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          {featureName} no está en tu plan
        </h1>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
        <Link
          href="/dashboard/billing"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-600 transition-colors no-underline"
        >
          Mejorar a Profesional
        </Link>
      </div>
    </div>
  );
}
