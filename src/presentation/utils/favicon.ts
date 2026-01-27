export const getFaviconUrl = (url?: string): string => {
  if (!url) return '';
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('substack.com')) {
      return `https://${hostname}/favicon.ico`;
    }
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
};
