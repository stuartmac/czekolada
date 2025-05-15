# czekolada: a thin layer around Slivka

Czekolada is a lightweight GUI for running [Slivka](https://github.com/bartongroup/slivka) services and inspecting
jobs, developed by the Computational Structural Biology (CSB) group at Genentech Inc.

## Development

    npm install
    SLIVKA_URL=http://my.slivka.instance:4040 npm start

The `SLIVKA_URL` environment variable MUST be set, and should point to
the base API-server URL of your Slivka installation.
