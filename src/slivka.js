import { apiPath } from './config';

export async function slivka(serviceName, formData, options={}) {
    if (typeof(options) === 'boolean') {
        options = {useCache: options};
    }
    const {statusCallback} = options;

    const resp = await fetch(apiPath(`/api/services/${serviceName}/jobs`), {
        method: 'POST',
        body: formData
    })
    if (!resp.ok) {
        if (resp.status === 422) { // "Unprocessable entity"
            const slivkaFail = await resp.json();
            if (slivkaFail.errors && slivkaFail.errors.length > 0) {
                throw Error(
                    slivkaFail.errors.map((err) => {
                        if (err.parameter) {
                            return `Bad parameter ${err.parameter} -- ${err.message}`;
                        } else {
                            return err.message || 'Unknown error';
                        }
                    }).join('; ')
                );
            }
        }
        throw Error(`Slivka request failed: ${resp.statusText}`);
    }
    const result = await resp.json();
    if (statusCallback) {
        try {
            statusCallback({status: result});
        } catch (ex) {
            console.log(ex);
        }
    }
}

export async function slivkaStatusCheck(jid) {
    const resp = await fetch(apiPath(`/api/jobs/${jid}`));
    if (!resp.ok) {
        console.log('resp', resp);
        if (resp.status === 404) {
            return {
                id: jid,
                status: 'NOT_FOUND'
            }
        }
        throw Error(`Slivka poll failed: ${resp.statusText}`);
    } 
    const result = await resp.json();
    return result;

}

export function pause(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), time);
    });
}