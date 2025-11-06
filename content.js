chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getImages") {
    const images = Array.from(document.querySelectorAll("img"))
      .map(img => {
        // Pega a melhor URL disponível
        const raw = img.currentSrc || img.src || "";
        try {
          // Resolve URL relativa para absoluta
          return new URL(raw, location.href).toString();
        } catch {
          return raw;
        }
      })
      .filter(src => !!src)
      .filter(src => {
        const s = src.toLowerCase();
        const hasNoAlt =
          (() => {
            const el = document.querySelector(`img[src="${CSS.escape(src)}"]`);
            if (!el) return true; // se não achou, deixa passar
            const alt = (el.getAttribute("alt") || "").trim();
            return alt === "";
          })();

        const isSvg  = s.endsWith(".svg")  || s.includes(".svg?");
        const isIco  = s.endsWith(".ico")  || s.includes(".ico?");
        const isData = s.startsWith("data:");
        const isBlob = s.startsWith("blob:");
        const okExt  = [".jpg", ".jpeg", ".png", ".gif", ".webp"].some(ext => s.includes(ext));

        return hasNoAlt && !isSvg && !isIco && !isData && !isBlob && okExt;
      });

    sendResponse({ imageUrls: images });
  }
});
