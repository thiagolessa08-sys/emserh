import Fuse from 'fuse.js';

export interface PageIndex {
  pageNumber: number;
  text: string;
}

export function findCitationPage(citation: string, pages: PageIndex[]): number {
  if (pages.length === 0 || !citation.trim()) return 1;

  const fuse = new Fuse(pages, {
    keys: ['text'],
    threshold: 0.5,
    includeScore: true,
    minMatchCharLength: 4,
    ignoreLocation: true,
  });

  const results = fuse.search(citation);
  if (results.length === 0) return 1;

  return results[0].item.pageNumber;
}
