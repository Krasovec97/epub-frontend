"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { CompanyBilling } from "@/lib/billing";
import { formatEur } from "@/lib/pricing";
import styles from "./ConvertStepper.module.css";

const EMPTY_COMPANY: CompanyBilling = {
  companyName: "",
  vatId: "",
  addressLine: "",
  postalCode: "",
  city: "",
  country: "",
};

const COMPANY_FIELDS: (keyof CompanyBilling)[] = [
  "companyName",
  "vatId",
  "addressLine",
  "postalCode",
  "city",
  "country",
];

type Step = 1 | 2 | 3;
type ActionStatus = "idle" | "loading" | "error";

interface ResultResponse {
  sessionId: string;
  status: "processing" | "completed" | "failed" | string;
  pageCount: number;
  priceEur: number;
  processingTimeSec: number | null;
  expiresAt: string | null;
  downloadUrl: string | null;
}

type PollState =
  | { kind: "processing"; elapsed: number }
  | { kind: "completed"; data: ResultResponse }
  | { kind: "failed" }
  | { kind: "notFound" };

const POLL_INTERVAL_MS = 4000;

interface ConvertStepperProps {
  sessionId: string;
  pageCount: number;
  initialStep: Step;
  pricePerPageEur: number;
  minimumPages: number;
}

// exported for the page component
export type { ConvertStepperProps };

export default function ConvertStepper({
  sessionId,
  pageCount,
  initialStep,
  pricePerPageEur,
  minimumPages,
}: ConvertStepperProps) {
  const t = useTranslations("ConvertPage");
  const locale = useLocale();
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState<string>("");
  const [isCompany, setIsCompany] = useState<boolean>(false);
  const [company, setCompany] = useState<CompanyBilling>(EMPTY_COMPANY);
  const [status, setStatus] = useState<ActionStatus>("idle");

  const billedPages = Math.max(minimumPages, pageCount);
  const price = formatEur(billedPages * pricePerPageEur, locale);
  const showMinimumNote = pageCount < minimumPages;

  const companyComplete = COMPANY_FIELDS.every(
    (field) => company[field].trim() !== "",
  );
  const canPay = email.trim() !== "" && (!isCompany || companyComplete);

  function updateCompany(field: keyof CompanyBilling, value: string) {
    setCompany((prev) => ({ ...prev, [field]: value }));
    if (status === "error") setStatus("idle");
  }

  async function handlePay() {
    if (!canPay || status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          email,
          pageCount,
          locale,
          company: isCompany ? company : null,
        }),
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

          <label className={styles.companyToggle}>
            <input
              type="checkbox"
              checked={isCompany}
              onChange={(e) => {
                setIsCompany(e.target.checked);
                if (status === "error") setStatus("idle");
              }}
            />
            {t("billing.companyToggle")}
          </label>

          {isCompany &&
            COMPANY_FIELDS.map((field) => (
              <div key={field}>
                <label className={styles.label} htmlFor={field}>
                  {t(`billing.${field}`)}
                </label>
                <input
                  id={field}
                  type="text"
                  required
                  className={styles.input}
                  placeholder={t(`billing.${field}Placeholder`)}
                  value={company[field]}
                  onChange={(e) => updateCompany(field, e.target.value)}
                />
              </div>
            ))}

          {status === "error" && (
            <p className={styles.errorText}>{t("billing.error")}</p>
          )}

          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!canPay || status === "loading"}
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
        <ConfirmationCard sessionId={sessionId} email={email} />
      )}
    </div>
  );
}

function ConfirmationCard({
  sessionId,
  email,
}: {
  sessionId: string;
  email: string;
}) {
  const t = useTranslations("ConvertPage.confirmation");
  const locale = useLocale();
  const [pollState, setPollState] = useState<PollState>({
    kind: "processing",
    elapsed: 0,
  });
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/result`, {
          cache: "no-store",
        });
        if (cancelled) return;

        if (res.status === 404) {
          setPollState({ kind: "notFound" });
          return;
        }
        if (!res.ok) {
          schedule();
          return;
        }
        const data: ResultResponse = await res.json();
        if (cancelled) return;

        if (data.status === "completed") {
          setPollState({ kind: "completed", data });
          return;
        }
        if (data.status === "failed") {
          setPollState({ kind: "failed" });
          return;
        }
        setPollState({
          kind: "processing",
          elapsed: Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000),
        });
        schedule();
      } catch {
        if (!cancelled) schedule();
      }
    }

    function schedule() {
      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [sessionId]);

  if (pollState.kind === "completed") {
    const { data } = pollState;
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>{t("readyHeading")}</h2>
        <dl className={styles.dataList}>
          <div className={styles.dataRow}>
            <dt className={styles.dataLabel}>{t("pagesLabel")}</dt>
            <dd className={styles.dataValue}>{data.pageCount}</dd>
          </div>
          <div className={styles.dataRow}>
            <dt className={styles.dataLabel}>{t("priceLabel")}</dt>
            <dd className={styles.dataValue}>{data.priceEur.toFixed(2)} EUR</dd>
          </div>
          {data.processingTimeSec !== null && (
            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>{t("processingTimeLabel")}</dt>
              <dd className={styles.dataValue}>
                {formatDuration(data.processingTimeSec)}
              </dd>
            </div>
          )}
          {data.expiresAt && (
            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>{t("expiresLabel")}</dt>
              <dd className={styles.dataValue}>
                {formatExpiry(data.expiresAt, locale)}
              </dd>
            </div>
          )}
        </dl>
        <a
          className={styles.primaryBtn}
          href={`/api/sessions/${sessionId}/download`}
          download
        >
          {t("download")}
        </a>
        <p className={styles.note}>
          {t("emailNote", { email: email || t("emailFallback") })}
        </p>
      </div>
    );
  }

  if (pollState.kind === "failed") {
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>{t("failedHeading")}</h2>
        <p className={styles.body}>{t("failedBody")}</p>
      </div>
    );
  }

  if (pollState.kind === "notFound") {
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>{t("expiredHeading")}</h2>
        <p className={styles.body}>{t("expiredBody")}</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>{t("processingHeading")}</h2>
      <p className={styles.body}>{t("processingBody")}</p>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuetext={t("processingAria")}
      >
        <div className={styles.progressBar} />
      </div>
      <p className={styles.elapsed}>
        {t("elapsed", { seconds: pollState.elapsed })}
      </p>
      <p className={styles.note}>
        {t("emailNote", { email: email || t("emailFallback") })}
      </p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatExpiry(raw: string, locale: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
