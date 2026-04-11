import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import ConvertStepper from "@/components/ConvertStepper";
import styles from "./page.module.css";

type Step = 1 | 2 | 3;

interface SessionData {
  pageCount: number;
  status: "pending" | "processing" | "done";
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

  // Fetch session data from backend
  const backendUrl = process.env.BACKEND_BASE_URL;
  if (!backendUrl) {
    notFound();
  }

  let sessionData: SessionData;
  try {
    const res = await fetch(`${backendUrl}/sessions/${sessionId}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      notFound();
    }
    sessionData = await res.json();
  } catch {
    notFound();
  }

  let initialStep: Step = 1;
  if (searchParamsResult.step === "confirmation") {
    initialStep = 3;
  } else if (searchParamsResult.step === "billing") {
    initialStep = 2;
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{t("title")}</h1>
        <ConvertStepper
          sessionId={sessionId}
          pageCount={sessionData.pageCount}
          initialStep={initialStep}
        />
      </div>
    </main>
  );
}
