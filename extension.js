// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const spawn = require('child_process').spawn;
const tmp = require('tmp');
const fs = require('fs');

// extension globals

// store all running processes here 
const running_processes = [];
const logs = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let runServiceCommand = vscode.commands.registerCommand('vs-prodigy.run-service', function () {
		const serviceNames = getNotRunningServices();

		if (!checkServicesAvailability()) {
			return;
		}

		vscode.window.showQuickPick(serviceNames).then(serviceName => {

			if (!serviceName) {
				return;
			}

			const service = getServiceByName(serviceName);
			const command = getCommand(service.command);
			const args = getArgsFromCommand(service.command);
			const tmpObj = tmp.fileSync();
			const running_process = spawn(command, args, {
				cwd: service.base_path,
				env: {
					PATH: process.env.PATH,
				}
			});
			rememberProcess(running_process, serviceName, tmpObj.name);
			attachProcessListeners(running_process, serviceName);
		})
	});

	let stopServiceCommand = vscode.commands.registerCommand('vs-prodigy.stop-service', function() {
		const serviceNames = getRunningServices();

		if (!checkServicesAvailability()) {
			return;
		}

		vscode.window.showQuickPick(serviceNames).then(serviceName => {

			if (!serviceName) {
				return;
			}

			const running_process = findProcess(serviceName);
			killProcess(running_process);
		})
	});

	let serviceLogCommand = vscode.commands.registerCommand('vs-prodigy.log-service', function() {
		const services = vscode.workspace.getConfiguration('prodigy').services || [];
		const serviceNames = services.map(s => s.name).filter(sName => logs.find(l => l.name == sName));

		if (!checkServicesAvailability()) {
			return;
		}

		vscode.window.showQuickPick(serviceNames).then(serviceName => {

			if (!serviceName) {
				return;
			}

			const logRecord = logs.find(l => l.name == serviceName);
			const openPath = vscode.Uri.parse(`file:///${logRecord.output_file}`);
			vscode.workspace.openTextDocument(openPath).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		})
	});

	context.subscriptions.push(runServiceCommand);
	context.subscriptions.push(stopServiceCommand);
	context.subscriptions.push(serviceLogCommand);
}

function getRunningServices() {
	const services = vscode.workspace.getConfiguration('prodigy').services;
	return services
		.map(s => s.name)
		.filter(sName => running_processes.find(p => p.name == sName));
}

function getNotRunningServices() {
	const services = vscode.workspace.getConfiguration('prodigy').services;
	return services
		.map(s => s.name)
		.filter(sName => !running_processes.find(p => p.name == sName));
}

function rememberProcess(running_process, name, logFile) {
	running_process.stdout.on('data', function(data) {
		const logRecord = logs.find(p => p.name == name);
		fs.appendFileSync(logRecord.output_file, data.toString());
	})

	running_process.stderr.on('data', function(data) {
		const logRecord = logs.find(p => p.name == name);
		fs.appendFileSync(logRecord.output_file, data.toString());
	})

	running_processes.push({
		name,
		process: running_process,
	});
	logs.push({
		name,
		output_file: logFile
	})
}

function killProcess(runningProcess) {
	process.kill(runningProcess.process.pid, 'SIGKILL');
	removeProcessFromRunningList(runningProcess.name);
}

function removeProcessFromRunningList(processName) {
	running_processes.splice(running_processes.findIndex(p => p.name == processName), 1);
}

function findProcess(processName) {
	return running_processes.find(p => p.name == processName);
}

function getServiceByName(serviceName) {
	const services = vscode.workspace.getConfiguration('prodigy').services;
	return services.find(s => s.name == serviceName);
}

function attachProcessListeners(running_process, service_name) {
	if (running_process.pid) {
		vscode.window.showInformationMessage(`"${service_name}" has been started successfully.`);
	}
	running_process.on('error', function(err) {
		vscode.window.showErrorMessage(`Failed to start "${service_name}": ${err.toString()}`);
		removeProcessFromRunningList(service_name);
	});

	running_process.on('close', function() {
		vscode.window.showInformationMessage(`"${service_name}" has been stopped.`);
		removeProcessFromRunningList(service_name);
	});
}

function getArgsFromCommand(commandString) {
	const args = commandString.split(' ')
	args.shift();
	return args;
}

function getCommand(commandString) {
	return commandString.split(' ')[0];
}

function checkServicesAvailability() {
	const services = vscode.workspace.getConfiguration('prodigy').services;
	if (!services.length) {
		vscode.window.showWarningMessage("You don't have any service defined in prodigy.services. Go to your settings and define some nice services to run");
		return false;
	}

	return true;
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
