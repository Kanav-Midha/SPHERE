import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface RevealCharsProps {
  text: string;
  className?: string;
  delay?: number;
  once?: boolean;
}

export default function RevealChars({
  text,
  className = '',
  delay = 0,
  once = true,
}: RevealCharsProps) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;

    const chars = rootRef.current.querySelectorAll<HTMLElement>('[data-char]');
    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { yPercent: 120, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.82,
          ease: 'power4.out',
          stagger: 0.02,
          delay,
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top 82%',
            once,
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [delay, once, text]);

  return (
    <span ref={rootRef} className={className} aria-label={text}>
      {text.split('').map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="inline-block overflow-hidden align-top"
          aria-hidden="true"
        >
          <span data-char className="inline-block will-change-transform">
            {char === ' ' ? '\u00A0' : char}
          </span>
        </span>
      ))}
    </span>
  );
}
