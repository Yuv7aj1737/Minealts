import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { siteConfig } from "@/lib/constants";

const columns: readonly {
  title: string;
  items: readonly { label: string; href: string; disabled?: boolean }[];
}[] = [
  {
    title: "Marketplace",
    items: [
      { label: "Browse listings", href: "/#roadmap", disabled: true },
      { label: "Become a seller", href: "/#roadmap", disabled: true },
      { label: "Payouts", href: "/#roadmap", disabled: true },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Sign in", href: "/login" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-surface-300/60 bg-surface-50/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
            {siteConfig.description}
          </p>
          <p className="mt-4 text-xs text-ink-500">
            Not affiliated with Mojang Studios or Microsoft.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold tracking-wide text-ink-200 uppercase">
              {column.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {column.items.map((item) => (
                <li key={item.label}>
                  {item.disabled ? (
                    <span className="inline-flex items-center gap-2 text-sm text-ink-500">
                      {item.label}
                      <span className="rounded-full border border-accent-400/30 bg-accent-400/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent-300 uppercase">
                        Soon
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="text-sm text-ink-400 transition-colors hover:text-brand-300"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-surface-300/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-ink-500 sm:flex-row sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p>Built with Next.js, Prisma and Tailwind CSS.</p>
        </div>
      </div>
    </footer>
  );
}
