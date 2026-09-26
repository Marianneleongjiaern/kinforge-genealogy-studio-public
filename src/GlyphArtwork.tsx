import { SVGProps } from "react";
import { GlyphDefinition } from "./glyphs";

type Props = SVGProps<SVGSVGElement> & { glyph: GlyphDefinition; size?: number };

export function GlyphArtwork({ glyph, size = 24, children, ...props }: Props) {
  const Icon = glyph.icon;
  const Modifier = glyph.modifier;
  if (!Modifier) return <Icon size={size} strokeWidth={1.65} {...props}>{children}</Icon>;
  // Both the app and exported SVGs use the same composed library pictograms.
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
    <Icon x={0} y={0} size={18} strokeWidth={1.65} absoluteStrokeWidth aria-hidden="true" focusable="false" />
    <Modifier x={14} y={14} size={10} strokeWidth={1.65} absoluteStrokeWidth aria-hidden="true" focusable="false" />
  </svg>;
}
