/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        serverActions: {
            allowedOrigins: ["amknoiejhlmhancpahfcfcfhllgkpbld"],
        },
    },
};

export default nextConfig;
