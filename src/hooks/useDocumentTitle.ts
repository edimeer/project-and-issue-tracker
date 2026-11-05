import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} - Plumbline` : 'Plumbline - projects and issues';
    return () => {
      document.title = previous;
    };
  }, [title]);
}
