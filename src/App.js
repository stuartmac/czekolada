import React, {createContext, useState, useReducer, useEffect, useContext, useCallback, useMemo, useRef} from 'react';
import {Container, Nav, Navbar, Form, Row, Col, Button, Table} from 'react-bootstrap';

import {useParams, useNavigate, useActionData, Outlet, Link, Form as RRForm} from 'react-router-dom';

import {slivka, slivkaStatusCheck} from './slivka';

const SlivkaServiceContext = createContext({services: [], loading: true, err: null});
const SlivkaJobCacheContext = createContext();

function jobStatusReducer(jobStatusMap, updateStatus) {
    return {
        ...jobStatusMap,
        [updateStatus.id]: updateStatus
    };
}

export default function App({children}) {
    const [serviceList, setServiceList] = useState({services: [], loading: true, err: null})
    const [jobStatusMap, updateJobStatus] = useReducer(jobStatusReducer, {}, () => {
        const jsStr = localStorage['czekolada.jobs'];
        if (jsStr) {
            try {
                return JSON.parse(jsStr);
            } catch (err) {
                console.log(err);
            }
        }
        return {};
    });
    const jobStatusDirtyRef = useRef(false);
    const jobStatusRef = useRef(jobStatusMap);

    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch('/api/services');
                // const resp = await fetch('/services.json');
                if (!resp.ok) throw Error(`${resp.statusText}`);
                const data = await resp.json();
                setServiceList({
                    services: data.services,
                    loading: false,
                    err: null
                });
            } catch (err) {
                setServiceList({services: [], loading: false, err});
            }
        })();
    }, []);

    useEffect(() => {
        jobStatusRef.current = jobStatusDirtyRef.current = jobStatusMap;
    }, [jobStatusMap]);

    useEffect(() => {
        const interval = setInterval(() => {
            for (const job of Object.values(jobStatusRef.current || {})) {
                if (!job.finished && job.status !== 'NOT_FOUND' && job.status !== 'COMMS_ERR') {
                    (async () => {
                        try {
                            const status = await slivkaStatusCheck(job.id);
                            updateJobStatus(status);
                        } catch (err) {
                            updateJobStatus({id: job.id, status: 'COMMS_ERR'});
                        }
                    })()
                }
            }

            if (jobStatusDirtyRef.current) {
                localStorage['czekolada.jobs'] = JSON.stringify(jobStatusDirtyRef.current);
                jobStatusDirtyRef.current = undefined;
            }
        }, 10000);

        return () => {
            clearInterval(interval);
        }
    }, []);

    const requestJob = useCallback(async (jobId) => {
        try {
            const data = await slivkaStatusCheck(jobId);
            updateJobStatus(data);
        } catch (err) {
            updateJobStatus({id: jobId, status: 'COMMS_ERR'})
        }
    }, [updateJobStatus]);

    const jobCache = useMemo(() => ({
        jobStatusMap,
        updateJobStatus,
        requestJob
    }), [jobStatusMap, requestJob])

    return (
        <SlivkaServiceContext.Provider value={serviceList}>
            <SlivkaJobCacheContext.Provider value={jobCache}>
                {children}
            </SlivkaJobCacheContext.Provider>
        </SlivkaServiceContext.Provider>
    )
}

export function AppRoutes() {
    const root = [
        {
            path: '/',
            element: <Root />,
            children: [
                {
                    path: '',
                    exact: true,
                    element: <Hello />
                },
                {
                    path: '/services',
                    element: <ServiceList />
                },
                {
                    path: '/services/:serviceId',
                    element: <ServiceView />,
                    action: async (request) => {
                        const formData = await request.request.formData();
                        return {baseJob: formData.get('base_job')};
                    } 
                },
                {
                    path: '/jobs',
                    element: <JobsList />
                },
                {
                    path: '/jobs/:jobId',
                    element: <JobView />
                }
            ]
        }
    ];
    return root;
}

function Hello() {
    return (
        <div>
            Czekolada is a thin layer around <a href="https://github.com/bartongroup/slivka/">Slivka</a>.
        </div>
    );
}

