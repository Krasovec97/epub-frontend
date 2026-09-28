import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import HeroPanel from "@/components/HeroPanel";
import HowItWorks, { type PipelineStep } from "@/components/HowItWorks";
import PricingCard from "@/components/PricingCard";
import Faq from "@/components/Faq";
import DesktopHandoff from "@/components/DesktopHandoff";
import { getIsMobile, getCurrentUrl } from "@/lib/request-context";
import { getPricePerPageEur, getMinimumPages, formatEur } from "@/lib/pricing";
import styles from "./page.module.css";

/* A paperback, used as the worked example in the price list. */
const EXAMPLE_PAGES = 180;

/* Same-page jumps must stay plain anchors: the localised Link would rewrite a
   bare "#start" into a route. */
function StartLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function ArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13M12.5 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const VALUE_ICONS = [
  /* camera */
  <svg key="camera" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.8a1 1 0 0 1 .9-.5h4.6a1 1 0 0 1 .9.5L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12.2" r="3.2" stroke="currentColor" strokeWidth="1.5" />
  </svg>,
  /* live quality check */
  <svg key="quality" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.5" />
  </svg>,
  /* book */
  <svg key="epub" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 4h10a2 2 0 0 1 2 2v14l-7-3.2L5 20V6a2 2 0 0 1 2-2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>,
  /* invoice */
  <svg key="invoice" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 7.5h16M4 7.5v10A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-10M4 7.5 5.4 5.2a1.5 1.5 0 0 1 1.3-.7h10.6a1.5 1.5 0 0 1 1.3.7L20 7.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M9.6 11.5h4.8M9.6 14.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>,
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");
  const isMobile = await getIsMobile();

  const pricePerPage = getPricePerPageEur();
  const minimumPages = getMinimumPages();
  const minimumTotal = pricePerPage * minimumPages;

  /* On a phone the CTA opens the camera; on a desktop it jumps to the QR handoff. */
  const startHref = isMobile ? "/scan" : "#start";

  const pipelineStep = (n: 1 | 2 | 3): PipelineStep => ({
    stage: t(`howItWorks.step${n}.stage`),
    title: t(`howItWorks.step${n}.title`),
    desc: t(`howItWorks.step${n}.desc`),
    bullets: [
      t(`howItWorks.step${n}.b1`),
      t(`howItWorks.step${n}.b2`),
      t(`howItWorks.step${n}.b3`),
    ],
  });

  const values = [0, 1, 2, 3].map((i) => ({
    icon: VALUE_ICONS[i],
    title: t(`why.v${i + 1}.title`),
    desc: t(`why.v${i + 1}.desc`),
  }));

  return (
    <main id="top">
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.eyebrow}>{t("hero.eyebrow")}</p>
            <h1 className={styles.heroTitle}>
              {t.rich("hero.title", { em: (chunks) => <em>{chunks}</em> })}
            </h1>
            <p className={styles.lede}>{t("hero.subtitle")}</p>

            <div className={styles.ctaRow}>
              <StartLink href={startHref} className={styles.btnPrimary}>
                {t("hero.cta")}
                <ArrowRight />
              </StartLink>
              <a href="#pricing" className={styles.btnGhost}>
                {t("hero.ctaSecondary")}
              </a>
            </div>

            <p className={styles.specLine}>
              <span className={styles.specStrong}>
                {formatEur(pricePerPage, locale)} € / {t("hero.perPage")}
              </span>
              <span>{t("hero.minimum", { pages: minimumPages })}</span>
              <span>{t("hero.vat")}</span>
              <span>{t("hero.languages")}</span>
            </p>
          </div>

          <HeroPanel
            panelLabel={t("panel.label")}
            animAlt={t("panel.alt")}
            allPhasesLabel={t("panel.allPhases")}
            phaseLabels={[t("panel.phase1"), t("panel.phase2"), t("panel.phase3")]}
            steps={[
              { title: t("steps.step1.title"), desc: t("steps.step1.desc") },
              { title: t("steps.step2.title"), desc: t("steps.step2.desc") },
              { title: t("steps.step3.title"), desc: t("steps.step3.desc") },
            ]}
          />
        </div>
      </section>

      {/* ── Why ── */}
      <section className={styles.section}>
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <p className={styles.eyebrow}>{t("why.eyebrow")}</p>
            <h2 className={styles.secHeading}>{t("why.heading")}</h2>
            <p className={styles.secBody}>{t("why.body")}</p>
          </div>

          <div className={styles.values}>
            {values.map((value) => (
              <div key={value.title} className={styles.value}>
                <span className={styles.valueIcon}>{value.icon}</span>
                <h3 className={styles.valueTitle}>{value.title}</h3>
                <p className={styles.valueDesc}>{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The three stages, in detail ── */}
      <HowItWorks
        eyebrow={t("howItWorks.eyebrow")}
        heading={t("howItWorks.heading")}
        steps={[pipelineStep(1), pipelineStep(2), pipelineStep(3)]}
      />

      {/* ── Get started: camera on a phone, QR handoff on a desktop ── */}
      {isMobile ? (
        <section id="start" className={styles.startSection}>
          <div className={styles.inner}>
            <p className={styles.eyebrow}>{t("start.eyebrow")}</p>
            <h2 className={styles.secHeading}>{t("start.heading")}</h2>
            <Link href="/scan" className={styles.mobileCta}>
              {t("start.mobileCta")}
            </Link>
          </div>
        </section>
      ) : (
        <DesktopHandoff
          url={await getCurrentUrl(locale === "sl" ? "/scan" : `/${locale}/scan`)}
        />
      )}

      {/* ── Price list ── */}
      <section id="pricing" className={styles.section}>
        <div className={styles.inner}>
          <PricingCard
            eyebrow={t("pricing.eyebrow")}
            currency="€"
            price={formatEur(pricePerPage, locale)}
            unit={t("pricing.unit")}
            cta={t("pricing.cta")}
            note={t("pricing.note")}
            rows={[
              {
                label: t("pricing.rowMinimum"),
                value: t("pricing.rowMinimumValue", {
                  pages: minimumPages,
                  total: formatEur(minimumTotal, locale),
                }),
              },
              {
                label: t("pricing.rowExample", { pages: EXAMPLE_PAGES }),
                value: `${formatEur(pricePerPage * EXAMPLE_PAGES, locale)} €`,
              },
              { label: t("pricing.rowCover"), value: t("pricing.included") },
              { label: t("pricing.rowOcr"), value: t("pricing.included") },
              { label: t("pricing.rowDelivery"), value: t("pricing.included") },
              { label: t("pricing.rowWindow"), value: t("pricing.rowWindowValue") },
              { label: t("pricing.rowAccount"), value: t("pricing.rowAccountValue") },
              { label: t("pricing.rowPayment"), value: t("pricing.rowPaymentValue") },
            ]}
          />
        </div>
      </section>

      {/* ── Questions ── */}
      <Faq
        eyebrow={t("faq.eyebrow")}
        heading={t("faq.heading")}
        items={[1, 2, 3, 4, 5].map((n) => ({
          q: t(`faq.q${n}.q`),
          a: t(`faq.q${n}.a`),
        }))}
      />

      {/* ── Closing band ── */}
      <div className={styles.band}>
        <div className={styles.bandInner}>
          <div>
            <p className={styles.eyebrow}>{t("closing.eyebrow")}</p>
            <h2 className={styles.bandHeading}>{t("closing.heading")}</h2>
          </div>
          <div className={styles.ctaRow}>
            <StartLink href={startHref} className={styles.btnPrimary}>
              {t("closing.cta")}
            </StartLink>
            <a href="#faq" className={styles.btnGhost}>
              {t("closing.ctaSecondary")}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
