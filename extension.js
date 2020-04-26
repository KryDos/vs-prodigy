// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const spawn = require('child_process').spawn;
const tmp = require('tmp');
const fs = require('fs');

// extension globals

// store all running processes here 
const running_processes = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vs-prodigy" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let runServiceCommand = vscode.commands.registerCommand('vs-prodigy.run-service', function () {
		const serviceNames = getNotRunningServices();
		vscode.window.showQuickPick(serviceNames).then(serviceName => {

			if (!serviceName) {
				return;
			}

			const service = getServiceByName(serviceName);
			const running_process = spawn(service.command, {
				cwd: service.base_path,
			});
			rememberProcess(running_process, serviceName);
		})
	});

	let stopServiceCommand = vscode.commands.registerCommand('vs-prodigy.stop-service', function() {
		const serviceNames = getRunningServices();
		vscode.window.showQuickPick(serviceNames).then(serviceName => {

			if (!serviceName) {
				return;
			}

			const process = findProcess(serviceName);
			killProcess(process);
		})
	});

	let serviceLogCommand = vscode.commands.registerCommand('vs-prodigy.log-service', function() {
		const serviceNames = getRunningServices();
		vscode.window.showQuickPick(serviceNames).then(serviceName => {

			if (!serviceName) {
				return;
			}

			const process = findProcess(serviceName);
			const openPath = vscode.Uri.parse(`file:///${process.output_file}`);
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

function rememberProcess(process, name) {
	tmp.file(function(err, path, fd) {
		running_processes.push({
			name,
			process,
			output_file: path,
		});
		process.stdout.on('data', function(data) {
			const runningProcess = running_processes.find(p => p.name == name);
			fs.appendFileSync(runningProcess.output_file, data.toString());
		})
	});
}

function killProcess(runningProcess) {
	runningProcess.process.kill();
	running_processes.splice(running_processes.findIndex(p => p.name == runningProcess.name), 1);
}

function findProcess(processName) {
	return running_processes.find(p => p.name == processName);
}

function getServiceByName(serviceName) {
	const services = vscode.workspace.getConfiguration('prodigy').services;
	return services.find(s => s.name == serviceName);
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
