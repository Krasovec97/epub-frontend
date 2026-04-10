import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import HowItWorks from "@/components/HowItWorks";
import UploadZone from "@/components/UploadZone";
import PricingCard from "@/components/PricingCard";
import styles from "./page.module.css";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomePageContent />;
}

function HomePageContent() {
  const t = useTranslations("HomePage");

  return (
    <main>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>PDF · PNG · JPG → EPUB</p>
          <h1 className={styles.heroTitle}>{t("hero.title")}</h1>
          <p className={styles.heroSub}>{t("hero.subtitle")}</p>
          <a href="#upload" className={styles.heroCta}>
            {t("hero.cta")} →
          </a>
        </div>
      </section>

      {/* How it works */}
      <HowItWorks
        heading={t("howItWorks.heading")}
        steps={[
          { title: t("howItWorks.step1.title"), desc: t("howItWorks.step1.desc") },
          { title: t("howItWorks.step2.title"), desc: t("howItWorks.step2.desc") },
          { title: t("howItWorks.step3.title"), desc: t("howItWorks.step3.desc") },
        ]}
      />

      {/* Upload zone */}
      <section id="upload" className={styles.uploadSection}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionHeading}>{t("upload.heading")}</h2>
          <UploadZone />
        </div>
      </section>

      {/* Pricing */}
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
