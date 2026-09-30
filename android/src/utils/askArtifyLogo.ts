import { useTheme } from '../context/ThemeContext';

/**
 * The Ask Artify logo comes in two background variants (dark-circle vs
 * light-circle) so it reads clearly against either app theme — this picks
 * the right file for the CURRENT theme. Any caller that renders against an
 * always-dark surface regardless of theme (e.g. the collapsed nav pill)
 * should use './ask-artify-logo-dark.png' directly instead of this hook.
 * Relative path (not '/...') to match this app's `vite build --base=./`.
 */
export function useAskArtifyLogoSrc(): string {
  const { effectiveTheme } = useTheme();
  return effectiveTheme === 'dark' ? './ask-artify-logo-dark.png' : './ask-artify-logo-light.png';
}
