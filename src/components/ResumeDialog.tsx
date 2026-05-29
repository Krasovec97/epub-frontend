"use client";

import { useTranslations } from "next-intl";
import styles from "./ResumeDialog.module.css";

interface ResumeDialogProps {
  count: number;
  onContinue: () => void;
  onDiscard: () => void;
}

export default function ResumeDialog({
  count,
  onContinue,
  onDiscard,
}: ResumeDialogProps) {
  const t = useTranslations("ScanPage.resume");

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <div className={styles.panel}>
        <h2 id="resume-title" className={styles.title}>
          {t("heading")}
        </h2>
        <p className={styles.body}>{t("body", { count })}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onContinue}>
            {t("continue")}
          </button>
          <button type="button" className={styles.secondary} onClick={onDiscard}>
            {t("drop")}
          </button>
        </div>
      </div>
    </div>
  );
}
