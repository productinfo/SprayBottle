import React from 'react'
import { Button, Text, Switch, Intent, Alignment, Icon, Popover, Tooltip, Position, Spinner } from '@blueprintjs/core';
import ScriptStatus from './ScriptStatus'
import '@blueprintjs/core/lib/css/blueprint.css';

import ReactTable from "react-table";
import 'react-table/react-table.css'

const electron = window.require('electron');
const powershell = electron.remote.require('powershell');
const sudo = electron.remote.require('sudo-prompt');
const fs = window.require("fs");

const Store = window.require('electron-store');
const store = new Store();

const CheckIfPs1 = (file) => {
    return file.match(/.+\.ps1\b/);
}

class ScriptTable extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            scripts: [],
            scriptPath: store.get('scriptPath'),
        }
        this.runPosh = this.runPosh.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.updateScripts = this.updateScripts.bind(this);
        this.updateTableHeight = this.updateTableHeight.bind(this);

        if (this.state.scriptPath != undefined) {
            fs.readdir(this.state.scriptPath, (err, dir) => {
                if (dir != undefined) {
                    let files = dir.filter(CheckIfPs1);
                    let scriptsCopy = this.state.scripts.slice(0);

                    for (let file of files) {
                        let script = {
                            name: file,
                            param: '',
                            adm: false,
                            status: '',
                            log: []
                        }
                        scriptsCopy.push(script)
                    };
                    this.setState({
                        scripts: scriptsCopy
                    })
                }
            });
        }
    };

    componentDidMount() {
        this.updateTableHeight();
        window.addEventListener('resize', this.updateTableHeight);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateTableHeight);
    }

    updateTableHeight() {
        let height = window.innerHeight - 80;
        this.setState({ tableHeight: height });
    }

    updateScripts(id, prop, data, add) {
        if (add) {
            let scripts = [...this.state.scripts];
            scripts[id][prop].push(data)
            this.setState({ scripts })
        } else {
            let scripts = [...this.state.scripts];
            scripts[id][prop] = data
            this.setState({ scripts })
        }
    }

    runPosh(id, event) {
        this.updateScripts(id, 'status', 'working')
        this.updateScripts(id, 'log', [])

        let cmd = `${this.state.scriptPath}/${this.state.scripts[id].name} '${this.state.scripts[id].param}'`;

        if (this.state.scripts[id].adm) {
            let admCmd = `powershell.exe ${cmd}`
            let options = { name: 'SprayBottle' };
            let scripts = [...this.state.scripts];
            let updateScripts = this.updateScripts;

            let result = sudo.exec(admCmd, options,
                function (error, stdout, stderr) {
                    if (error) {
                        updateScripts(id, 'log', error.message, true)
                        updateScripts(id, 'status', 'error')
                    }
                    if (stdout) {
                        updateScripts(id, 'log', stdout, true)
                        updateScripts(id, 'status', 'success')
                    }
                    if (stderr) {
                        updateScripts(id, 'log', stderr, true)
                        updateScripts(id, 'status', 'error')
                    }
                },
            );
        }

        else {
            let ps = new powershell(cmd, {
                executionPolicy: 'Bypass',
                noProfile: true,
            })
            ps.on("error", err => {
                if (err) {
                    this.updateScripts(id, 'log', err, true)
                    this.updateScripts(id, 'status', 'error')
                }
            });
            ps.on("output", data => {
                if (data) {
                    this.updateScripts(id, 'log', data, true)
                    this.updateScripts(id, 'status', 'success')
                }
            });
            ps.on("error-output", data => {
                if (data) {
                    this.updateScripts(id, 'log', data, true)
                    this.updateScripts(id, 'status', 'error')
                }
            });
        }
        event.preventDefault();
    }

    handleChange(event) {
        if (event.target.type == "text") {
            this.updateScripts(event.target.id, 'param', event.target.value)
        }
        else {
            this.updateScripts(event.target.id, 'adm', event.target.checked)
        }
    }

    render() {
        const cellRendererStatus = (cellInfo) => {
            let log = this.state.scripts[cellInfo.index].log;

            switch (cellInfo.value) {
                case 'working':
                    return (
                        <div>
                            <ScriptStatus
                                mode="spinner"
                                content={log}
                            />
                        </div>
                    );
                    break;
                case 'success':
                    return (
                        <div>
                            <ScriptStatus
                                mode="icon"
                                content={log}
                                icon="tick-circle"
                                intent={Intent.SUCCESS}
                            />
                        </div>
                    );
                    break;
                case 'error':
                    return (
                        <div>
                            <ScriptStatus
                                mode="icon"
                                content={log}
                                icon="warning-sign"
                                intent={Intent.DANGER}
                            />
                        </div>
                    );
                    break;
                default:
                    return (<div></div>);
            }
        };

        const columns = [
            {
            Header: 'Run',
            width: 80,
            maxWidth: 80,
            Cell: props =>
                <Button
                    id={props.index}
                    icon="play"
                    intent={Intent.SUCCESS}
                    fill={true}
                    minimal={false}
                    onClick={this.runPosh.bind(this, props.index)}
                />
        }, {
            Header: 'Script',
            accessor: 'name',
            Cell: props =>
                <div>
                    {props.value}
                </div>
        }, {
            Header: 'Status',
            accessor: 'status',
            Cell: cellRendererStatus
        }
    ]
        return (
            <ReactTable
                resizable={false}
                data={this.state.scripts}
                columns={columns}
                defaultPageSize={20}
                noDataText="No scripts detected."
                style={{
                  height: this.state.tableHeight, 
                }}
                className="-striped react-table"
            />
        );
    }
}

export default ScriptTable;