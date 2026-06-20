export const JIMMI_PUBLIC_ORIGIN = "https://askjimmi.com";

export function isTemporaryManusPreviewHost(hostname: string) {
  return hostname === "manus.computer" || hostname.endsWith(".manus.computer");
}

export function shouldRouteMicrophoneThroughJimmiDomain(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  return isTemporaryManusPreviewHost(hostname);
}

export function getJimmiPublicUrlForCurrentPage() {
  if (typeof window === "undefined") return JIMMI_PUBLIC_ORIGIN;
  return `${JIMMI_PUBLIC_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function redirectToJimmiPublicDomainForMicrophone() {
  if (typeof window === "undefined") return;
  window.location.href = getJimmiPublicUrlForCurrentPage();
}
