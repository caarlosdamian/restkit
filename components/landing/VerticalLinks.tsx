import Link from "next/link";
import { VERTICALS, verticalLinkLabel } from "@/lib/verticals";

/**
 * The index that ties the vertical pages together.
 *
 * It sits in the shared footer on purpose: every one of these pages links to
 * every other, which is what lets a crawler find all of them from anywhere on
 * the site instead of only from the sitemap.
 */
export default function VerticalLinks({ exclude }: { exclude?: string }) {
  const items = VERTICALS.filter((v) => v.slug !== exclude);

  return (
    <div className="max-w-[1200px] mx-auto px-6 border-t border-gray-200 py-10">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">
        RestKit para tu negocio
      </h2>
      <p className="mt-1 text-sm text-gray-400">
        Funciona para cualquier negocio local. Estos son algunos.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <li key={v.slug}>
            <Link
              href={`/lealtad/${v.slug}`}
              className="text-sm text-gray-500 no-underline transition-colors hover:text-emerald-600"
            >
              {verticalLinkLabel(v)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
