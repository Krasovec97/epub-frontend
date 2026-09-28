import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import styles from "./NavBar.module.css";

export default async function NavBar() {
  const t = await getTranslations("HomePage");

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="3.5"
              y="2.5"
              width="13"
              height="19"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7 7h6M7 10.5h6M7 14h3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="17" cy="16" r="4.5" stroke="var(--primary)" strokeWidth="1.5" />
            <path
              d="M17 13.8v4.4M14.8 16h4.4"
              stroke="var(--primary)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span>{t("title")}</span>
        </Link>

        <nav className={styles.links} aria-label={t("nav.label")}>
          <Link href="/#how">{t("nav.how")}</Link>
          <Link href="/#pricing">{t("nav.pricing")}</Link>
          <Link href="/#faq">{t("nav.faq")}</Link>
        </nav>

        <LocaleSwitcher />

        <Link href="/scan" className={styles.cta}>
          {t("nav.start")}
        </Link>
      </div>
    </header>
  );
}
