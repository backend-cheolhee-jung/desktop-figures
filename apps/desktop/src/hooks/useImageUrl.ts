import { useState, useEffect } from "react";
import { toDisplayUrl } from "@/lib/imageUtils";

export function useImageUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    toDisplayUrl(path).then(setUrl).catch(() => setUrl(null));
  }, [path]);

  return url;
}
