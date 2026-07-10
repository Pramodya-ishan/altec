import { useEffect } from "react";

export const useAutosizeTextarea = (
  textareaRef: HTMLTextAreaElement | null,
  value: string
) => {
  useEffect(() => {
    if (textareaRef) {
      // Reset height to auto/0px first to calculate scrollHeight correctly
      textareaRef.style.height = "auto";
      const scrollHeight = textareaRef.scrollHeight;

      // Set the height, capping at 180px
      textareaRef.style.height = `${Math.min(scrollHeight, 180)}px`;
      
      // Control overflow behavior if height exceeds 180px
      if (scrollHeight > 180) {
        textareaRef.style.overflowY = "auto";
      } else {
        textareaRef.style.overflowY = "hidden";
      }
    }
  }, [textareaRef, value]);
};
