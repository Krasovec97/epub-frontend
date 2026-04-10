import { getTranslations } from "next-intl/server";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import styles from "./NavBar.module.css";

export default async function NavBar() {
  const t = await getTranslations("HomePage");

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">◆</span>
          {t("title")}
        </span>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
