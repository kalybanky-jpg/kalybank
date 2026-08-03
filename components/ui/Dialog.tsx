'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { wrappedFocusTargetIndex } from './dialog-focus';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = '';
const openDialogs: symbol[] = [];

function focusWithoutScrolling(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function visibleFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute('aria-hidden') !== 'true' &&
      (element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element.getClientRects().length > 0),
  );
}

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock;
  }
}

type DialogContextValue = {
  ariaLabelledBy: string;
  closeOnBackdrop: boolean;
  close: () => void;
  panelRef: (element: HTMLElement | null) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('DialogBackdrop and DialogPanel must be rendered inside Dialog.');
  }
  return context;
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
};

export function Dialog({
  open,
  onClose,
  ariaLabelledBy,
  children,
  initialFocusRef,
  closeOnBackdrop = true,
}: DialogProps) {
  const panelElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dialogTokenRef = useRef(Symbol('dialog'));

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const panelRef = useCallback((element: HTMLElement | null) => {
    panelElementRef.current = element;
  }, []);

  const close = useCallback(() => {
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const dialogToken = dialogTokenRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    openDialogs.push(dialogToken);
    lockBodyScroll();

    const focusFrame = window.requestAnimationFrame(() => {
      const panel = panelElementRef.current;
      if (!panel || openDialogs.at(-1) !== dialogToken) return;

      const requestedTarget = initialFocusRef?.current;
      const target =
        requestedTarget && panel.contains(requestedTarget)
          ? requestedTarget
          : visibleFocusableElements(panel)[0] ?? panel;
      focusWithoutScrolling(target);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1) !== dialogToken || event.isComposing) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelElementRef.current;
      if (!panel) return;

      const focusableElements = visibleFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusWithoutScrolling(panel);
        return;
      }

      const currentIndex = focusableElements.indexOf(
        document.activeElement as HTMLElement,
      );
      const targetIndex = wrappedFocusTargetIndex(
        currentIndex,
        focusableElements.length,
        event.shiftKey,
      );

      if (targetIndex !== null) {
        event.preventDefault();
        focusWithoutScrolling(focusableElements[targetIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);

      const stackIndex = openDialogs.lastIndexOf(dialogToken);
      if (stackIndex >= 0) openDialogs.splice(stackIndex, 1);
      unlockBodyScroll();

      if (previouslyFocused?.isConnected) {
        focusWithoutScrolling(previouslyFocused);
      }
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  return (
    <DialogContext.Provider
      value={{ ariaLabelledBy, closeOnBackdrop, close, panelRef }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export const Drawer = Dialog;

export function DialogBackdrop({
  onClick,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { close, closeOnBackdrop } = useDialogContext();

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (
      !event.defaultPrevented &&
      closeOnBackdrop &&
      event.target === event.currentTarget
    ) {
      close();
    }
  };

  return <div {...props} onClick={handleClick} />;
}

type DialogPanelProps<T extends ElementType> = {
  as?: T;
} & Omit<
  ComponentPropsWithoutRef<T>,
  'aria-labelledby' | 'aria-modal' | 'as' | 'role' | 'tabIndex'
>;

export function DialogPanel<T extends ElementType = 'div'>({
  as,
  ...props
}: DialogPanelProps<T>) {
  const { ariaLabelledBy, panelRef } = useDialogContext();
  const Component: ElementType = as ?? 'div';

  return (
    <Component
      {...props}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      tabIndex={-1}
    />
  );
}
