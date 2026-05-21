import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@react-pdf/renderer',
    'pdfjs-dist',
    'pdf-lib',
    'canvas',
  ],
};

export default nextConfig;