function ServiceList() {
    const {services, loading, err} = useContext(SlivkaServiceContext)

    if (loading) {
        return (
            <div>Loading services</div>
        );
    }
    if (err) {
        return (
            <div style={{color: 'red'}}>{err.message || err}</div>
        );
    }

    return (
        <ul>
            { services.map((s, i) => (
                <li key={i}>
                    <Link to={`/services/${s.id}`}>{ s.name }</Link>
                </li>
            )) }
        </ul>
    )
}

function ServiceView(props) {
    const {serviceId} = useParams();
    const {services, loading, err} = useContext(SlivkaServiceContext);
    const {jobStatusMap} = useContext(SlivkaJobCacheContext);
    const actionData = useActionData();

    const service = services.find((s) => s.id === serviceId);

    if (service) {
        return (
            <React.Fragment>
                <h3>{service.name}</h3>
                <p><i>{service.author}</i></p>
                <p>{service.description}</p>
                <ServiceLauncher service={service}
                                 key={serviceId} 
                                 baseParams={(jobStatusMap || {})[actionData?.baseJob]?.parameters} />
            </React.Fragment>
        )
    } else if (err) {
        return (
            <div style={{color: 'red'}}>{err.message || err}</div>
        );
    } else if (loading) {
        return (
            <div>Loading services</div>
        );
    }  else {
        return (
            <div>Service "{ serviceId }" not available on this system</div>
        )
    };
}

function serviceConfigReducer(config, {key, value, index=undefined}) {
    if (index === undefined) {
        return {
            ...config,
            [key]: value
        };
    } else {
        if (! (config[key] instanceof Array)) throw Error(`${key} is not an array`);
        let newArray = [...config[key]];
        newArray[index] = value;
        return {
            ...config,
            [key]: newArray
        }
    }
}

function serviceConfigInit({service, baseParams={}}) {
    const config = {};

    for (const param of (service.parameters || [])) {
        if (baseParams[param.id]) {
            if (param.type === 'file') {
                config[param.id] = {_slivkaFile: baseParams[param.id]}
            } else {
                config[param.id] = baseParams[param.id];
            }
        } else if (param.array) {
            if (param.required) {
                config[param.id] = [undefined];
            } else {
                config[param.id] = [];
            }
        } else if (param.default) {
            config[param.id] = param.default;
        }
    }
    return config;
}

function TextConfigControl({param, value, index, updateServiceConfig, isInvalid}) {
    const onChange = useCallback((ev) => {
        updateServiceConfig({
            key: param.id,
            index,
            value: ev.target.value.length > 0 ? ev.target.value : undefined
        })
    }, [param, updateServiceConfig, index]);

    return (
        <Form.Control type="text" value={value || ''} onChange={onChange} isInvalid={isInvalid}/>
    )
}

function IntegerConfigControl({param, value, updateServiceConfig, isInvalid}) {
    const [fieldValue, setFieldValue] = useState(typeof(value) === 'number' ? value.toString() : '');
    const onChange = useCallback((ev) => {
        const nfv = ev.target.value;
        setFieldValue(nfv);
        if (/^-?\d+$/.exec(nfv)) {
            updateServiceConfig({key: param.id, value: parseInt(nfv)});
        } else {
            updateServiceConfig({key: param.id, value: nfv.length === 0 ? undefined : Number.NaN});
        }
    }, [param, updateServiceConfig]);

    return (
        <Form.Control type="text"
                      value={fieldValue}
                      onChange={onChange}
                      isInvalid={isInvalid}/>
    )
}

function DecimalConfigControl({param, value, updateServiceConfig, isInvalid}) {
    const [fieldValue, setFieldValue] = useState(typeof(value) === 'number' ? value.toString() : '');
    const onChange = useCallback((ev) => {
        const nfv = ev.target.value;
        setFieldValue(nfv);
        if (/^-?\d*(\.\d*)?$/.exec(nfv) && /\d/.exec(nfv)) {
            updateServiceConfig({key: param.id, value: parseFloat(nfv)});
        } else {
            updateServiceConfig({key: param.id, value: nfv.length === 0 ? undefined : Number.NaN});
        }
    }, [param, updateServiceConfig]);

    return (
        <Form.Control type="text"
                      value={fieldValue}
                      onChange={onChange}
                      isInvalid={isInvalid}/>
    )
}

