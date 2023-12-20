const proxy = require('http-proxy-middleware')
const process = require('node:process');

const SLIVKA = process.env.SLIVKA_URL;
if (!SLIVKA) {
    console.error('*** You must define the SLIVKA_URL environment variable.');
    process.exit(1);
}

module.exports = function(app) {
    app.use(
        '/api',
        proxy.createProxyMiddleware({
            target: SLIVKA,
            changeOrigin: true,
            prependPath: true
        })
    );
    app.use(
        '/media',
        proxy.createProxyMiddleware({
            target: SLIVKA,
            changeOrigin: true,
            prependPath: true
        })
    );
}
