import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  // Static en-only configuration for single-college LMS
  const locale = "en";
  const messages = (await import("../../../messages/en.json")).default;

  return {
    locale,
    messages,
  };
});