function ChoiceConfigControl({param, value, updateServiceConfig, isInvalid}) {
    const onChange = useCallback((ev) => {
        updateServiceConfig({key: param.id, value: ev.target.value !== '__czekolada_none__' ? ev.target.value : undefined})
    }, [param, updateServiceConfig]);

    return (
        <Form.Select value={value || '__czekolada_none__'}
                     onChange={onChange}
                     isInvalid={isInvalid}>
            { (param.required  && value) ? undefined : <option value="__czekolada_none__">-</option> }
            { (param.choices || []).map((opt, i) => (
                <option value={opt} key={i}>{opt}</option>
            )) }
        </Form.Select>
    )
}

function MultiChoiceConfigControl({param, value, updateServiceConfig, isInvalid}) {
    const onChange = useCallback((ev) => {
        const selectedSet = [];
        for (const child of ev.target.children) {
            if (child.selected) {
                selectedSet.push(child.value);
            }
        }
        updateServiceConfig({key: param.id, value: selectedSet})
    }, [param, updateServiceConfig]);

    return (
        <Form.Select multiple
                     onChange={onChange} >
            { (param.choices || []).map((opt, i) => (
                <option value={opt} key={i}>{opt}</option>
            )) }
        </Form.Select>
    )
}

function FlagConfigControl({param, value, updateServiceConfig, isInvalid}) {
    const onChange = useCallback((ev) => {
        updateServiceConfig({key: param.id, value: ev.target.checked});
    }, [param, updateServiceConfig]);

    return (
        <Form.Check type="checkbox"
                    onChange={onChange}
                    checked={value}
                    isInvalid={isInvalid} />
    );
}

function FileConfigControl({param, value, updateServiceConfig, isInvalid}) {
    const onChange = useCallback((ev) => {
        updateServiceConfig({key: param.id, value: ev.target.files[0]})
    }, [param, updateServiceConfig]);

    const onRemove = useCallback((ev) => {
        updateServiceConfig({key: param.id, value: undefined});
    }, [param, updateServiceConfig]);

    if (value?._slivkaFile) {
        return (
            <div>
                Slivka file: {value._slivkaFile}
                <Button onClick={onRemove}>Use another file</Button>
            </div>
        )
    } else {
        return (
            <Form.Control type="file"
                          isInvalid={isInvalid}
                          onChange={onChange} />
        );
    }
}

function MultiConfigControl({param, value, updateServiceConfig, isInvalid, Control}) {
    const onAdd = useCallback(() => {
        updateServiceConfig({key: param.id, value: undefined, index: value.length})
    }, [updateServiceConfig, value, param])

    const controls = [];
    for (let i = 0; i < value.length; ++i) {
        controls.push(
            <Control key={i}
                     value={value[i]}
                     index={i}
                     param={param}
                     isInvalid={isInvalid}
                     updateServiceConfig={updateServiceConfig} />
        );
    }

    return (
        <React.Fragment>
            { controls }
            <Button onClick={onAdd}>+</Button>
        </React.Fragment>
    )
}

function configMapToFormData(service, config) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(config)) {
        if (value === undefined || value === null) continue;

        if (value && value instanceof Array) {
            for (const vi of value) {
                if (vi !== undefined) {
                    formData.append(key, vi);
                }
            }
        } else {
            if (value?._slivkaFile) {
                formData.append(key, value._slivkaFile);
            } else {
                formData.append(key, value);
            }
        }
    }
    return formData;
}

