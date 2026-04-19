import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import ConvertStepper from "@/components/ConvertStepper";
import styles from "./page.module.css";

type Step = 1 | 2 | 3;

interface ResultResponse {
  sessionId: string;
  status: "processing" | "completed" | "failed" | string;
  pageCount: number;
  priceEur: number;
  processingTimeSec: number | null;
  expiresAt: string | null;
  downloadUrl: string | null;
}

export default async function ConvertPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("ConvertPage");
  const searchParamsResult = await searchParams;

  let initialStep: Step = 1;
  if (searchParamsResult.step === "confirmation") {
    initialStep = 3;
  } else if (searchParamsResult.step === "billing") {
    initialStep = 2;
  }

  // Step 3 polls the result endpoint client-side; no need to fetch here.
  let pageCount = 0;
  if (initialStep !== 3) {
    const backendUrl = process.env.BACKEND_BASE_URL;
    if (!backendUrl) {
      notFound();
    }

    let result: ResultResponse;
    try {
      const res = await fetch(`${backendUrl}/sessions/${sessionId}/result`, {
        cache: "no-store",
      });
      if (!res.ok) {
        notFound();
      }
      result = await res.json();
    } catch {
      notFound();
    }
    pageCount = result.pageCount;
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{t("title")}</h1>
        <ConvertStepper
          sessionId={sessionId}
          pageCount={pageCount}
          initialStep={initialStep}
        />
      </div>
    </main>
  );
}
