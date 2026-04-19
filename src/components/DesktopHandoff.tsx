import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import styles from "./DesktopHandoff.module.css";

interface DesktopHandoffProps {
  url: string;
}

export default async function DesktopHandoff({ url }: DesktopHandoffProps) {
  const t = await getTranslations("ScanPage.desktop");

  const qrDataUrl: string = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#f3ead6", light: "#0000" },
  });

  return (
    <section className={styles.wrap}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>{t("heading")}</h1>
        <p className={styles.body}>{t("body")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR code" className={styles.qr} />
        <p className={styles.urlLabel}>{t("urlLabel")}</p>
        <code className={styles.url}>{url}</code>
      </div>
    </section>
  );
}
