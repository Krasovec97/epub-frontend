"use client";

import { useTranslations } from "next-intl";
import type { QualityVerdict } from "@/lib/image-quality";
import styles from "./ScanReview.module.css";

export interface Capture {
  id: string;
  previewUrl: string;
  quality: QualityVerdict;
  hasHeading: boolean;
}

interface ScanReviewProps {
  captures: Capture[];
  uploading: boolean;
  errorMessage: string | null;
  onDelete: (id: string) => void;
  onAddAnother: () => void;
  onFinish: () => void;
}

export default function ScanReview({
  captures,
  uploading,
  errorMessage,
  onDelete,
  onAddAnother,
  onFinish,
}: ScanReviewProps) {
  const t = useTranslations("ScanPage.review");

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h2 className={styles.heading}>{t("heading")}</h2>
        <p className={styles.count}>{t("count", { count: captures.length })}</p>
      </header>

      {captures.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.grid}>
          {captures.map((capture, idx) => {
            const flagged = !capture.quality.ok;
            const issueLabels = capture.quality.issues.map((issue) =>
              t(`qualityIssue.${issue}`),
            );
            const tooltip = flagged
              ? `${t("qualityFlag")}: ${issueLabels.join(" • ")}`
              : undefined;
            return (
              <li key={capture.id} className={styles.item}>
                <div className={styles.thumbWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capture.previewUrl}
                    alt={`Page ${idx + 1}`}
                    className={styles.thumb}
                  />
                  <span className={styles.index} data-cover={idx === 0 || undefined}>
                    {idx === 0 ? t("coverBadge") : idx}
                  </span>
                  {capture.hasHeading && (
                    <span
                      className={styles.headingBadge}
                      title={t("headingFlag")}
                      aria-label={t("headingFlag")}
                    >
                      H
                    </span>
                  )}
                  {flagged && (
                    <span
                      className={styles.qualityBadge}
                      title={tooltip}
                      aria-label={tooltip}
                    >
                      !
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => onDelete(capture.id)}
                  disabled={uploading}
                >
                  {t("delete")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onAddAnother}
          disabled={uploading}
        >
          {t("addAnother")}
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onFinish}
          disabled={captures.length === 0 || uploading}
        >
          {uploading ? t("uploading") : t("finish")}
        </button>
      </div>
    </section>
  );
}
