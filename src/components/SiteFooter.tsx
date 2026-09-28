import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import styles from "./SiteFooter.module.css";

export default async function SiteFooter() {
  const t = await getTranslations("HomePage.footer");

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>{t("rights")}</span>
        <nav className={styles.links} aria-label={t("label")}>
          <Link href="/#pricing">{t("pricing")}</Link>
          <Link href="/#faq">{t("faq")}</Link>
        </nav>
      </div>
    </footer>
  );
}
