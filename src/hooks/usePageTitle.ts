import { useEffect } from 'react';

/**
 * Custom hook to dynamically update document title and meta description for SEO & UX
 */
export const usePageTitle = (title: string, description?: string) => {
  useEffect(() => {
    const baseTitle = 'Sandmosquito Water Billing';
    document.title = title ? `${title} | ${baseTitle}` : `${baseTitle} - Sistem Tagihan Air Desa`;

    if (description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', description);
      }
    }
  }, [title, description]);
};
