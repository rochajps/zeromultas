/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    outputFileTracingIncludes: {
      '/api/webhook/tribopay': ['./node_modules/pdfkit/js/data/**/*'],
      '/api/orders/**': ['./node_modules/pdfkit/js/data/**/*'],
      '/admin/pedidos/**': ['./node_modules/pdfkit/js/data/**/*'],
    },
  },
}
export default nextConfig
