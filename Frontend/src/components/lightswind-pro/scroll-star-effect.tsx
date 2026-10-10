import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  size: number;
  color: string;
}

interface ScrollStarEffectProps {
  className?: string;
  starCount?: number;
  speed?: number;
  starColor?: string;
  maxWarpStretch?: number;
}

/**
 * Cinematic star warp effect stretching with scroll velocity.
 * Stars stretch into warp-speed lines based on how fast the user scrolls.
 * Inspired by Lightswind Pro visual components.
 */
export default function ScrollStarEffect({
  className = '',
  starCount = 200,
  speed = 0.8,
  starColor = 'rgba(15, 23, 42, 0.45)', // Sleek slate tone suitable for light canvas
  maxWarpStretch = 18,
}: ScrollStarEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track scroll velocity
    let lastScrollY = window.scrollY;
    let lastTimestamp = performance.now();
    let scrollVelocity = 0;
    let smoothedVelocity = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTimestamp = performance.now();
      const deltaY = currentScrollY - lastScrollY;
      const deltaTime = Math.max(currentTimestamp - lastTimestamp, 16);

      // Pixels per millisecond scaled
      const instantVelocity = (deltaY / deltaTime) * 1.5;
      scrollVelocity = instantVelocity;

      lastScrollY = currentScrollY;
      lastTimestamp = currentTimestamp;
    };

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.width = window.innerWidth * dpr;
      height = canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleResize();

    // Initialize stars in 3D perspective field
    const stars: Star[] = [];
    const colors = [
      'rgba(0, 100, 224, 0.55)',   // CampusOne Cobalt
      'rgba(15, 23, 42, 0.45)',    // Ink slate
      'rgba(51, 65, 85, 0.35)',    // Steel
      'rgba(99, 102, 241, 0.4)',   // Indigo hint
    ];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: (Math.random() - 0.5) * window.innerWidth * 2,
        y: (Math.random() - 0.5) * window.innerHeight * 2,
        z: Math.random() * 1000 + 100,
        prevZ: 1000,
        size: Math.random() * 1.5 + 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      // Smooth decay of scroll velocity
      scrollVelocity *= 0.88;
      if (Math.abs(scrollVelocity) < 0.01) scrollVelocity = 0;
      smoothedVelocity += (scrollVelocity - smoothedVelocity) * 0.15;

      const velocityMagnitude = Math.abs(smoothedVelocity);
      const warpFactor = Math.min(velocityMagnitude * 3.5, maxWarpStretch);
      const isWarping = warpFactor > 0.15;

      const displayW = window.innerWidth;
      const displayH = window.innerHeight;
      const cx = displayW / 2;
      const cy = displayH / 2;

      ctx.clearRect(0, 0, displayW, displayH);

      const baseSpeed = speed + Math.abs(smoothedVelocity) * 1.8;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        star.prevZ = star.z;
        star.z -= baseSpeed;

        // Reset stars that pass the camera or move too far
        if (star.z <= 1) {
          star.z = 1000;
          star.prevZ = star.z;
          star.x = (Math.random() - 0.5) * displayW * 2;
          star.y = (Math.random() - 0.5) * displayH * 2;
        }

        const k = 280 / star.z;
        const px = star.x * k + cx;
        const py = star.y * k + cy;

        if (px < 0 || px >= displayW || py < 0 || py >= displayH) {
          continue;
        }

        const prevK = 280 / star.prevZ;
        const prevPx = star.x * prevK + cx;
        const prevPy = star.y * prevK + cy;

        const size = Math.max(star.size * (1 - star.z / 1000) * 1.8, 0.6);
        const alpha = Math.min((1 - star.z / 1000) * 0.85, 0.7);

        ctx.strokeStyle = star.color;
        ctx.fillStyle = star.color;

        if (isWarping) {
          // Stretch star into a cinematic warp line based on scroll velocity and perspective vector
          const stretchX = (px - prevPx) * (1 + warpFactor);
          const stretchY = (py - prevPy) * (1 + warpFactor) - smoothedVelocity * 4;

          ctx.beginPath();
          ctx.lineWidth = Math.min(size * 1.2, 2.5);
          ctx.moveTo(px, py);
          ctx.lineTo(px - stretchX, py - stretchY);
          ctx.stroke();
        } else {
          // Ambient twinkling star point
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [starCount, speed, starColor, maxWarpStretch]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      aria-hidden="true"
    />
  );
}
