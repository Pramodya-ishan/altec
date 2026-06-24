import { useEffect, useRef, useState, useCallback, RefObject } from 'react';

export function useNearBottomAutoScroll(
  dependencies: any[] = [],
  threshold: number = 120
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewContent, setHasNewContent] = useState(false);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    // Check if within threshold
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const currentlyNearBottom = distanceToBottom <= threshold;
    setIsNearBottom(currentlyNearBottom);

    if (currentlyNearBottom) {
      setHasNewContent(false);
    }
  }, [threshold]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setIsNearBottom(true);
    setHasNewContent(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // When dependencies change (like new messages or streaming tokens),
  // we scroll to bottom ONLY IF we were already near bottom.
  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom(false); // Do not use smooth for every token
    } else {
      setHasNewContent(true);
    }
  }, [...dependencies, isNearBottom, scrollToBottom]);

  return { containerRef, isNearBottom, hasNewContent, scrollToBottom };
}
