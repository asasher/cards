type BrandMarkProps = {
  size?: number;
  alt?: string;
  className?: string;
};

export default function BrandMark({ size = 40, alt = "ManyCards", className }: BrandMarkProps) {
  return (
    <img
      src="/manycards-mark.svg"
      alt={alt}
      width={size}
      height={size}
      className={["block shrink-0", className].filter(Boolean).join(" ")}
      decoding="async"
    />
  );
}
