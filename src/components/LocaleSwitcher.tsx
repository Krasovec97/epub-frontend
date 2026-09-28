"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import styles from "./LocaleSwitcher.module.css";

const LABELS: Record<string, string> = {
  sl: "SL",
  en: "EN",
};

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(next: string) {
    router.replace(pathname, { locale: next });
  }

  return (
    <div className={styles.switcher} role="group" aria-label="Language">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className={`${styles.btn} ${loc === locale ? styles.active : ""}`}
          onClick={() => switchLocale(loc)}
          disabled={loc === locale}
          aria-pressed={loc === locale}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
