import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = 56, className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="ABORA"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
