/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.experiments = {
            ...(config.experiments || {}),
            asyncWebAssembly: true,
        };

        config.module.rules.push({
            test: /\.wasm$/i,
            type: "webassembly/async",
        });

        config.resolve.fallback = {
            ...(config.resolve.fallback || {}),
            fs: false,
            path: false,
        };

        return config;
    },
};

module.exports = nextConfig;
