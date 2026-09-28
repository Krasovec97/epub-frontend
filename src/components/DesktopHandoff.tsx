import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import styles from "./DesktopHandoff.module.css";

interface DesktopHandoffProps {
  url: string;
  /* On /scan this section *is* the page, so it owns the h1. Inside the
     homepage it is one section among many and must not. */
  standalone?: boolean;
}

export default async function DesktopHandoff({
  url,
  standalone = false,
}: DesktopHandoffProps) {
  const t = await getTranslations("ScanPage.desktop");

  /* Ink on white — the old cream-on-transparent code vanished on a light page. */
  const qrDataUrl: string = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 416,
    color: { dark: "#0f1d33", light: "#ffffff" },
  });

  const Heading = standalone ? "h1" : "h2";

  return (
    <section
      id="start"
      className={`${styles.wrap} ${standalone ? styles.standalone : ""}`}
    >
      <div className={styles.inner}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <Heading className={styles.heading}>{t("heading")}</Heading>
          <p className={styles.body}>{t("body")}</p>
          <p className={styles.urlLabel}>{t("urlLabel")}</p>
          <code className={styles.url}>{url}</code>
        </div>
        <div className={styles.plate}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={t("qrAlt")} className={styles.qr} />
        </div>
      </div>
    </section>
  );
}
