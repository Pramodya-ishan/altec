import { useEffect, useRef, useState, useCallback } from 'react';

export function useNearBottomAutoScroll(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  messages: any[],
  isStreaming: boolean,
  answer: string
) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isNearBottomRef = useRef(true);
  const prevMessagesLength = useRef(0);

  const checkNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const threshold = 120; // px from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceFromBottom <= threshold;
    isNearBottomRef.current = isNear;
    setShowScrollButton(distanceFromBottom > threshold);
  }, [scrollContainerRef]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior
    });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, [scrollContainerRef]);

  // Handle scroll events
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      checkNearBottom();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, checkNearBottom]);

  // Handle ResizeObserver for dynamic content (streaming or image loading)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const childContainer = el.firstElementChild;
    if (!childContainer) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isStreaming && isNearBottomRef.current) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    });

    resizeObserver.observe(childContainer);
    return () => resizeObserver.disconnect();
  }, [scrollContainerRef, isStreaming]);

  // When messages update
  useEffect(() => {
    if (messages.length === 0) return;

    const isNewUserMessage =
      messages.length > prevMessagesLength.current &&
      messages[messages.length - 1]?.role === 'user';

    if (isNewUserMessage) {
      setTimeout(() => scrollToBottom('smooth'), 50);
    } else if (isNearBottomRef.current) {
      setTimeout(() => scrollToBottom('auto'), 20);
    }

    prevMessagesLength.current = messages.length;
  }, [messages, scrollToBottom]);

  // Scroll once on streaming finish
  useEffect(() => {
    if (!isStreaming && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    }
  }, [isStreaming, scrollToBottom]);

  return {
    showScrollButton,
    scrollToBottom
  };
}
