import { useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * CSS-only page transition wrapper that animates content on route changes.
 * Uses staggered fade-in animations for a polished feel.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Reset animation on route change
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <Box
      sx={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Box>
  );
}
