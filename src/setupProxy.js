const proxy = require('http-proxy-middleware')
const process = require('node:process');

const SLIVKA = process.env.SLIVKA_URL;
if (!SLIVKA) {
    console.error('*** You must define the SLIVKA_URL environment variable.');
    process.exit(1);
}

let SLIVKA_PATHPREFIX;
{
    const match = /^.*[^\/](\/.*)/.exec(SLIVKA);
    if (match && match[1]) {
        SLIVKA_PATHPREFIX = match[1];
    }
}

function pathTrim(p) {
    if (SLIVKA_PATHPREFIX) {
        return p.replace(new RegExp('^' + SLIVKA_PATHPREFIX), '');
    } else {
        return p;
    }
}

module.exports = function(app) {
    app.use(
        '/api/jobs/*/files',
        proxy.createProxyMiddleware({
            target: SLIVKA,
            changeOrigin: true,
            prependPath: true,
            selfHandleResponse: true,
            onProxyRes: proxy.responseInterceptor(async (resBuffer, proxyResp, req, resp) => {
                if (proxyResp.statusCode === 200) {
                    const resText = resBuffer.toString();
                    try {
                        const resData = JSON.parse(resText);
                        const fixedResData = {
                            ...resData,
                            'files': resData.files.map((f) => ({
                                ...f,
                                '@content': pathTrim(f['@content']),
                                '@url': pathTrim(f['@url'])
                            }))
                        };
                        return JSON.stringify(fixedResData, null, 2);
                    } catch (err) {
                        console.error(err);
                    }
                    return resText;
                } else {
                    return resBuffer;
                }
            })
        })
    );
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
