import { useEffect } from 'react';
import { useLocation } from 'wouter';

function isDevToolsOpen(): boolean {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  return widthThreshold || heightThreshold;
}

export function useDevToolsDetection() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (location !== '/' && isDevToolsOpen()) {
      setLocation('/');
      return;
    }

    let devtoolsOpen = isDevToolsOpen();

    const checkDevTools = () => {
      if (isDevToolsOpen()) {
        if (!devtoolsOpen || location !== '/') {
          devtoolsOpen = true;
          setLocation('/');
        }
      } else {
        devtoolsOpen = false;
      }
    };

    const detectDevToolsViaDebugger = () => {
      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: function() {
          if (location !== '/') {
            setLocation('/');
          }
          return '';
        }
      });
      console.log('%c', element);
    };

    checkDevTools();

    const interval = setInterval(() => {
      checkDevTools();
      detectDevToolsViaDebugger();
    }, 500);

    window.addEventListener('resize', checkDevTools);

    // Disable right-click context menu
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable keyboard shortcuts for DevTools, view-source, save, copy, print, select all
    const disableKeyShortcuts = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      
      // F12 - DevTools
      if (e.key === 'F12') {
        e.preventDefault();
        setLocation('/');
        return false;
      }
      
      // Ctrl+Shift combinations (DevTools shortcuts)
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(key)) {
        e.preventDefault();
        setLocation('/');
        return false;
      }
      
      // Ctrl combinations
      if (e.ctrlKey && !e.shiftKey) {
        // Ctrl+U - View Source
        if (key === 'U') {
          e.preventDefault();
          setLocation('/');
          return false;
        }
        
        // Ctrl+S - Save Page
        if (key === 'S') {
          e.preventDefault();
          return false;
        }
        
        // Ctrl+P - Print
        if (key === 'P') {
          e.preventDefault();
          return false;
        }
        
        // Ctrl+A - Select All (only outside input fields)
        if (key === 'A') {
          const target = e.target as HTMLElement;
          const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
          if (!isInputField) {
            e.preventDefault();
            return false;
          }
        }
        
        // Ctrl+C - Copy (only outside input fields)
        if (key === 'C') {
          const target = e.target as HTMLElement;
          const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
          if (!isInputField) {
            e.preventDefault();
            return false;
          }
        }
        
        // Ctrl+X - Cut (only outside input fields)
        if (key === 'X') {
          const target = e.target as HTMLElement;
          const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
          if (!isInputField) {
            e.preventDefault();
            return false;
          }
        }
      }
    };

    // Disable text selection (except in input fields)
    const disableSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!isInputField) {
        e.preventDefault();
        return false;
      }
    };

    // Disable copy event (except in input fields)
    const disableCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!isInputField) {
        e.preventDefault();
        return false;
      }
    };

    // Disable cut event (except in input fields)
    const disableCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!isInputField) {
        e.preventDefault();
        return false;
      }
    };

    // Disable drag start (prevent dragging images/content)
    const disableDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', disableContextMenu);
    document.addEventListener('keydown', disableKeyShortcuts);
    document.addEventListener('selectstart', disableSelectStart);
    document.addEventListener('copy', disableCopy);
    document.addEventListener('cut', disableCut);
    document.addEventListener('dragstart', disableDragStart);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', checkDevTools);
      document.removeEventListener('contextmenu', disableContextMenu);
      document.removeEventListener('keydown', disableKeyShortcuts);
      document.removeEventListener('selectstart', disableSelectStart);
      document.removeEventListener('copy', disableCopy);
      document.removeEventListener('cut', disableCut);
      document.removeEventListener('dragstart', disableDragStart);
    };
  }, [location, setLocation]);
}
