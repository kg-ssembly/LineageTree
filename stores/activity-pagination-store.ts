import { create } from 'zustand';

type Page = { hasMore: boolean; loading: boolean; loadMore: () => void };
export const useActivityPaginationStore = create<{ pages: Record<string, Page> }>(() => ({ pages: {} }));

export function setActivityPage(key: string, page: Page | null) {
  useActivityPaginationStore.setState(({ pages }) => {
    const next = { ...pages };
    if (page) next[key] = page;
    else delete next[key];
    return { pages: next };
  });
}

export function loadMoreActivity() {
  Object.values(useActivityPaginationStore.getState().pages)
    .filter((page) => page.hasMore && !page.loading)
    .forEach((page) => page.loadMore());
}