function ServiceLauncher({service, baseParams}) {
    const [serviceConfig, updateServiceConfig] = useReducer(serviceConfigReducer, {service, baseParams}, serviceConfigInit);
    const [submitted, setSubmitted] = useState(false);

    const {updateJobStatus} = useContext(SlivkaJobCacheContext);

    const navigate = useNavigate();

    const submit = useCallback(() => {
        (async () => {
            setSubmitted(true);
            try {
                let hasNavigated = false;
                slivka(
                    service.id,
                    configMapToFormData(service, serviceConfig), 
                    {
                        statusCallback: ({status}) => {
                            if (!hasNavigated) {
                                hasNavigated = true;
                                navigate(`/jobs/${status.id}`);
                            }
                            updateJobStatus(status);
                        }
                    }
                );
            } catch (err) {
                console.log(err);
            } finally {
                setSubmitted(false);
            }
        })()

    }, [service, serviceConfig, navigate, updateJobStatus]);

    function controlForParam(param, value, isInvalid) {
        let Control;

        if (param.type === 'text') {
            Control = TextConfigControl;
        } else if (param.type === 'choice') {
            Control = ChoiceConfigControl;
        } else if (param.type === 'flag') {
            Control = FlagConfigControl;
        } else if (param.type === 'file') {
            Control = FileConfigControl;
        } else if (param.type === 'decimal') {
            Control = DecimalConfigControl;
        } else if (param.type === 'integer') {
            Control = IntegerConfigControl;
        }

        if (param.array) {
            if (param.type === 'file') {
                return <div>NYI: filearray</div>
            } else if (param.type === 'choice') {
                return <MultiChoiceConfigControl param={param}
                                                 value={value}
                                                 updateServiceConfig={updateServiceConfig}
                                                 isInvalid={isInvalid} />
            } else if (Control) {
                return <MultiConfigControl Control={Control}
                                           param={param}
                                           value={value}
                                           updateServiceConfig={updateServiceConfig}
                                           isInvalid={isInvalid} />
            } else {
                return <div>NYI: {param.type} array</div>
            }
        } else if (Control) {
            return (
                <Control param={param}
                         value={value}
                         updateServiceConfig={updateServiceConfig}
                         isInvalid={isInvalid} />
            );
        } else {
            return <div>NYI: {param.type}</div>
        }
    }

    let validErrors = false;

    return (
        <React.Fragment>
            <Form>
                {service.parameters.map((param) => {
                    let err = undefined;
                    const value = serviceConfig[param.id]
                    if (param.required) {
                        if (param.array) {
                            if (!value || !(value.some((x) => x))) {
                                err = 'Must provide at least one value';
                            }
                        } else {
                            if (value === undefined) {
                                err = 'Required';
                            } 
                        }
                    } else {
                        if (param.type === 'decimal' || param.type === 'integer') {
                            if (Number.isNaN(value)) {
                                err = `Must be a ${param.type}`;
                            } 

                            if (!err && param.min !== undefined) {
                                if (param.minExclusive) {
                                    if (value <= param.min) {
                                        err = `Must be > ${param.min}`
                                    }
                                }  else {                             
                                    if (value < param.min) {
                                        err = `Must be >= ${param.min}`
                                    }
                                }
                            }  if (!err && param.max !== undefined) {
                                if (param.maxExclusive) {
                                    if (value >= param.max) {
                                        err = `Must be < ${param.max}`
                                    }
                                }  else {                             
                                    if (value > param.max) {
                                        err = `Must be <= ${param.max}`
                                    }
                                }
                            }
                        }
                    }

                    // NB this map isn't quite pure since it sets validErrors in the outer context.
                    if (err) validErrors = true;

                    return (
                        <Form.Group as={Row} className="mb-3" key={param.id} controlId={param.id}>
                            <Form.Label column sm={4}>
                                {param.name || param.id}
                                {param.description
                                    ? <div style={{fontSize: "75%"}}>{param.description}</div>
                                    : undefined }
                            </Form.Label>
                            <Col sm={8}>
                                { controlForParam(param, serviceConfig[param.id], !!err) }
                                {err 
                                   ? <Form.Control.Feedback type="invalid">{err}</Form.Control.Feedback>
                                   : undefined }
                            </Col>
                        </Form.Group>
                    );
                })}
            </Form>
            <Button variant="primary" disabled={validErrors} onClick={submit}>
                Run Job
            </Button>
        </React.Fragment>
    )
}

function JobsList() {
    const {jobStatusMap} = useContext(SlivkaJobCacheContext);

    const jobList = Object.values(jobStatusMap || {}).filter((j) => j.status !== 'COMMS_ERR' && j.status !== 'NOT_FOUND');
    jobList.sort((a, b) => -((a.submissionTime || '').localeCompare(b.submissionTime || '')))
    if (jobList.length === 0) {
        return (
            <div>No jobs here.  Select a <Link to="/services">service</Link> to launch.</div>
        );
    }

    return (
        <Table striped bordered>
            <tbody>
                { jobList.map((job) => (
                    <tr key={job.id}>
                        <td><Link to={`/jobs/${job.id}`}>{job.id}</Link></td>
                        <td>{job.service}</td>
                        <td>{job.status}</td>
                        <td>{job.submissionTime}</td>
                    </tr>
                )) }
            </tbody>
        </Table>
    );
}

