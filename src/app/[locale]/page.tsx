import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import HowItWorks from "@/components/HowItWorks";
import PricingCard from "@/components/PricingCard";
import DesktopHandoff from "@/components/DesktopHandoff";
import { getIsMobile, getCurrentUrl } from "@/lib/request-context";
import styles from "./page.module.css";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");
  const isMobile = await getIsMobile();

  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>BOOK → EPUB</p>
          <h1 className={styles.heroTitle}>{t("hero.title")}</h1>
          <p className={styles.heroSub}>{t("hero.subtitle")}</p>
          {isMobile && (
            <Link href="/scan" className={styles.heroCta}>
              {t("hero.cta")} →
            </Link>
          )}
        </div>
      </section>

      <HowItWorks
        heading={t("howItWorks.heading")}
        steps={[
          { title: t("howItWorks.step1.title"), desc: t("howItWorks.step1.desc") },
          { title: t("howItWorks.step2.title"), desc: t("howItWorks.step2.desc") },
          { title: t("howItWorks.step3.title"), desc: t("howItWorks.step3.desc") },
        ]}
      />

      {isMobile ? (
        <section id="start" className={styles.uploadSection}>
          <div className={styles.sectionInner}>
            <h2 className={styles.sectionHeading}>{t("start.heading")}</h2>
            <Link href="/scan" className={styles.mobileCta}>
              {t("start.mobileCta")}
            </Link>
          </div>
        </section>
      ) : (
        <DesktopHandoff url={await getCurrentUrl(locale === "sl" ? "/scan" : `/${locale}/scan`)} />
      )}

      <section className={styles.pricingSection}>
        <div className={styles.sectionInner}>
          <PricingCard
            heading={t("pricing.heading")}
            price={t("pricing.price")}
            perPage={t("pricing.perPage")}
            minimumNote={t("pricing.minimumNote")}
            paymentNote={t("pricing.paymentNote")}
          />
        </div>
      </section>
    </main>
  );
}
