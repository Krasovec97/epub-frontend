"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import styles from "./ConvertStepper.module.css";

type Step = 1 | 2 | 3;
type ActionStatus = "idle" | "loading" | "error";

interface ConvertStepperProps {
  sessionId: string;
  pageCount: number;
  initialStep: Step;
}

// exported for the page component
export type { ConvertStepperProps };

export default function ConvertStepper({
  sessionId,
  pageCount,
  initialStep,
}: ConvertStepperProps) {
  const t = useTranslations("ConvertPage");
  const locale = useLocale();
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState<string>("");
  const [status, setStatus] = useState<ActionStatus>("idle");

  const billedPages = Math.max(20, pageCount);
  const price = (billedPages * 0.15).toFixed(2);
  const showMinimumNote = pageCount < 20;

  async function handlePay() {
    if (!email || status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email, pageCount, locale }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data: { url: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={styles.stepper}>
      <p className={styles.stepIndicator}>
        {t("step", { current: step, total: 3 })}
      </p>

      {step === 1 && (
        <div className={styles.card}>
          <h2 className={styles.heading}>{t("summary.heading")}</h2>

          <dl className={styles.dataList}>
            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Pages</dt>
              <dd className={styles.dataValue}>
                {t("summary.pages", { count: pageCount })}
              </dd>
            </div>
            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Total</dt>
              <dd className={styles.dataValue}>
                {t("summary.price", { amount: price })}
              </dd>
            </div>
          </dl>

          {showMinimumNote && (
            <p className={styles.note}>{t("summary.minimumNote")}</p>
          )}

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setStep(2)}
          >
            {t("summary.continue")}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className={styles.card}>
          <h2 className={styles.heading}>{t("billing.heading")}</h2>

          <label className={styles.label} htmlFor="email">
            {t("billing.emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            className={styles.input}
            placeholder={t("billing.emailPlaceholder")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
          />

          {status === "error" && (
            <p className={styles.errorText}>{t("billing.error")}</p>
          )}

          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!email || status === "loading"}
            onClick={handlePay}
          >
            {status === "loading" ? t("billing.paying") : t("billing.pay")}
          </button>

          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setStep(1)}
          >
            {t("billing.back")}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className={styles.card}>
          <h2 className={styles.heading}>{t("confirmation.heading")}</h2>
          <p className={styles.body}>
            {t("confirmation.body", { email: email || "your email" })}
          </p>
          <p className={styles.note}>{t("confirmation.note")}</p>
        </div>
      )}
    </div>
  );
}
