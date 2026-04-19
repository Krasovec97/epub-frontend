import { setRequestLocale } from "next-intl/server";
import ScanFlow from "@/components/ScanFlow";
import DesktopHandoff from "@/components/DesktopHandoff";
import { getIsMobile, getCurrentUrl } from "@/lib/request-context";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isMobile = await getIsMobile();
  if (!isMobile) {
    const url = await getCurrentUrl(locale === "sl" ? "/scan" : `/${locale}/scan`);
    return <DesktopHandoff url={url} />;
  }

  return (
    <main>
      <ScanFlow />
    </main>
  );
}