function JobView() {
    const {jobId} = useParams();
    const {jobStatusMap, requestJob} = useContext(SlivkaJobCacheContext);
    const {services} = useContext(SlivkaServiceContext);

    const status = (jobStatusMap || {})[jobId];

    useEffect(() => {
        if (!status) {
            requestJob(jobId)
        }
    }, [jobId, requestJob, status])


    const service = useMemo(() => {
        if (status?.service) {
            const service = services.find((s) => s.id === status?.service);
            if (service) return service;
        }
        return {
            name: 'Unknown service'
        }
    }, [status?.service, services]);


    if (!status || status.status === 'NOT_FOUND') {
        return (
            <div>Job not found</div>
        );
    } else {
        return (
            <React.Fragment>
                <h3>Job {status.id}</h3>
                <div>Run with: <Link to={`/services/${service.id}`}>{service.name}</Link></div>
                <div>Status: {status.status}</div>
                {status.submissionTime ? <div>Submitted: {status.submissionTime}</div> : undefined}
                {status.completionTime ? <div>Completed: {status.completionTime}</div> : undefined}
                <RRForm method="post" action={`/services/${service.id}`}>
                    <input type="hidden" name="base_job" value={jobId} />
                    <Button as="input" type="submit" value="Run another job like this" />
                </RRForm>
                {status.finished ? <JobOutputView jobId={status.id} /> : undefined}
            </React.Fragment>
        );
    }
}

function JobOutputView({jobId}) {
    const [jobFiles, setJobFiles] = useState(undefined);
    const [viewData, updateViewData] = useReducer(
        (oldViewData, {id, data}) => {
            const newViewData = [...oldViewData];
            newViewData[id] = data;
            return newViewData;
        },
        []
    );

    const toggleView = useCallback((ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const fid = parseInt(ev.target.dataset.fid);
        if (viewData[fid]) {
            updateViewData({id: fid, data: undefined});
        } else {
            updateViewData({id: fid, data: {loading: true}});
            (async () => {
                const resp = await fetch(jobFiles.files[fid]['@content']);
                if (!resp.ok) throw Error(resp.statusText);
                const data = await resp.text();
                updateViewData({id: fid, data: {data: data}});
            })();
        }
    }, [jobFiles, viewData])

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch(`/api/jobs/${jobId}/files`);
                if (!response.ok) throw Error(`${response.statusText}`);
                const result = await response.json();
                setJobFiles(result);
            } catch (err) {
                setJobFiles({error: err.message || err})
            }
        })();
    }, [jobId]);

    if (jobFiles === undefined) {
        return (
            <div>Fetching files</div>
        );
    } else if (jobFiles.error) {
        return (
            <div style={{color: 'red'}}>{jobFiles.error}</div>
        )
    }

    return (
        <Table striped bordered>
            <tbody>
                { jobFiles.files.map((file, i) => (
                    <tr key={i}>
                        <td>{file.label}</td>
                        <td>{file.path}</td>
                        <td>
                            <a href={file['@content']}
                               download
                               filename={file.path}>
                                [Download]
                            </a>

                            {file.mediaType && file.mediaType.startsWith('text/')
                                ? <a href="#"
                                     onClick={toggleView}
                                     data-fid={i}>
                                    { viewData[i] ? '[Hide]' : '[View]' }
                                   </a>
                                : undefined }

                            {viewData[i] && typeof(viewData[i].data) === 'string' 
                                ? <pre style={{
                                        background: 'black',
                                        color: 'orange',
                                        padding: '0.5em',
                                        overflow: 'scroll',
                                        maxHeight: '20em',
                                        margin: 0}}>
                                    {viewData[i].data}
                                  </pre>
                                : undefined }
                        </td>
                    </tr>
                )) }
            </tbody>
        </Table>
    );
}

function Root() {
    return (
        <React.Fragment>
            <Navbar bg="light">
                <Container>
                    <Navbar.Brand as={Link} to="/">
                        Czekolada
                    </Navbar.Brand>
                    <Nav>
                        <Nav.Link as={Link} to="/services">Services</Nav.Link>
                    </Nav>
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/jobs">Jobs</Nav.Link>
                    </Nav>
                </Container>
            </Navbar>
            <Container>
                <Outlet />
            </Container>
        </React.Fragment>
    );
}