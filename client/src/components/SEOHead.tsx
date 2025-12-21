import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  imageUrl?: string;
  url?: string;
  type?: "website" | "article" | "video.other";
}

export function SEOHead({ 
  title, 
  description, 
  keywords,
  imageUrl,
  url,
  type = "article"
}: SEOHeadProps) {
  useEffect(() => {
    const fullTitle = `${title} - Thư Viện Tài Liệu`;
    const previousTitle = document.title;
    
    document.title = fullTitle;
    
    const metaTags: Record<string, string> = {
      description: description,
      "og:title": fullTitle,
      "og:description": description,
      "og:type": type,
      "twitter:card": "summary_large_image",
      "twitter:title": fullTitle,
      "twitter:description": description,
    };

    if (keywords) {
      metaTags.keywords = keywords;
    }

    if (imageUrl) {
      metaTags["og:image"] = imageUrl;
      metaTags["twitter:image"] = imageUrl;
    }

    if (url) {
      metaTags["og:url"] = url;
    }

    const createdMetaTags: HTMLMetaElement[] = [];
    const previousMetaValues: Map<string, string> = new Map();

    Object.entries(metaTags).forEach(([name, content]) => {
      let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"], meta[property="${name}"]`);
      
      if (!meta) {
        meta = document.createElement("meta");
        if (name.startsWith("og:")) {
          meta.setAttribute("property", name);
        } else {
          meta.setAttribute("name", name);
        }
        document.head.appendChild(meta);
        createdMetaTags.push(meta);
      } else {
        const previousValue = meta.getAttribute("content") || "";
        previousMetaValues.set(name, previousValue);
      }
      
      meta.setAttribute("content", content);
    });

    return () => {
      document.title = previousTitle;
      
      createdMetaTags.forEach((meta) => {
        meta.remove();
      });
      
      previousMetaValues.forEach((value, name) => {
        const meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"], meta[property="${name}"]`);
        if (meta) {
          if (value) {
            meta.setAttribute("content", value);
          } else {
            meta.remove();
          }
        }
      });
    };
  }, [title, description, keywords, imageUrl, url, type]);

  return null;
}
