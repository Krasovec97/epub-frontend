import { setRequestLocale } from "next-intl/server";
import ScanFlow from "@/components/ScanFlow";
import DesktopHandoff from "@/components/DesktopHandoff";
import { getIsMobile, getCurrentUrl } from "@/lib/request-context";

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const devBypass =
    process.env.NODE_ENV === "development" && sp.dev !== undefined;

  const isMobile = await getIsMobile();
  if (!isMobile && !devBypass) {
    const url = await getCurrentUrl(locale === "sl" ? "/scan" : `/${locale}/scan`);
    return <DesktopHandoff url={url} />;
  }

  return (
    <main>
      <ScanFlow />
    </main>
  );
}
