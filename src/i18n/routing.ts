import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["sl", "en"],
  defaultLocale: "sl",
  localePrefix: "as-needed",
  localeDetection: false,
});
