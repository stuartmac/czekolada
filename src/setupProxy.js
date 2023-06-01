const proxy = require('http-proxy-middleware')

const SLIVKA = process.env.SLIVKA_URL || 'http://sc1lvgystp02.sc1.roche.com:4040'

module.exports = function(app) {
    app.use(
        '/api',
        proxy.createProxyMiddleware({
            target: SLIVKA,
            changeOrigin: true
        })
    );
    app.use(
        '/media',
        proxy.createProxyMiddleware({
            target: SLIVKA,
            changeOrigin: true
        })
    );
}
