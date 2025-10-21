/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',            // já estava, mantém
  images: {
    unoptimized: true,         // <— desativa Image Optimization
  },
};

module.exports = nextConfig;
