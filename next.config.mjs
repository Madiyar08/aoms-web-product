/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Включает instrumentation.ts — глобальные обработчики ошибок при старте
    instrumentationHook: true,
  },
};

export default nextConfig;
