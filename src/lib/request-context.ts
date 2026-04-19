import { headers } from "next/headers";
import { userAgent } from "next/server";

export async function getIsMobile(): Promise<boolean> {
  const headerList = await headers();
  const ua = userAgent({ headers: headerList });
  const deviceType = ua.device.type;
  return deviceType === "mobile" || deviceType === "tablet";
}

export async function getCurrentUrl(pathname: string): Promise<string> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${pathname}`;
}
