import { useEffect, useRef, useState } from 'react';

export function useNearBottomAutoScroll(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  messages: any[],
  isStreaming: boolean,
  answer: string
) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isNearBottomRef = useRef(true);
  const prevMessagesLength = useRef(0);

  const checkNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    const threshold = 120; // px from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceFromBottom <= threshold;
    isNearBottomRef.current = isNear;
    setShowScrollButton(distanceFromBottom > threshold + 50);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior
    });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      checkNearBottom();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  // When messages update
  useEffect(() => {
    if (messages.length === 0) return;
    
    const isNewUserMessage = 
      messages.length > prevMessagesLength.current && 
      messages[messages.length - 1]?.role === 'user';
      
    if (isNewUserMessage) {
      // Force scroll to bottom for user message
      setTimeout(() => scrollToBottom('smooth'), 50);
    } else if (isNearBottomRef.current) {
      // If we were near bottom, keep scrolling
      setTimeout(() => scrollToBottom('auto'), 20);
    }
    
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // When active streaming is in progress
  useEffect(() => {
    if (isStreaming && isNearBottomRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [isStreaming, answer]);

  return {
    showScrollButton,
    scrollToBottom
  };
}
