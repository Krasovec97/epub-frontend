import { setRequestLocale } from "next-intl/server";
import ScanFlow from "@/components/ScanFlow";
import DesktopHandoff from "@/components/DesktopHandoff";
import { getIsMobile, getCurrentUrl } from "@/lib/request-context";

// Bookmarkable resume URL for an in-progress scan. The scan flow adopts the
// given session id on load and rebuilds its page list from the server.
export default async function ResumeScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const devBypass =
    process.env.NODE_ENV === "development" && sp.dev !== undefined;

  const isMobile = await getIsMobile();
  if (!isMobile && !devBypass) {
    const path = locale === "sl" ? `/scan/${sessionId}` : `/${locale}/scan/${sessionId}`;
    const url = await getCurrentUrl(path);
    return <DesktopHandoff url={url} />;
  }

  return (
    <main>
      <ScanFlow initialSessionId={sessionId} />
    </main>
  );
}
